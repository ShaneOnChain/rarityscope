/**
 * generate-demo-collection.ts — builds the bundled "scopelings" demo collection.
 *
 * RarityScope needs SOME collection to ship as its default config, and shipping a real
 * project's collection means shipping someone else's art (and, for mid-mint collections,
 * spoiling their reveal). So the template ships 100 generated pieces instead: this script
 * writes public/demo-art/<serial>.svg + data/meta.json, and the default collection.config.ts
 * points at them. Forkers replace both by following AGENTS.md.
 *
 * Deterministic on purpose (seeded PRNG): re-running it reproduces the exact same art and
 * traits, so the committed output is auditable. Run: node scripts/demo/generate-demo-collection.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const TOTAL = 100
const SEED = 1337

// mulberry32 — tiny deterministic PRNG, plenty for trait rolls.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)

/** Weighted pick: entries are [value, weight]. Skewed weights are what make rarity interesting. */
function pick<T extends string>(entries: [T, number][]): T {
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0)
  let roll = rand() * totalWeight
  for (const [value, weight] of entries) {
    roll -= weight
    if (roll <= 0) return value
  }
  return entries[entries.length - 1][0]
}

const BACKGROUNDS: [string, number][] = [
  ['mist', 30],
  ['sky', 24],
  ['meadow', 20],
  ['blush', 14],
  ['dusk', 9],
  ['midnight', 3],
]
const BODIES: [string, number][] = [
  ['mint', 30],
  ['peach', 26],
  ['lavender', 22],
  ['snow', 16],
  ['charcoal', 6],
]
const EYES: [string, number][] = [
  ['dot', 34],
  ['sleepy', 26],
  ['sparkle', 20],
  ['wink', 15],
  ['laser', 5],
]
const MOUTHS: [string, number][] = [
  ['smile', 40],
  ['cat', 28],
  ['gasp', 20],
  ['pout', 12],
]
const ACCESSORIES: [string, number][] = [
  ['none', 38],
  ['bow', 20],
  ['scarf', 16],
  ['antenna', 12],
  ['halo', 9],
  ['crown', 5],
]
const AURAS: [string, number][] = [
  ['none', 88],
  ['glow', 8],
  ['starlight', 3],
  ['prismatic', 1],
]

const BG_FILL: Record<string, string> = {
  mist: '#E8ECF1',
  sky: '#CDE4F7',
  meadow: '#D6EFD8',
  blush: '#F7DCE4',
  dusk: '#C9C4E4',
  midnight: '#2A2D3E',
}
const BODY_FILL: Record<string, string> = {
  mint: '#A8E6CF',
  peach: '#FFD3B6',
  lavender: '#C6B7E8',
  snow: '#F4F4F6',
  charcoal: '#4A4A55',
}

// Ink flips light/dark so faces stay readable on every body color.
const ink = (body: string) => (body === 'charcoal' ? '#F4F4F6' : '#3A3A44')

function eyesSvg(style: string, body: string): string {
  const c = ink(body)
  switch (style) {
    case 'dot':
      return `<circle cx="216" cy="252" r="11" fill="${c}"/><circle cx="296" cy="252" r="11" fill="${c}"/>`
    case 'sleepy':
      return `<path d="M202 254 q14 12 28 0" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M282 254 q14 12 28 0" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    case 'sparkle':
      return `<path d="M216 238 l4 10 10 4 -10 4 -4 10 -4-10 -10-4 10-4z" fill="${c}"/><path d="M296 238 l4 10 10 4 -10 4 -4 10 -4-10 -10-4 10-4z" fill="${c}"/>`
    case 'wink':
      return `<circle cx="216" cy="252" r="11" fill="${c}"/><path d="M282 252 h28" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`
    case 'laser':
      return `<rect x="200" y="246" width="32" height="10" rx="5" fill="#FF4D6D"/><rect x="280" y="246" width="32" height="10" rx="5" fill="#FF4D6D"/><line x1="232" y1="251" x2="292" y2="251" stroke="#FF4D6D" stroke-width="4" opacity="0.6"/>`
    default:
      return ''
  }
}

function mouthSvg(style: string, body: string): string {
  const c = ink(body)
  switch (style) {
    case 'smile':
      return `<path d="M238 292 q18 16 36 0" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    case 'cat':
      return `<path d="M236 292 q10 12 20 0 q10 12 20 0" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    case 'gasp':
      return `<ellipse cx="256" cy="296" rx="12" ry="15" fill="${c}"/>`
    case 'pout':
      return `<path d="M238 300 q18 -14 36 0" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`
    default:
      return ''
  }
}

function accessorySvg(style: string): string {
  switch (style) {
    case 'bow':
      return `<g transform="translate(256 150)"><path d="M0 0 L-34 -20 L-34 20 Z" fill="#F48FB1"/><path d="M0 0 L34 -20 L34 20 Z" fill="#F48FB1"/><circle r="10" fill="#EC6D9B"/></g>`
    case 'scarf':
      return `<path d="M172 342 q84 34 168 0 l-6 26 q-78 30 -156 0 Z" fill="#EF8354"/><rect x="300" y="352" width="26" height="52" rx="10" fill="#EF8354"/>`
    case 'antenna':
      return `<line x1="256" y1="148" x2="256" y2="100" stroke="#4A4A55" stroke-width="7" stroke-linecap="round"/><circle cx="256" cy="92" r="13" fill="#7FD8BE"/>`
    case 'halo':
      return `<ellipse cx="256" cy="112" rx="58" ry="16" fill="none" stroke="#F5D061" stroke-width="9"/>`
    case 'crown':
      return `<path d="M212 148 l12 -34 16 22 16 -34 16 34 16 -22 12 34 Z" fill="#F5D061" stroke="#E0B33C" stroke-width="4"/>`
    default:
      return ''
  }
}

function auraSvg(style: string): string {
  switch (style) {
    case 'glow':
      return `<circle cx="256" cy="276" r="152" fill="none" stroke="#FFE9A8" stroke-width="16" opacity="0.55"/>`
    case 'starlight':
      return [
        [96, 120],
        [416, 104],
        [72, 360],
        [432, 392],
        [376, 200],
      ]
        .map(([x, y]) => `<path d="M${x} ${y - 14} l5 10 10 4 -10 4 -5 10 -5-10 -10-4 10-4z" fill="#FFF3C4"/>`)
        .join('')
    case 'prismatic':
      return `<circle cx="256" cy="276" r="158" fill="none" stroke="url(#prism)" stroke-width="18" opacity="0.8"/><defs><linearGradient id="prism" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9AA2"/><stop offset="0.35" stop-color="#FFDAC1"/><stop offset="0.65" stop-color="#B5EAD7"/><stop offset="1" stop-color="#C7CEEA"/></linearGradient></defs>`
    default:
      return ''
  }
}

function pieceSvg(t: Record<string, string>): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`,
    `<rect width="512" height="512" rx="44" fill="${BG_FILL[t.Background]}"/>`,
    auraSvg(t.Aura),
    // Body: a soft blob with two little ears.
    `<circle cx="196" cy="176" r="34" fill="${BODY_FILL[t.Body]}"/>`,
    `<circle cx="316" cy="176" r="34" fill="${BODY_FILL[t.Body]}"/>`,
    `<ellipse cx="256" cy="276" rx="128" ry="120" fill="${BODY_FILL[t.Body]}"/>`,
    eyesSvg(t.Eyes, t.Body),
    mouthSvg(t.Mouth, t.Body),
    accessorySvg(t.Accessory),
    `</svg>`,
  ].join('\n')
}

// ── generate ────────────────────────────────────────────────────────────────
const root = join(import.meta.dirname, '..', '..')
const artDir = join(root, 'public', 'demo-art')
mkdirSync(artDir, { recursive: true })

const meta: Record<string, { trait_type: string; value: string }[]> = {}
for (let serial = 1; serial <= TOTAL; serial++) {
  const traits: Record<string, string> = {
    Background: pick(BACKGROUNDS),
    Body: pick(BODIES),
    Eyes: pick(EYES),
    Mouth: pick(MOUTHS),
    Accessory: pick(ACCESSORIES),
    Aura: pick(AURAS),
  }
  // The demo ships exactly one guaranteed 1-of-1, so the rarest-piece UI always has a star.
  if (serial === 42) traits.Aura = 'prismatic'
  meta[String(serial)] = Object.entries(traits).map(([trait_type, value]) => ({ trait_type, value }))
  writeFileSync(join(artDir, `${serial}.svg`), pieceSvg(traits))
}

writeFileSync(join(root, 'data', 'meta.json'), JSON.stringify(meta, null, 1))

// Quick distribution readout so weight tweaks are easy to sanity-check.
const counts: Record<string, Record<string, number>> = {}
for (const traits of Object.values(meta))
  for (const { trait_type, value } of traits) {
    counts[trait_type] ??= {}
    counts[trait_type][value] = (counts[trait_type][value] ?? 0) + 1
  }
console.log(`scopelings: wrote ${TOTAL} SVGs -> public/demo-art/ and data/meta.json`)
for (const [trait, values] of Object.entries(counts))
  console.log(
    `  ${trait}: ${Object.entries(values)
      .sort((a, b) => b[1] - a[1])
      .map(([v, n]) => `${v}=${n}`)
      .join(' ')}`
  )
