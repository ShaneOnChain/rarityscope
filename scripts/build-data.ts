/**
 * build-data.ts — derive the app's static data files from your collection metadata.
 *
 *   node scripts/build-data.ts       (wired as predev + prebuild; Node >= 23.6 runs TS directly)
 *
 * Reads:
 *   collection.config.ts   your collection (total, nullValues, enabled methods, …)
 *   data/meta.json         { "<serial>": [ { trait_type, value }, … ] }   ← the ONLY input a fork must supply
 *   data/rarity_rank.json  OPTIONAL golden OpenRarity fixture from the official `open_rarity` library.
 *                          If present, its `rank` is used as the canonical OpenRarity ranking and the
 *                          in-repo engine is asserted to agree ≥99% (drift guard). Absent → the engine's
 *                          own OpenRarity ranking is shipped (≈99% faithful; run scripts/openrarity for exact).
 *
 * Writes (git-ignored, regenerated on install/dev/build):
 *   public/data/summary.json          { methods, ranks:{ method: number[] }, _provenance }
 *   public/data/detail/<bucket>.json  { "<serial>": { ranks, scores, traits } }   (100 serials each)
 *
 * `traits` = every populated trait (config.rarity.nullValues filtered out), each { trait_type, value,
 * count, pct }, sorted rarest-first. This is the full breakdown shown on the detail + compare cards.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, assertConfig, type RarityMethod } from '../collection.config.ts'
import { computeRarity, buildFrequency, type Meta } from './lib/rarity-engine.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 100
const METHODS: RarityMethod[] = ['openRarity', 'infoContent', 'rarityScore']

assertConfig(config)
const { total, rarity } = config
const skip = new Set(rarity.nullValues)

const meta: Meta = JSON.parse(readFileSync(join(ROOT, 'data/meta.json'), 'utf8'))
const metaKeys = Object.keys(meta)
if (metaKeys.length !== total)
  throw new Error(`data/meta.json has ${metaKeys.length} entries, expected total=${total} (from collection.config.ts)`)

// --- compute all three rankings from metadata alone ---
const rarityMap = computeRarity(meta, total)
const freq = buildFrequency(meta)

// --- optional canonical OpenRarity fixture ---
// OpenRarity's library score is normalized per-attribute, so it is NOT a monotonic transform of raw
// information content — the in-repo engine can only APPROXIMATE the official OpenRarity ranking.
// When the fixture is present we ship its `rank` verbatim (byte-exact OpenRarity). We DO
// hard-gate the engine's rarityScore against the fixture's rs_rank: identical formula, so a mismatch
// means a real engine bug. Forks without a fixture get the engine's OpenRarity approximation (and can
// run scripts/openrarity for byte-exact — see AGENTS.md).
let canonicalOpenRarity: Record<string, number> | null = null
const fixturePath = join(ROOT, 'data/rarity_rank.json')
if (existsSync(fixturePath)) {
  const fixture: Record<string, { rank: number; rs_rank?: number }> = JSON.parse(readFileSync(fixturePath, 'utf8'))
  if (Object.keys(fixture).length === total && fixture[metaKeys[0]]?.rank) {
    canonicalOpenRarity = {}
    for (const s of metaKeys) canonicalOpenRarity[s] = fixture[s].rank
    if (fixture[metaKeys[0]].rs_rank !== undefined) {
      let rsAgree = 0
      for (const s of metaKeys) if (fixture[s].rs_rank === rarityMap[s].rarityScore.rank) rsAgree++
      const rsPct = (rsAgree / total) * 100
      console.log(`RarityScore: engine matches fixture rs_rank ${rsPct.toFixed(1)}% (${rsAgree}/${total})`)
      if (rsPct < 99) throw new Error(`engine RarityScore drifted from the fixture (${rsPct.toFixed(1)}% < 99%) — investigate`)
    }
    console.log('OpenRarity: shipping canonical fixture ranks (byte-exact).')
  } else {
    console.log('data/rarity_rank.json present but unusable — using engine OpenRarity approximation.')
  }
} else {
  console.log('No fixture — shipping engine OpenRarity approximation (run scripts/openrarity for byte-exact).')
}

/** Final rank for a serial+method: canonical fixture for OpenRarity when available, else the engine. */
const rankOf = (serial: string, method: RarityMethod): number =>
  method === 'openRarity' && canonicalOpenRarity ? canonicalOpenRarity[serial] : rarityMap[serial][method].rank

// --- summary: one rank array per method, indexed by serial-1 ---
const ranks: Record<RarityMethod, number[]> = { openRarity: [], infoContent: [], rarityScore: [] }
for (const m of METHODS) ranks[m] = new Array(total)

// --- detail buckets: full per-serial ranks + scores + trait breakdown ---
const buckets: Record<number, Record<string, unknown>> = {}

for (const serial of metaKeys) {
  const s = Number(serial)
  const r = rarityMap[serial]

  const serialRanks: Record<RarityMethod, number> = {
    openRarity: rankOf(serial, 'openRarity'),
    infoContent: rankOf(serial, 'infoContent'),
    rarityScore: rankOf(serial, 'rarityScore'),
  }
  for (const m of METHODS) ranks[m][s - 1] = serialRanks[m]

  const traits = []
  for (const t of meta[serial] ?? []) {
    if (skip.has(t.value)) continue
    const count = freq[t.trait_type]?.[t.value]
    if (!count) continue
    traits.push({ trait_type: t.trait_type, value: t.value, count, pct: Math.round((count / total) * 10000) / 100 })
  }
  traits.sort((a, b) => a.count - b.count) // rarest first

  const b = Math.floor((s - 1) / BUCKET)
  ;(buckets[b] ??= {})[serial] = {
    ranks: serialRanks,
    scores: {
      openRarity: round(r.openRarity.score),
      infoContent: round(r.infoContent.score),
      rarityScore: round(r.rarityScore.score),
    },
    traits,
  }
}

// --- assert each method is a clean 1..total permutation ---
for (const m of METHODS) {
  const seen = [...ranks[m]].sort((a, b) => a - b)
  for (let i = 0; i < total; i++) {
    if (seen[i] !== i + 1) throw new Error(`${m} ranks are not a clean 1..${total} permutation (got ${seen[i]} at ${i})`)
  }
}

// --- write ---
const outDir = join(ROOT, 'public/data')
rmSync(outDir, { recursive: true, force: true })
mkdirSync(join(outDir, 'detail'), { recursive: true })

const summary = {
  methods: config.rarity.enabledMethods,
  total,
  defaultMethod: config.rarity.defaultMethod,
  ranks,
  // Provenance travels with the data — machine-readable signature of the engine that produced it.
  _provenance: {
    engine: 'RarityScope',
    by: 'XRPLClaw',
    url: 'https://github.com/ShaneOnChain/rarityscope',
    builtAt: new Date().toISOString(),
  },
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary))
for (const [b, obj] of Object.entries(buckets)) {
  writeFileSync(join(outDir, 'detail', `${b}.json`), JSON.stringify(obj))
}

// --- report + spot-check anchors ---
const nBuckets = Object.keys(buckets).length
console.log(`built summary.json (${config.rarity.enabledMethods.join(', ')}) + ${nBuckets} detail buckets for ${total} pieces`)
for (const anchor of config.display.featuredSerials.slice(0, 3)) {
  const s = String(anchor)
  if (rarityMap[s])
    console.log(
      `  #${anchor}: openRarity ${rankOf(s, 'openRarity')} · rarityScore ${rankOf(s, 'rarityScore')} · infoContent ${rankOf(s, 'infoContent')}`
    )
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4
}
