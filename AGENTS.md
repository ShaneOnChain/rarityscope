# AGENTS.md — retarget RarityScope at a new collection

You are an AI coding agent. A user has pointed you at this repo (RarityScope, built by XRPLClaw) and
wants it to browse the rarity of **their** NFT collection instead of the bundled demo (scopelings). Follow the
steps below in order. Do not restructure the app — RarityScope is config-driven, so the only files you
edit are `collection.config.ts`, `src/app/globals.css`, and the `data/` inputs.

Ask the user for anything you don't know (collection name, total supply, issuer, art URL, marketplace
link). Then execute.

---

## (a) Edit `collection.config.ts`

This is the single source of truth for the collection. Set every field on the exported `config` object:

- `name` — URL-safe slug, e.g. `'my-collection'`.
- `displayName` — human name shown in the UI, e.g. `'My Collection'`.
- `total` — total supply as an integer. **Must equal the number of entries in `data/meta.json`** (the
  build asserts this). Serials are assumed to run `1..total`.
- `chainId.issuer` — XRPL issuer account (r-address). Only used by the live/minted features; set it if
  you have it, otherwise `''`.
- `chainId.taxon` — the collection's NFT taxon (number, often `0`).
- `art.cid` — IPFS CID (or any id) substituted for `{cid}`. Leave `''` if your template doesn't use it.
- `art.ext` — source art file extension substituted for `{ext}`, e.g. `'png'`.
- `art.urlTemplate` — full image URL template. **Must contain `{serial}`.** `{cid}`, `{ext}`, and `{w}`
  (pixel width) are optional. Must be an **absolute URL** when `art.proxy` is on; a relative path is fine
  for art bundled under `public/` (how the scopelings demo ships). Examples:
  - simple CDN: `'https://cdn.example.com/{serial}.png'`
  - IPFS via a resizing proxy: `'https://images.weserv.nl/?url=ipfs.io/ipfs/{cid}/{serial}.{ext}&output=webp&w={w}'`
  - bundled in the repo: `'/demo-art/{serial}.{ext}'` (proxy off)
- `art.fallbackUrlTemplates` — optional array of extra templates (same placeholders, each must contain
  `{serial}`) tried in order when the primary fails. Use alternate gateways/CDNs for the same art. The UI
  retries with backoff and walks these before showing a placeholder. Omit for a single reliable CDN.
- `art.proxy` — optional boolean. When `true`, the app serves art through its own
  `/api/art/{serial}?w=` route, which retries `urlTemplate` + fallbacks server-side and lets the host
  CDN (e.g. Vercel's edge) cache each success — so a flaky source resolves once globally instead of
  once per visitor. Turn it ON for public IPFS gateways. Omit/`false` to
  hit `urlTemplate` directly from the browser (fine for a reliable CDN). The route gives each
  upstream ~3.5s within a ~20s function budget, so keep the template list to ~5 entries — anything
  past that is only reachable by the browser's own fallback ladder.
- `marketplace.name` — e.g. `'xrp.cafe'`.
- `marketplace.collectionUrl` — public collection page (linked from cards + footer).
- `marketplace.apiBase` — stats API base. **Required only if `features.liveStats` is `true`.**
- `marketplace.auctionBroker` — optional; xrp.cafe timed-auction broker to exclude from the buy-now floor.
- `chain.clioNodes` — array of Clio node URLs for `nfts_by_issuer` enumeration (used by `fetch-metadata`
  and the minted feature). **Required if `features.mintedMarkers` is `true`.**
- `chain.accountInfoNode` — node URL for the `account_info` minted-count fallback.
- `rarity.defaultMethod` — which method loads first: `'openRarity' | 'rarityScore' | 'infoContent'`.
  Must be one of `enabledMethods`.
- `rarity.enabledMethods` — methods offered in the switcher, in display order. Any subset of the three,
  e.g. `['openRarity', 'rarityScore', 'infoContent']`.
- `rarity.nullValues` — trait values that mean "no trait of this type" (e.g. `'none'`, `'normal'`). They
  ARE counted in frequency (being common lowers rarity) but are HIDDEN from the trait breakdown UI. See (b).
- `rarity.gradeLadder` — the S / A+ / A / … ladder. Each tier is `{ letter, label, maxFraction }`,
  evaluated top-down; a rank qualifies if `rank <= ceil(maxFraction * total)`. Tune to taste.
- `rarity.accentTopFraction` — ranks within this top fraction get the primary accent color, the rest get
  the secondary.
- `display.featuredSerials` — a few standout serials for the landing hero strip (also spot-checked by the
  build). Pick real serials in `1..total`.
- `branding.siteTitle`, `branding.tagline`, `branding.keywords` — site copy + SEO keywords.
- `branding.credit` — `{ label, url }` footer credit. Keep it, swap it, or blank the `label` to hide it.
- `features.liveStats` / `features.mintedMarkers` — booleans. **Turn both OFF for non-XRPL / non-xrp.cafe
  collections.**

The file ends with `assertConfig`, which the data build runs — a misconfigured fork fails loudly at
`npm run build:data` rather than rendering broken.

## (b) Get the metadata into `data/meta.json`

The build reads exactly one input: `data/meta.json`, keyed by serial string, each value an array of the
piece's traits:

```json
{
  "1": [ { "trait_type": "Background", "value": "Blue" }, { "trait_type": "Eyes", "value": "Laser" } ],
  "2": [ { "trait_type": "Background", "value": "Red" },  { "trait_type": "Eyes", "value": "Normal" } ]
}
```

Two ways to produce it:

- **XRPL collections — automated:**

  ```bash
  npm run fetch-metadata
  ```

  This reads `config.chainId.issuer` + `config.chainId.taxon`, enumerates the issuer's NFTs via Clio
  `nfts_by_issuer` (`config.chain.clioNodes`), decodes each token URI to a serial + metadata URL, fetches
  and normalizes each metadata JSON (OpenSea-style `{ attributes: [...] }` is accepted), and writes
  `data/meta.json`. Set `chainId` and `chain.clioNodes` in the config first.

- **Any collection — hand-produced:** emit `data/meta.json` in the shape above from whatever source you
  have. Include **every** trait slot for each piece. For "no trait" slots, use a literal value and list it
  in `rarity.nullValues` (e.g. an empty "Hat" slot with value `'none'`) — it stays in the frequency math
  but is hidden from the UI breakdown.

There must be exactly `config.total` keys, serials `1..total`.

## (c) Build the data

```bash
npm run build:data
```

This computes all three rankings (OpenRarity, Rarity Score, Info Content) from `data/meta.json`, asserts
each is a clean `1..total` permutation, and writes the app's static files under `public/data/`
(git-ignored, regenerated on install/dev/build). Read its log: it prints the ranks of your
`display.featuredSerials` as a spot check.

Optional byte-exact OpenRarity: if you drop a `data/rarity_rank.json` fixture (serial-keyed `{ rank,
score, ... }`) produced by the official `open_rarity` library (recipe in `scripts/openrarity/`), the build
uses those ranks verbatim for OpenRarity and drift-checks the engine against them. Without it, the engine's
faithful ~99% approximation is shipped.

## (d) Re-theme via `src/app/globals.css`

Change the collection's look by editing the CSS variables in the single `:root` block in
`src/app/globals.css` — accent colors, background, text colors, fonts. Do not touch component styling; the
whole UI reads these variables. `config.rarity.accentTopFraction` decides which pieces get the primary vs
secondary accent.

Also replace the site icons in `public/` with the user's own: `favicon.ico`, `icon-192.png`, and
`apple-touch-icon.png` (same filenames).

## (e) Verification checklist

```bash
npm run dev   # runs build:data first, then serves http://localhost:3000
```

Then confirm:

1. The landing page shows `displayName` and the featured serials render art.
2. Open a serial you know is rare (or `#{one of featuredSerials}`) at `/nft/<serial>` — its rank, grade,
   and "rarer than %" look sane (rarest pieces near rank 1).
3. Toggle the method switcher — the rank/grade on a piece changes between OpenRarity / Rarity Score / Info
   Content, and the default matches `rarity.defaultMethod`.
4. `/compare?a=<x>&b=<y>` shows two pieces with a rarer-side verdict.
5. If `features.liveStats`/`mintedMarkers` are on, the stats bar loads (or degrades to "unavailable"
   cleanly). If off, no stats UI appears and nothing errors.

## (f) Common errors and fixes

- **`data/meta.json has N entries, expected total=M`** — `config.total` and the number of keys in
  `data/meta.json` disagree. Fix `total` or the metadata so they match exactly.
- **`features.liveStats is on but marketplace.apiBase is unset`** — either set `marketplace.apiBase` or set
  `features.liveStats: false`.
- **`features.mintedMarkers is on but chain.clioNodes is empty`** — add Clio node URLs to
  `chain.clioNodes` or set `features.mintedMarkers: false`.
- **`art.urlTemplate must contain '{serial}'`** — every art URL needs the `{serial}` placeholder; add it.
- **`<method> ranks are not a clean 1..N permutation`** — usually malformed metadata (duplicate serials,
  missing entries, or non-string trait values). Ensure each serial appears once and traits are
  `{ trait_type, value }` strings.
- **`fetch-metadata` returns fewer than `total` pieces** — the collection may be mid-mint, or some token
  URIs don't encode a serial. Verify `chainId.issuer`/`taxon`, or fall back to hand-producing
  `data/meta.json`.
- **Art doesn't load** — check `art.urlTemplate` / `art.cid` / `art.ext` against a real image URL in a
  browser; fix the template.
