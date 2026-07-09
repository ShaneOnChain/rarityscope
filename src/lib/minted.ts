/**
 * minted.ts — client loader for the minted-serial bitmap from /api/minted.
 *
 * Fetched once, cached. Decodes the base64 bitmap into a Uint8Array with an O(1) `has(serial)`
 * bit test, so the grid can mark thousands of cells with no per-serial data.
 */

export type MintedSet = {
  count: number
  has: (serial: number) => boolean
}

let promise: Promise<MintedSet | null> | null = null

export function loadMinted(): Promise<MintedSet | null> {
  if (!promise) {
    promise = fetch('/api/minted')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { count: number | null; bitmap: string | null }) => {
        if (!d.bitmap || d.count === null) return null
        const bytes = Uint8Array.from(atob(d.bitmap), (c) => c.charCodeAt(0))
        return {
          count: d.count,
          has: (serial: number) => {
            const bit = serial - 1
            return bit >= 0 && ((bytes[bit >> 3] >> (bit & 7)) & 1) === 1
          },
        }
      })
      .catch(() => {
        promise = null // allow retry
        return null
      })
  }
  return promise
}
