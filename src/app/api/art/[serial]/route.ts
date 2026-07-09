/**
 * GET /api/art/[serial]?w= — same-origin art proxy with edge caching. Enabled via config.art.proxy.
 *
 * Without it, every visitor's browser fetches art straight from the configured gateways (e.g. an
 * image proxy over a public IPFS gateway), and under cold IPFS resolution that means hundreds of
 * 404s and a slow grid PER VISITOR — each browser re-fights gateway resolution for every tile.
 * Here the fight happens once, server-side: we walk the configured upstream templates in order
 * and stream back the first real image with an immutable year-long cache-control. The host CDN
 * (Vercel's edge honors s-maxage on route-handler responses) then serves every later request for
 * that serial+width without touching a gateway again. Art never changes for a given serial, so
 * the aggressive TTL is safe.
 *
 * Failures return 502 with no-store — a bad gateway moment must NEVER get pinned into the cache;
 * the client's fallback ladder (artUrls) still has the direct gateway URLs behind this route.
 *
 * Params are strict: the serial must be canonical (no '007' / '1e3' spellings — each would be a
 * separate long-TTL cache entry for the same art) and ?w= snaps to a small fixed set of widths,
 * so one serial can only ever occupy a handful of cache keys.
 */
import { NextRequest } from 'next/server'
import { isValidSerial, upstreamArtUrls } from '@/lib/rarity'

// Worst case is every upstream timing out in sequence (3.5s each, 3 templates in the default
// config) plus streaming overhead — keep the function alive long enough to finish the walk.
export const maxDuration = 20

/** Allowed pixel widths; a request's ?w= snaps to the nearest. */
const WIDTHS = [64, 128, 256, 512, 1024]
const UPSTREAM_TIMEOUT_MS = 3500

export async function GET(req: NextRequest, { params }: { params: Promise<{ serial: string }> }) {
  const rawSerial = (await params).serial
  const serial = Number(rawSerial)
  if (String(serial) !== rawSerial || !isValidSerial(serial)) {
    return new Response('invalid serial', { status: 400 })
  }

  const rawW = req.nextUrl.searchParams.get('w')
  const requested = rawW === null ? 512 : Number(rawW)
  if (rawW !== null && String(requested) !== rawW) {
    return new Response('invalid width', { status: 400 })
  }
  const w = WIDTHS.reduce((best, cand) =>
    Math.abs(cand - requested) < Math.abs(best - requested) ? cand : best
  )

  for (const url of upstreamArtUrls(serial, w)) {
    try {
      // cache: 'no-store' — the edge cache on OUR response is the cache layer; Next's fetch
      // cache would only duplicate it (and choke on binary bodies over its size limit).
      const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), cache: 'no-store' })
      const type = res.headers.get('content-type') ?? ''
      // Gateways love to 200 an HTML error page (or an empty body) — only a real image counts
      // as success, because a success gets pinned at the edge for a year.
      if (!res.ok || !res.body || !type.startsWith('image/')) continue
      if (res.headers.get('content-length') === '0') continue
      return new Response(res.body, {
        headers: {
          'content-type': type,
          'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          // Forks can point urlTemplate anywhere, and we re-serve it same-origin — sandbox so a
          // scripted SVG opened directly can never execute on this origin. <img> use is unaffected.
          'content-security-policy': 'sandbox',
        },
      })
    } catch {
      // Timeout or network error — walk on to the next upstream.
    }
  }

  return new Response('all art upstreams failed', {
    status: 502,
    headers: { 'cache-control': 'no-store' },
  })
}
