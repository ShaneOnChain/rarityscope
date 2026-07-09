/**
 * GET /api/minted — which of the collection's serials have actually been minted.
 *
 * A random-draw mint (no replacement) scatters the minted serials across 1..total (NOT 1..N), so
 * the only way to know WHICH is to enumerate the issuer's on-chain NFTs and decode each token's URI
 * (ipfs://<cid>/<serial>.json) back to a serial. That Clio `nfts_by_issuer` sweep (paginated, ~30+
 * calls) lives in `@/lib/providers/xrpcafe` and is cached hard (~10 min) — minting only adds a
 * handful of pieces per hour.
 *
 * Returns a compact base64 bitmap (ceil(total/8) bytes) so the client can mark cells with an O(1)
 * bit test and no per-serial payload. Degrades to { count: null, bitmap: null } on failure (the grid
 * then simply shows no markers).
 *
 * When config.features.mintedMarkers is off, we skip the sweep entirely and return no bitmap.
 */
import { NextResponse } from 'next/server'
import { config } from '@/config'
import { getMinted } from '@/lib/providers/xrpcafe'

export async function GET() {
  const updated_at = new Date().toISOString()

  if (!config.features.mintedMarkers) {
    return NextResponse.json(
      { count: null, total: config.total, bitmap: null, updated_at },
      { status: 200 }
    )
  }

  const { count, bitmap } = await getMinted()

  if (count !== null) {
    return NextResponse.json(
      { count, total: config.total, bitmap, updated_at },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } }
    )
  }

  return NextResponse.json(
    { count: null, total: config.total, bitmap: null, updated_at },
    { headers: { 'Cache-Control': 'public, s-maxage=60' } }
  )
}
