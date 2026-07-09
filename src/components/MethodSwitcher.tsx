'use client'

import { useState } from 'react'
import { useMethod } from '@/context/MethodContext'
import { METHOD_META } from '@/lib/rarity'

/**
 * MethodSwitcher — a compact segmented control for the active rarity method, with a "?"
 * popover that explains each method in plain language. Hidden when only one method is enabled.
 * Mobile-friendly: the segment strip scrolls horizontally rather than breaking the header.
 */
export function MethodSwitcher() {
  const { method, setMethod, methods } = useMethod()
  const [info, setInfo] = useState(false)

  if (methods.length <= 1) return null

  return (
    <div className="relative flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Rarity method"
        className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-surface-3 bg-surface-0 p-1"
      >
        {methods.map((m) => {
          const active = m === method
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              title={METHOD_META[m].blurb}
              aria-pressed={active}
              className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 font-display text-xs font-semibold transition-colors ${
                active ? 'bg-accent text-dark' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {METHOD_META[m].label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setInfo((v) => !v)}
        aria-label="About the rarity methods"
        aria-expanded={info}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-surface-3 bg-surface-0 font-mono text-xs text-text-muted hover:text-text-primary"
      >
        ?
      </button>

      {info && (
        <>
          {/* click-away backdrop */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setInfo(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Rarity methods explained"
            className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-surface-3 bg-surface-1 p-3 text-left shadow-xl"
          >
            <p className="mb-2 font-display text-xs font-semibold uppercase tracking-wide text-text-muted">
              rarity methods
            </p>
            <ul className="flex flex-col gap-2.5">
              {methods.map((m) => (
                <li key={m}>
                  <p className="font-display text-sm font-semibold text-text-primary">
                    {METHOD_META[m].label}{' '}
                    <span className="font-body text-xs font-normal text-text-muted">· {METHOD_META[m].short}</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-text-secondary">{METHOD_META[m].blurb}</p>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
