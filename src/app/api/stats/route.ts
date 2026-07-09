/**
 * GET /api/stats — live collection stats for the header bar.
 *
 * Returns { minted, total, mint_price_xrp, floor_xrp, n_listings, updated_at }.
 *
 * All upstream calls happen in `@/lib/providers/xrpcafe` (server-side) — never from the browser —
 * because api.xrp.cafe is xrp.cafe's private, per-IP rate-limited, CORS-scoped backend. Each source
 * is wrapped in its own try/catch there so a partial failure still returns what it could (nulls
 * degrade to "unavailable" in the UI without breaking the page). Cached ~3 min: floor/minted move
 * slowly, so this is imperceptibly fresh and stays well under any rate limit.
 *
 * When config.features.liveStats is off (e.g. a non-XRPL / non-xrp.cafe fork), we skip every
 * upstream call and return all-null stats so the header bar cleanly reads "unavailable".
 */
import { NextResponse } from 'next/server'
import { config } from '@/config'
import { getStats } from '@/lib/providers/xrpcafe'

export async function GET() {
  const updated_at = new Date().toISOString()

  if (!config.features.liveStats) {
    return NextResponse.json(
      { minted: null, total: config.total, mint_price_xrp: null, floor_xrp: null, n_listings: null, updated_at },
      { status: 200 }
    )
  }

  const stats = await getStats()

  return NextResponse.json(
    { ...stats, updated_at },
    { headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300' } }
  )
}
