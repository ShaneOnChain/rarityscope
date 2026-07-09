/**
 * xrpcafe.ts — SERVER-ONLY market + chain data provider for RarityScope's live stats.
 *
 * This module holds every upstream call (api.xrp.cafe + Clio RPC). It is imported ONLY by the
 * `/api/stats` and `/api/minted` route handlers, never by a client component — api.xrp.cafe is
 * xrp.cafe's private, per-IP rate-limited, CORS-scoped backend and must not be reachable from the
 * browser. All collection-specific values (issuer, taxon, endpoints, supply, broker) come from
 * `@/config`, so retargeting RarityScope at another collection needs no changes here.
 */
import { config } from '@/config'

// ── Config-driven constants ──────────────────────────────────────────────────
const issuer = config.chainId.issuer
const taxon = config.chainId.taxon
// apiBase is optional in the config type but guaranteed present when features.liveStats is on
// (assertConfig enforces it). Coalesce to '' purely to keep the types happy for getJson(string).
const apiBase = config.marketplace.apiBase ?? ''
// xrp.cafe routes timed auctions through this broker; brokered listings are excluded from the
// buy-now floor (alongside the auction_expiration flag).
const auctionBroker = config.marketplace.auctionBroker
const clioNodes = config.chain.clioNodes
const accountInfoNode = config.chain.accountInfoNode
const total = config.total

const STATS_REVALIDATE = 180
const MINTED_REVALIDATE = 600
const MINTED_PAGE = 400
const MINTED_MAX_PAGES = 200

// Present like the radar's probes so the private cafe backend answers cleanly.
const CAFE_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://xrp.cafe',
  Referer: 'https://xrp.cafe/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
}

async function getJson(url: string, init?: RequestInit) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, next: { revalidate: STATS_REVALIDATE } })
    if (!r.ok) throw new Error(`${url} -> ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

/** minted count + live mint price from the cafe collection object (handles object-or-[object]). */
async function fetchCollection(): Promise<{ minted: number | null; mintPrice: number | null }> {
  try {
    const d = await getJson(apiBase, { headers: CAFE_HEADERS })
    const o = Array.isArray(d) ? d[0] : d
    // cafe returns these as numbers OR numeric strings ("5000000.00") — coerce, then validate.
    const mintedN = Number(o?.numberInCollection)
    const priceN = Number(o?.alp_amount_per_nft)
    const minted = Number.isFinite(mintedN) && mintedN > 0 ? mintedN : null
    const mintPrice = Number.isFinite(priceN) && priceN > 0 ? Math.round((priceN / 1e6) * 1e6) / 1e6 : null
    return { minted, mintPrice }
  } catch {
    return { minted: null, mintPrice: null }
  }
}

/** trustless minted fallback: issuer MintedNFTokens - BurnedNFTokens via a public CORS-open Clio. */
async function fetchMintedOnchain(): Promise<number | null> {
  try {
    const d = await getJson(accountInfoNode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_info', params: [{ account: issuer, ledger_index: 'validated' }] }),
    })
    const acc = d?.result?.account_data
    if (!acc) return null
    const minted = Number(acc.MintedNFTokens ?? 0) - Number(acc.BurnedNFTokens ?? 0)
    return Number.isFinite(minted) ? minted : null
  } catch {
    return null
  }
}

/** cheapest BUY-NOW ask (excludes timed auctions via the auction_expiration flag + auction broker). */
async function fetchFloor(): Promise<{ floor: number | null; nListings: number | null }> {
  const url = `${apiBase}/nfts?pageNumber=0&sort=low&forSaleItemType=&rarities=%5B%5D&fullAmount=false&rangeMin=0&rangeMax=1000000`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const d = await getJson(url, { headers: CAFE_HEADERS })
      const items: Array<{ amount?: string; auction_expiration?: unknown; broker?: string }> = Array.isArray(d)
        ? d
        : (d?.NFTs ?? [])
      const buyNow = items
        .filter((c) => !c.auction_expiration && c.broker !== auctionBroker && c.amount)
        .map((c) => Number(c.amount) / 1e6)
        .filter((n) => Number.isFinite(n) && n > 0)
      if (buyNow.length) return { floor: Math.min(...buyNow), nListings: buyNow.length }
      // empty page -> retry once (the cafe feed does this intermittently), then give up
    } catch {
      break
    }
  }
  return { floor: null, nListings: null }
}

/**
 * Live collection stats for the header bar.
 * Returns { minted, total, mint_price_xrp, floor_xrp, n_listings } — the caller adds updated_at.
 */
export async function getStats(): Promise<{
  minted: number | null
  total: number
  mint_price_xrp: number | null
  floor_xrp: number | null
  n_listings: number | null
}> {
  const [{ minted: cafeMinted, mintPrice }, floorRes] = await Promise.all([fetchCollection(), fetchFloor()])
  const minted = cafeMinted ?? (await fetchMintedOnchain())
  return {
    minted,
    total,
    mint_price_xrp: mintPrice,
    floor_xrp: floorRes.floor,
    n_listings: floorRes.nListings,
  }
}

async function rpc(node: string, marker: unknown) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  try {
    const params: Record<string, unknown> = { issuer, nft_taxon: taxon, limit: MINTED_PAGE }
    if (marker) params.marker = marker
    const r = await fetch(node, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nfts_by_issuer', params: [params] }),
      signal: ctrl.signal,
      next: { revalidate: MINTED_REVALIDATE },
    })
    if (!r.ok) throw new Error(`${node} -> ${r.status}`)
    const d = await r.json()
    if (d?.result?.status !== 'success') throw new Error(`${node} rpc error`)
    return d.result as { nfts?: Array<{ uri?: string }>; marker?: unknown }
  } finally {
    clearTimeout(timer)
  }
}

/** Enumerate the whole issuer NFT set on one node, packing minted serials into a bitmap. */
async function sweep(node: string): Promise<{ bitmap: Uint8Array; count: number }> {
  const bitmap = new Uint8Array(Math.ceil(total / 8))
  let count = 0
  let marker: unknown = undefined
  for (let page = 0; page < MINTED_MAX_PAGES; page++) {
    const res = await rpc(node, marker)
    for (const n of res.nfts ?? []) {
      if (!n.uri) continue
      const uri = Buffer.from(n.uri, 'hex').toString('utf8')
      const m = uri.match(/\/(\d+)\.json/)
      if (!m) continue
      const serial = Number(m[1])
      if (serial >= 1 && serial <= total) {
        const bit = serial - 1
        const byteIdx = bit >> 3
        const mask = 1 << (bit & 7)
        if (!(bitmap[byteIdx] & mask)) {
          bitmap[byteIdx] |= mask
          count++
        }
      }
    }
    marker = res.marker
    if (!marker) break
  }
  return { bitmap, count }
}

/**
 * Which serials have actually been minted, as a compact base64 bitmap (ceil(total/8) bytes).
 * Sweeps clioNodes in order, returning the first node that yields any minted pieces.
 * Returns { count: null, bitmap: null } on total failure — the grid then shows no markers.
 */
export async function getMinted(): Promise<
  { count: number; bitmap: string } | { count: null; bitmap: null }
> {
  for (const node of clioNodes) {
    try {
      const { bitmap, count } = await sweep(node)
      if (count > 0) {
        return { count, bitmap: Buffer.from(bitmap).toString('base64') }
      }
    } catch {
      // try the next node
    }
  }
  return { count: null, bitmap: null }
}
