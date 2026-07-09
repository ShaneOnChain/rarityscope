'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadSummary, type Summary } from '@/lib/data'
import { isValidSerial, TOTAL, DISPLAY_NAME } from '@/lib/rarity'
import { useMethod } from '@/context/MethodContext'
import { ArtImage } from './ArtImage'
import { GradeBadge } from './GradeBadge'

/**
 * Serial search. Typing a valid 1..total shows an instant preview chip (thumb + rank + grade)
 * with no network (ranks are already in memory); Enter opens the full report. The rank shown
 * follows the active rarity method.
 */
export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter()
  const { method } = useMethod()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSummary().then(setSummary).catch(() => {})
  }, [])

  const serial = raw ? Number(raw) : NaN
  const valid = isValidSerial(serial)
  const ranks = summary?.ranks[method]
  const rank = valid && ranks ? ranks[serial - 1] : undefined

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!raw) return
    if (!valid) {
      setError(`${DISPLAY_NAME} only goes 1–${TOTAL.toLocaleString()}.`)
      return
    }
    router.push(`/nft/${serial}`)
  }

  return (
    <div className="w-full">
      <form onSubmit={submit} className="flex gap-2">
        <input
          ref={inputRef}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))
            setError('')
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus={autoFocus}
          enterKeyHint="search"
          aria-label={`Search a ${DISPLAY_NAME} serial (1 to ${TOTAL.toLocaleString()})`}
          placeholder={`Search serial 1–${TOTAL.toLocaleString()}`}
          className="min-w-0 flex-1 rounded-xl border border-surface-3 bg-surface-0 px-4 py-3 font-mono text-base text-text-primary placeholder:text-text-muted focus:border-accent outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-accent px-4 py-3 font-display font-semibold text-dark hover:opacity-90 active:opacity-80"
        >
          Search
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-accent-2">{error}</p>}

      {valid && rank !== undefined && (
        <Link
          href={`/nft/${serial}`}
          className="animate-fade-in mt-3 flex items-center gap-3 rounded-xl border border-surface-3 bg-surface-0 p-2 pr-4 hover:border-accent/40"
        >
          <ArtImage serial={serial} w={96} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="font-mono text-sm">
              #{serial.toLocaleString()} · rank {rank.toLocaleString()}
            </p>
            <div className="mt-0.5">
              <GradeBadge rank={rank} size="sm" />
            </div>
          </div>
          <span className="ml-auto text-accent text-sm">view →</span>
        </Link>
      )}
    </div>
  )
}
