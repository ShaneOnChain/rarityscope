/**
 * fetch-metadata.ts — the "bring your own collection" on-ramp for XRPL collections.
 *
 *   node scripts/fetch-metadata.ts        (also: `npm run fetch-metadata`; Node >= 22.6 for TS)
 *
 * WHAT IT DOES
 *   1. Enumerates every NFT minted by config.chainId.issuer with taxon config.chainId.taxon, via the
 *      Clio `nfts_by_issuer` RPC (config.chain.clioNodes, tried in order, paginated on `marker`).
 *   2. Decodes each token's on-chain URI (hex -> utf8) and derives a { serial, metadataUrl }:
 *        - ipfs://<cid>/<serial>.json      -> serial from the path, fetched via an IPFS gateway
 *        - https://.../<serial>.json       -> serial from the path, fetched directly
 *      The serial is the number embedded in the URI path (e.g. `/4191.json`). If the URI carries no
 *      number, we fall back to a serial found IN the metadata (name "#123", or a numeric
 *      serial/edition/id field) — a heuristic; see resolveSerial().
 *   3. Fetches each metadata JSON (small concurrency + basic retry; IPFS tried across gateways).
 *   4. Normalizes attributes to [{ trait_type, value }] (OpenSea-style `{ attributes: [...] }` accepted,
 *      also a bare `traits: [...]`), stringifying values.
 *   5. Writes data/meta.json = { "<serial>": [ { trait_type, value }, ... ] } — the ONLY input the data
 *      build (`npm run build:data`) needs.
 *
 * ASSUMPTIONS / LIMITATIONS (documented on purpose)
 *   - XRPL only. Non-XRPL collections should hand-produce data/meta.json in the shape above (see AGENTS.md).
 *   - Serials are expected to run 1..config.total and to be discoverable from the URI path (the common
 *     XRPL pattern) or the metadata. Pieces whose serial can't be resolved are skipped with a warning.
 *   - Every populated trait slot should be present in the source metadata; "no trait" slots should carry a
 *     literal value (e.g. "none") and be listed in config.rarity.nullValues so they count in frequency but
 *     are hidden in the UI. This script does not invent empty slots.
 *   - Uses only Node built-ins + global fetch (no new dependencies). Be a good citizen: modest concurrency.
 *
 * If the final count != config.total, the collection may be mid-mint, or some URIs don't encode a serial.
 * `npm run build:data` will refuse to build until the count matches config.total.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../collection.config.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'data', 'meta.json')

// --- tunables (polite defaults) ---
const RPC_PAGE = 400 // NFTs per nfts_by_issuer page
const RPC_MAX_PAGES = 500 // hard stop on pagination
const RPC_TIMEOUT_MS = 20000
const META_TIMEOUT_MS = 20000
const CONCURRENCY = 8 // parallel metadata fetches
const RETRIES = 3 // attempts per metadata document
const PROGRESS_EVERY = 250 // log cadence while fetching metadata
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
]

type Attr = { trait_type: string; value: string }
type Entry = { serialFromUri: number | null; metadataUri: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────────────────────
// 1) Enumerate the issuer's NFTs via Clio nfts_by_issuer.
// ─────────────────────────────────────────────────────────────────────────────
async function rpcPage(node: string, marker: unknown): Promise<{ nfts: Array<{ uri?: string }>; marker?: unknown }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS)
  try {
    const params: Record<string, unknown> = {
      issuer: config.chainId.issuer,
      nft_taxon: config.chainId.taxon,
      limit: RPC_PAGE,
    }
    if (marker) params.marker = marker
    const r = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nfts_by_issuer', params: [params] }),
      signal: ctrl.signal,
    })
    if (!r.ok) throw new Error(`${node} -> HTTP ${r.status}`)
    const d = await r.json()
    if (d?.result?.status !== 'success') throw new Error(`${node} -> rpc error: ${JSON.stringify(d?.result?.error ?? d)}`)
    return { nfts: d.result.nfts ?? [], marker: d.result.marker }
  } finally {
    clearTimeout(timer)
  }
}

/** Full paginated sweep on one node. Returns null on failure so the caller can try the next node. */
async function sweep(node: string): Promise<Entry[] | null> {
  const entries: Entry[] = []
  const seen = new Set<string>()
  let marker: unknown = undefined
  try {
    for (let page = 0; page < RPC_MAX_PAGES; page++) {
      const res = await rpcPage(node, marker)
      for (const n of res.nfts) {
        if (!n.uri) continue
        const uri = hexToUtf8(n.uri)
        if (!uri || seen.has(uri)) continue
        seen.add(uri)
        entries.push({ serialFromUri: serialFromUri(uri), metadataUri: uri })
      }
      process.stdout.write(`\r  enumerating… page ${page + 1}, ${entries.length} tokens`)
      marker = res.marker
      if (!marker) break
    }
    process.stdout.write('\n')
    return entries
  } catch (e) {
    process.stdout.write('\n')
    console.warn(`  node ${node} failed mid-sweep: ${(e as Error).message}`)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) URI + serial helpers.
// ─────────────────────────────────────────────────────────────────────────────
/** XRPL NFTokenURI is hex; some collections already store a plain string. Tolerate both. */
function hexToUtf8(uri: string): string {
  if (/^[0-9a-fA-F]+$/.test(uri) && uri.length % 2 === 0) {
    try {
      return Buffer.from(uri, 'hex').toString('utf8')
    } catch {
      return uri
    }
  }
  return uri
}

/** Serial embedded in the URI path: the number before `.json`, else a trailing path number. */
function serialFromUri(uri: string): number | null {
  const j = uri.match(/(\d+)\.json\b/)
  if (j) return Number(j[1])
  const tail = uri.match(/\/(\d+)(?:$|[?#])/)
  if (tail) return Number(tail[1])
  return null
}

/** Fallback serial found INSIDE the metadata (name "#123", or a numeric serial/edition/id field). */
function serialFromMeta(meta: Record<string, unknown>): number | null {
  for (const key of ['serial', 'edition', 'id', 'tokenId', 'token_id']) {
    const v = meta[key]
    if (typeof v === 'number' && Number.isInteger(v)) return v
    if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v)
  }
  const name = meta.name
  if (typeof name === 'string') {
    const m = name.match(/#\s*(\d+)/)
    if (m) return Number(m[1])
  }
  return null
}

/** ipfs://<cid>/<path> -> <gateway><cid>/<path>. */
function ipfsToHttp(uri: string, gateway: string): string {
  return uri.replace(/^ipfs:\/\/(ipfs\/)?/i, gateway)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Fetch + normalize one metadata document.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), META_TIMEOUT_MS)
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ctrl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()) as Record<string, unknown>
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch a metadata doc, retrying and (for ipfs://) rotating gateways. */
async function fetchMetadata(uri: string): Promise<Record<string, unknown>> {
  const candidates = uri.startsWith('ipfs://') ? IPFS_GATEWAYS.map((g) => ipfsToHttp(uri, g)) : [uri]
  let lastErr: unknown
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    for (const url of candidates) {
      try {
        return await fetchJson(url)
      } catch (e) {
        lastErr = e
      }
    }
    await sleep(300 * (attempt + 1)) // linear backoff
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** OpenSea-style `attributes` (or a bare `traits`) -> [{ trait_type, value }] with string values. */
function normalizeAttrs(meta: Record<string, unknown>): Attr[] {
  const raw = (meta.attributes ?? meta.traits) as unknown
  if (!Array.isArray(raw)) return []
  const out: Attr[] = []
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue
    const tt = (a as Record<string, unknown>).trait_type ?? (a as Record<string, unknown>).traitType
    const v = (a as Record<string, unknown>).value
    if (tt == null || v == null) continue
    out.push({ trait_type: String(tt), value: String(v) })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny concurrency pool (no dependency).
// ─────────────────────────────────────────────────────────────────────────────
async function pool<T>(items: T[], size: number, worker: (item: T, i: number) => Promise<void>): Promise<void> {
  let idx = 0
  const run = async () => {
    while (idx < items.length) {
      const i = idx++
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) || 1 }, run))
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`RarityScope fetch-metadata — ${config.displayName}`)
  console.log(`  issuer ${config.chainId.issuer}  taxon ${config.chainId.taxon}`)

  if (!config.chainId.issuer) throw new Error('config.chainId.issuer is empty — set it in collection.config.ts')
  if (!config.chain.clioNodes?.length) throw new Error('config.chain.clioNodes is empty — add a Clio node URL')

  // 1) enumerate (first node that completes a full sweep wins)
  let entries: Entry[] | null = null
  for (const node of config.chain.clioNodes) {
    console.log(`  enumerating via ${node}`)
    entries = await sweep(node)
    if (entries && entries.length) break
  }
  if (!entries || !entries.length) throw new Error('no NFTs enumerated from any Clio node — check issuer/taxon/nodes')
  console.log(`  enumerated ${entries.length} tokens`)

  // 2/3/4) fetch + normalize metadata, polite concurrency + retry
  const meta: Record<string, Attr[]> = {}
  let done = 0
  let failed = 0
  let skipped = 0
  await pool(entries, CONCURRENCY, async (entry) => {
    try {
      const doc = await fetchMetadata(entry.metadataUri)
      const serial = entry.serialFromUri ?? serialFromMeta(doc)
      if (serial == null || !Number.isInteger(serial) || serial < 1) {
        skipped++
      } else {
        meta[String(serial)] = normalizeAttrs(doc)
      }
    } catch {
      failed++
    } finally {
      done++
      if (done % PROGRESS_EVERY === 0 || done === entries!.length) {
        process.stdout.write(`\r  metadata ${done}/${entries!.length}  (ok ${Object.keys(meta).length}, failed ${failed}, skipped ${skipped})`)
      }
    }
  })
  process.stdout.write('\n')

  // 5) write data/meta.json (sorted by serial for a clean diff)
  const count = Object.keys(meta).length
  if (!count) throw new Error('no metadata fetched — every document failed; check gateways / URIs')
  const sorted: Record<string, Attr[]> = {}
  for (const s of Object.keys(meta).sort((a, b) => Number(a) - Number(b))) sorted[s] = meta[s]

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(sorted, null, 0))

  console.log(`\nwrote ${count} pieces -> data/meta.json`)
  if (failed) console.log(`  ${failed} metadata fetches failed (re-run to retry — completed pieces are re-fetched too)`)
  if (skipped) console.log(`  ${skipped} tokens skipped (no resolvable serial)`)
  if (count !== config.total) {
    console.log(
      `  NOTE: got ${count} but config.total is ${config.total}. ` +
        `Reconcile them before \`npm run build:data\` (the build asserts count === total). ` +
        `If the mint is ongoing, set total to the final supply and re-run when minting completes.`
    )
  } else {
    console.log(`  count matches config.total (${config.total}) — ready for \`npm run build:data\``)
  }
}

main().catch((e) => {
  console.error(`\nfetch-metadata failed: ${(e as Error).message}`)
  process.exit(1)
})
