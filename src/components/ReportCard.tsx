'use client'

import Link from 'next/link'
import type { Detail } from '@/lib/data'
import { config } from '@/config'
import { grade, rarerThan, accentColor, TOTAL, DISPLAY_NAME, METHODS, METHOD_META } from '@/lib/rarity'
import { useMethod } from '@/context/MethodContext'
import { ArtImage } from './ArtImage'
import { GradeBadge } from './GradeBadge'
import { TraitList } from './TraitList'

/**
 * Full rarity report card for one piece. Mirrors the Discord /rarity embed (rank, grade,
 * "rarer than %", accent color) but shows the FULL trait breakdown instead of only the top 6.
 * The headline rank/grade tracks the ACTIVE method (useMethod); a muted row underneath shows the
 * same piece's rank under every OTHER enabled method — one piece, seen under every system at once.
 * Presentational — the parent supplies the already-loaded detail.
 */
export function ReportCard({
  serial,
  detail,
  highlight,
  minted,
  showCompareCta = true,
  priority = false,
}: {
  serial: number
  detail: Detail
  highlight?: Set<string>
  minted?: boolean
  showCompareCta?: boolean
  priority?: boolean
}) {
  const { method } = useMethod()
  const { traits } = detail
  const rank = detail.ranks[method]
  const color = accentColor(rank)
  const g = grade(rank)
  const otherMethods = METHODS.filter((m) => m !== method)

  return (
    <article className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-2xl border bg-surface-0"
        style={{ borderColor: `color-mix(in srgb, ${color} 33%, transparent)` }}
      >
        <ArtImage serial={serial} w={512} priority={priority} className="w-full aspect-square object-cover" />
      </div>

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">
            {DISPLAY_NAME} <span className="font-mono">#{serial.toLocaleString()}</span>
          </h2>
          <GradeBadge rank={rank} />
        </div>
        <p className="font-mono text-lg">
          rank <span style={{ color }}>{rank.toLocaleString()}</span>
          <span className="text-text-muted"> / {TOTAL.toLocaleString()}</span>
        </p>
        <p className="text-text-secondary text-sm">
          rarer than {rarerThan(rank)}% of the collection · grade {g.letter} <span className="text-text-muted">({g.label})</span>
        </p>
        {otherMethods.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs uppercase tracking-wide text-text-muted">under other methods</span>
            {otherMethods.map((m) => (
              <span
                key={m}
                className="rounded-md border border-surface-3 px-1.5 py-0.5 font-mono text-xs text-text-muted"
              >
                {METHOD_META[m].label} #{detail.ranks[m].toLocaleString()}
              </span>
            ))}
          </div>
        )}
        {minted !== undefined && (
          <p className="flex items-center gap-1.5 text-sm">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: minted ? 'var(--color-mint)' : 'transparent', border: minted ? 'none' : '1px solid var(--color-text-muted)' }}
            />
            <span style={{ color: minted ? 'var(--color-mint)' : 'var(--color-text-muted)' }}>
              {minted ? 'minted' : 'still in the mint pool'}
            </span>
          </p>
        )}
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-sm font-semibold text-text-secondary uppercase tracking-wide">
          traits <span className="text-text-muted normal-case">· rarest first</span>
        </h3>
        <TraitList traits={traits} highlight={highlight} />
      </section>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {showCompareCta && (
          <Link href={`/compare?a=${serial}`} className="text-accent hover:underline">
            compare this →
          </Link>
        )}
        <a href={config.marketplace.collectionUrl} target="_blank" rel="noopener noreferrer" className="text-mint hover:underline">
          view on {config.marketplace.name} ↗
        </a>
      </footer>
    </article>
  )
}
