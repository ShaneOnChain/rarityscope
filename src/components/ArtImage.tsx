'use client'

import { useEffect, useRef, useState } from 'react'
import { artUrls, DISPLAY_NAME } from '@/lib/rarity'

/**
 * Collection art via artUrls(): the same-origin cached proxy route first, then the configured
 * direct gateway URLs as fallbacks. Plain <img> (not next/image) so we don't pay Vercel image
 * optimization on thousands of thumbs.
 *
 * Loading is defensive, because every hop (edge cache -> proxy -> IPFS gateway) can hiccup
 * transiently, and each defense covers a different failure:
 *  - each URL in artUrls() is tried in order, the whole list twice, with a short growing
 *    backoff between attempts; backoff is jittered so a screenful of tiles that failed
 *    together doesn't retry as one synchronized volley
 *  - the second pass adds a cache-buster, but only to absolute (http) gateway URLs — it exists
 *    to route around a browser-cached upstream error, and the same-origin proxy serves its
 *    failures no-store, so a buster there would only split the edge-cache key for nothing
 *  - the pre-hydration complete-check only short-circuits to success; a complete-but-empty
 *    element schedules a normal delayed retry instead of advancing synchronously, because
 *    right after a src swap some browsers (Safari) still report the previous failed
 *    resource's state, which would otherwise burn through the whole attempt list in one tick
 *  - a watchdog advances past attempts that stall without ever firing load OR error
 *  - a subtle pulse marks tiles that are still loading; only after every attempt fails does the
 *    tile settle into the quiet #serial placeholder
 */
const PASSES = 2 // how many times to walk the URL list before giving up
const RETRY_BASE_MS = 350
const STALL_MS = 12_000

export function ArtImage({
  serial,
  w = 512,
  className = '',
  priority = false,
}: {
  serial: number
  w?: number
  className?: string
  priority?: boolean
}) {
  const urls = artUrls(serial, w)
  const maxAttempts = urls.length * PASSES
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading')
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Fresh piece (or size) through a reused element -> start over.
  useEffect(() => {
    setAttempt(0)
    setStatus('loading')
  }, [serial, w])

  useEffect(() => {
    if (status !== 'loading') return
    // The element may have finished (from cache, or pre-hydration) before this effect ran —
    // in that case load/error already fired without a listener attached.
    const el = imgRef.current
    if (el?.complete) {
      if (el.naturalWidth > 0) {
        setStatus('ok')
        return
      }
      // Complete-but-empty must NOT advance synchronously: right after React swaps src, some
      // browsers (Safari) still report the PREVIOUS failed resource here, and a sync advance
      // would cascade through every attempt in one tick. Delay instead — if the new resource
      // is genuinely mid-flight, complete is false by then and onLoad/onError take over
      // (advance()'s stale-guard makes a late timer harmless).
      const retry = setTimeout(() => advance(attempt), RETRY_BASE_MS + Math.random() * 250)
      return () => clearTimeout(retry)
    }
    // Watchdog: a hung connection fires neither load nor error — move on without one.
    const stall = setTimeout(() => advance(attempt), STALL_MS)
    return () => clearTimeout(stall)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, attempt])

  const advance = (from: number) => {
    setAttempt((cur) => {
      if (cur !== from) return cur // an earlier retry already moved us forward
      if (cur + 1 >= maxAttempts) {
        setStatus('failed')
        return cur
      }
      return cur + 1
    })
  }

  const handleError = () => {
    const from = attempt
    // Jitter breaks up the thundering herd: without it, every visible tile that failed on the
    // same hiccup retries on the exact same deterministic schedule.
    setTimeout(() => advance(from), RETRY_BASE_MS * (from + 1) + Math.random() * 250)
  }

  if (status === 'failed') {
    return (
      <div
        className={`flex items-center justify-center bg-surface-1 text-text-muted font-mono text-xs ${className}`}
        aria-label={`${DISPLAY_NAME} #${serial} art unavailable`}
      >
        #{serial}
      </div>
    )
  }

  const url = urls[attempt % urls.length]
  // Second-pass cache-buster only makes sense against absolute gateway URLs, where the browser
  // may have cached an upstream error. The same-origin proxy (relative path) serves failures
  // no-store, so a buster there just fragments the edge-cache key.
  const bust = attempt >= urls.length && url.startsWith('http')
  const src = bust ? `${url}${url.includes('?') ? '&' : '?'}retry=${Math.floor(attempt / urls.length)}` : url

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={`${DISPLAY_NAME} #${serial}`}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      onLoad={() => setStatus('ok')}
      onError={handleError}
      className={`${className} ${status === 'loading' ? 'animate-pulse bg-surface-1' : ''}`}
    />
  )
}
