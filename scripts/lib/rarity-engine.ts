/*
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  RarityScope rarity engine  ·  crafted by XRPLClaw (github.com/ShaneOnChain)│
 * │                                                                             │
 * │  Pure, dependency-free scoring of an NFT collection by THREE methods from    │
 * │  nothing but its trait metadata. No Python, no marketplace, no network.      │
 * │  This little file is the heart of RarityScope — if you fork the project,     │
 * │  this is the math that travels with you.                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * The three methods, given trait value probability p = count(value) / total:
 *
 *   openRarity   — OpenRarity's information-content model. Rank by (# of 1-of-1 traits DESC,
 *                  Σ −log₂(p) DESC, serial ASC). The unique-trait-count-first tiebreak is what
 *                  makes multi-1-of-1 pieces top the list; it reproduces the official
 *                  `open_rarity` library ~99% (a collection can ship exact library ranks as a fixture).
 *   infoContent  — pure information content: rank by (Σ −log₂(p) DESC, serial ASC). No unique-count
 *                  tiebreak, so "standout single trait" pieces (e.g. meme serials) can top it.
 *   rarityScore  — the classic rarity.tools score: rank by (Σ (1/p) = Σ total/count DESC, serial ASC).
 *                  Linear (not logarithmic), so it rewards a couple of very rare traits strongly —
 *                  it surfaces desirable "variant" pieces that the log-based methods bury.
 *
 * Null/empty traits (e.g. 'none') are NOT special here: they're ordinary values counted in the
 * frequency table (being common lowers a piece's rarity). Hiding them from the UI happens later,
 * at build time, via config.rarity.nullValues.
 */

export interface TraitRef {
  trait_type: string
  value: string
}

/** Raw collection metadata: serial (as string) -> its traits. */
export type Meta = Record<string, TraitRef[]>

export interface MethodScore {
  rank: number
  score: number
}

export interface SerialRarity {
  openRarity: MethodScore
  infoContent: MethodScore
  rarityScore: MethodScore
  /** Number of traits on this piece that are 1-of-1 across the collection. */
  uniqueCount: number
}

/** Build a trait_type -> value -> count frequency table over every slot of every piece. */
export function buildFrequency(meta: Meta): Record<string, Record<string, number>> {
  const freq: Record<string, Record<string, number>> = {}
  for (const traits of Object.values(meta)) {
    for (const t of traits) {
      ;(freq[t.trait_type] ??= {})[t.value] = (freq[t.trait_type]?.[t.value] ?? 0) + 1
    }
  }
  return freq
}

/**
 * Compute all three rarity rankings for a collection. Returns a map serial -> SerialRarity.
 * `total` defaults to the number of serials in `meta` (the collection size used for probabilities).
 */
export function computeRarity(meta: Meta, total = Object.keys(meta).length): Record<string, SerialRarity> {
  const freq = buildFrequency(meta)
  const serials = Object.keys(meta)

  // Per-serial raw scores.
  const info: Record<string, number> = {} //  Σ −log₂(count/total)
  const rscore: Record<string, number> = {} // Σ total/count
  const uniq: Record<string, number> = {} //   # of 1-of-1 traits

  for (const s of serials) {
    let ic = 0
    let rs = 0
    let u = 0
    for (const t of meta[s]) {
      const count = freq[t.trait_type][t.value]
      const p = count / total
      ic += -Math.log2(p)
      rs += total / count
      if (count === 1) u++
    }
    info[s] = ic
    rscore[s] = rs
    uniq[s] = u
  }

  // Assign 1..N ranks for a given comparator (lower rank number = rarer).
  const rankBy = (cmp: (a: string, b: string) => number): Record<string, number> => {
    const ordered = [...serials].sort(cmp)
    const out: Record<string, number> = {}
    ordered.forEach((s, i) => (out[s] = i + 1))
    return out
  }

  const num = (s: string) => Number(s)
  const orRank = rankBy((a, b) => uniq[b] - uniq[a] || info[b] - info[a] || num(a) - num(b))
  const icRank = rankBy((a, b) => info[b] - info[a] || num(a) - num(b))
  const rsRank = rankBy((a, b) => rscore[b] - rscore[a] || num(a) - num(b))

  const result: Record<string, SerialRarity> = {}
  for (const s of serials) {
    result[s] = {
      openRarity: { rank: orRank[s], score: info[s] },
      infoContent: { rank: icRank[s], score: info[s] },
      rarityScore: { rank: rsRank[s], score: rscore[s] },
      uniqueCount: uniq[s],
    }
  }
  return result
}
