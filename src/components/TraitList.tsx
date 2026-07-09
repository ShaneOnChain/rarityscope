import type { Trait } from '@/lib/data'
import { TOTAL } from '@/lib/rarity'

/**
 * Full trait breakdown, rarest-first. Every populated trait for the piece (none/noname/normal
 * are filtered at build time). A 1-of-1 gets a trophy. `highlight` marks traits the compare
 * view found unique to this side.
 */
export function TraitList({
  traits,
  highlight,
}: {
  traits: Trait[]
  highlight?: Set<string>
}) {
  if (!traits.length) {
    return (
      <p className="text-text-secondary text-sm">
        this piece is made of the collection&apos;s common traits — still 1 of {TOTAL.toLocaleString()}.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {traits.map((t) => {
        const key = `${t.trait_type}:${t.value}`
        const isOne = t.count === 1
        const marked = highlight?.has(key)
        return (
          <li
            key={key}
            className={`flex items-baseline justify-between gap-3 rounded-lg border px-3 py-2 ${
              marked ? 'border-accent/40 bg-accent-soft' : 'border-surface-3 bg-surface-0'
            }`}
          >
            <span className="min-w-0">
              <span className="text-text-muted text-xs uppercase tracking-wide">{t.trait_type}</span>
              <span className="block truncate text-text-primary">
                {t.value}
                {isOne && <span className="ml-1.5 text-accent" title="1 of 1">🏆 1-of-1</span>}
              </span>
            </span>
            <span className="shrink-0 text-right font-mono text-sm">
              <span className={isOne ? 'text-accent' : 'text-text-secondary'}>{t.pct}%</span>
              <span className="block text-text-muted text-xs">
                {t.count.toLocaleString()}/{TOTAL.toLocaleString()}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
