'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { config } from '@/config'
import { loadSummary, TOTAL, type Summary } from '@/lib/data'
import { loadMinted, type MintedSet } from '@/lib/minted'
import { useMethod } from '@/context/MethodContext'
import { GridCell } from './GridCell'

type Sort = 'serial' | 'rare'
type Filter = 'all' | 'minted' | 'pool'
const GAP = 8
const SHOW_MINTED = config.features.mintedMarkers

/**
 * The full 1..TOTAL gallery, window-virtualized so only on-screen rows mount (never TOTAL DOM
 * nodes/images on a phone). Ranks come from the in-memory summary for the ACTIVE rarity method;
 * sort toggles serial order vs rarest-first with zero network, re-sorting when the method changes.
 */
export function RarityGrid() {
  const parentRef = useRef<HTMLDivElement>(null)
  const { method } = useMethod()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [minted, setMinted] = useState<MintedSet | null>(null)
  const [sort, setSort] = useState<Sort>('serial')
  const [filter, setFilter] = useState<Filter>('all')
  const [width, setWidth] = useState(0)
  const [scrollMargin, setScrollMargin] = useState(0)

  // Rank array for the currently-active method (falls back to undefined until the summary loads).
  const ranks = summary?.ranks[method]

  useEffect(() => {
    loadSummary().then(setSummary).catch(() => {})
    if (SHOW_MINTED) loadMinted().then(setMinted).catch(() => {})
  }, [])

  // Track container width (for column count) and its document offset (for window scroll math).
  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const measure = () => {
      setWidth(el.clientWidth)
      setScrollMargin(el.getBoundingClientRect().top + window.scrollY)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const cols = width ? Math.max(2, Math.min(7, Math.floor(width / 170))) : 2
  const cellSize = width ? Math.floor((width - GAP * (cols - 1)) / cols) : 0
  const rowHeight = cellSize + 26 + GAP // art + label row + gap

  // Serial order for the current sort + minted filter, under the active method. Rarest-first needs
  // ranks (falls back to serial until loaded); the minted filter needs the minted set (disabled
  // until loaded). Recomputes when the active method changes so the rarest sort re-orders.
  const order = useMemo(() => {
    let serials = Array.from({ length: TOTAL }, (_, i) => i + 1)
    if (minted && filter !== 'all') {
      serials = serials.filter((s) => (filter === 'minted' ? minted.has(s) : !minted.has(s)))
    }
    if (sort === 'rare' && ranks) serials.sort((a, b) => ranks[a - 1] - ranks[b - 1])
    return serials
  }, [sort, ranks, minted, filter, method])

  const rows = Math.ceil(order.length / cols)
  const rowHeightRef = useRef(rowHeight)
  rowHeightRef.current = rowHeight

  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowHeightRef.current,
    overscan: 5,
    scrollMargin,
  })

  // Re-measure when geometry or the filtered set changes (cols/size/offset/row count).
  useEffect(() => {
    virtualizer.measure()
  }, [cols, rowHeight, scrollMargin, rows, virtualizer])

  // When the sort/filter/method changes the result set, the window virtualizer keeps its old visible
  // range until a scroll event. Snap to the top of the grid on change: it reads results from the
  // start AND generates the scroll that refreshes the range. (Skips the initial mount.)
  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    const el = parentRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: Math.max(0, top - 64) })
    requestAnimationFrame(() => virtualizer.measure())
  }, [sort, filter, method, virtualizer])

  return (
    <section className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">
          the collection · {order.length.toLocaleString()}
          {filter !== 'all' && <span className="text-text-muted"> / {TOTAL.toLocaleString()}</span>}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-lg border border-surface-3 text-sm">
            {(['serial', 'rare'] as Sort[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                disabled={s === 'rare' && !ranks}
                className={`px-3 py-1.5 font-mono ${
                  sort === s ? 'bg-accent text-dark' : 'bg-surface-0 text-text-secondary hover:text-text-primary'
                } disabled:opacity-40`}
              >
                {s === 'serial' ? 'by #' : 'rarest'}
              </button>
            ))}
          </div>
          {SHOW_MINTED && (
            <div className="flex overflow-hidden rounded-lg border border-surface-3 text-sm">
              {(['all', 'minted', 'pool'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  disabled={f !== 'all' && !minted}
                  className={`px-3 py-1.5 font-mono ${
                    filter === f ? 'bg-mint text-dark' : 'bg-surface-0 text-text-secondary hover:text-text-primary'
                  } disabled:opacity-40`}
                >
                  {f === 'pool' ? 'in pool' : f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend for the minted marker. */}
      {SHOW_MINTED && (
        <div className="mb-3 flex items-center gap-4 font-mono text-[11px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint" />
            minted{minted ? ` · ${minted.count.toLocaleString()}` : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full border border-text-muted" />
            still in the pool
          </span>
        </div>
      )}

      <div ref={parentRef} className="w-full">
        {width > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vrow) => {
              const start = vrow.index * cols
              const rowSerials = order.slice(start, start + cols)
              return (
                <div
                  key={vrow.key}
                  className="absolute left-0 top-0 flex"
                  style={{
                    transform: `translateY(${vrow.start - virtualizer.options.scrollMargin}px)`,
                    gap: GAP,
                    height: rowHeight,
                  }}
                >
                  {rowSerials.map((serial) => (
                    <GridCell
                      key={serial}
                      serial={serial}
                      rank={ranks?.[serial - 1]}
                      size={cellSize}
                      minted={SHOW_MINTED && minted ? minted.has(serial) : undefined}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
