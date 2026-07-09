'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidSerial, TOTAL } from '@/lib/rarity'

/** Two serial inputs (A / B) that push /compare?a=&b= on submit. Prefilled from the URL. */
export function CompareForm({ initialA, initialB }: { initialA: string; initialB: string }) {
  const router = useRouter()
  const [a, setA] = useState(initialA)
  const [b, setB] = useState(initialB)

  useEffect(() => setA(initialA), [initialA])
  useEffect(() => setB(initialB), [initialB])

  const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 5)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const qs = new URLSearchParams()
    if (a) qs.set('a', a)
    if (b) qs.set('b', b)
    router.push(`/compare?${qs.toString()}`)
  }

  const field = (label: string, value: string, set: (v: string) => void) => {
    const n = value ? Number(value) : NaN
    const bad = value !== '' && !isValidSerial(n)
    return (
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-text-muted">{label}</span>
        <input
          value={value}
          onChange={(e) => set(clean(e.target.value))}
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder={`1–${TOTAL.toLocaleString()}`}
          aria-label={`${label} serial`}
          className={`w-full rounded-xl border bg-surface-0 px-4 py-3 font-mono text-base outline-none ${
            bad ? 'border-accent-2' : 'border-surface-3 focus:border-accent'
          }`}
        />
      </label>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        {field('piece A', a, setA)}
        <span className="pb-3 font-display text-text-muted">vs</span>
        {field('piece B', b, setB)}
      </div>
      <button
        type="submit"
        className="self-start rounded-xl bg-accent px-5 py-2.5 font-display font-semibold text-dark hover:opacity-90 active:opacity-80"
      >
        Compare
      </button>
    </form>
  )
}
