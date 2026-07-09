'use client'

import { useEffect, useState } from 'react'
import { TOTAL } from '@/lib/rarity'
import { config } from '@/config'

type Stats = {
  minted: number | null
  total: number
  mint_price_xrp: number | null
  floor_xrp: number | null
  n_listings: number | null
  updated_at: string
}

const REFRESH_MS = 180_000

function Stat({ label, value, live = false }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1.5 text-text-muted text-[11px] uppercase tracking-wide">
        {live && <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />}
        {label}
      </span>
      <span className="font-mono text-base text-text-primary">{value}</span>
    </div>
  )
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!config.features.liveStats) return
    let alive = true
    const pull = () =>
      fetch('/api/stats')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Stats) => {
          if (alive) {
            setStats(d)
            setFailed(false)
          }
        })
        .catch(() => {
          if (alive) setFailed(true)
        })
    pull()
    const id = setInterval(pull, REFRESH_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const fmt = (n: number | null | undefined, suffix = '') =>
    n === null || n === undefined ? '—' : `${n.toLocaleString()}${suffix}`

  // Self-guard: collections without a live marketplace feed hide this bar entirely.
  if (!config.features.liveStats) return null

  const minted = stats?.minted ?? null
  const floor = stats?.floor_xrp ?? null
  const mintPrice = stats?.mint_price_xrp ?? null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-surface-3 bg-surface-0 p-4 sm:grid-cols-4">
      <Stat label="floor (buy now)" value={floor === null ? (failed ? 'unavailable' : '…') : `${floor} XRP`} live={floor !== null} />
      <Stat
        label="minted"
        value={minted === null ? (failed ? 'unavailable' : '…') : `${fmt(minted)} / ${TOTAL.toLocaleString()}`}
        live={minted !== null}
      />
      <Stat label="mint price" value={mintPrice === null ? '—' : `${mintPrice} XRP`} />
      <Stat label="supply" value={TOTAL.toLocaleString()} />
    </div>
  )
}
