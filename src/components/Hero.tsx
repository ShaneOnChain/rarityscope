import { ArtImage } from './ArtImage'
import { TOTAL } from '@/lib/rarity'
import { config } from '@/config'

// Standout pieces for the decorative landing strip — configured per collection.
const FEATURED = config.display.featuredSerials

export function Hero() {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
          {TOTAL.toLocaleString()} pieces · ranked every way
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
          <span className="text-gradient-accent">{config.branding.siteTitle}</span>
        </h1>
        <p className="max-w-xl text-text-secondary">
          Search any piece to see its rank and full trait breakdown, browse all {TOTAL.toLocaleString()},
          and compare two side by side before you trade.
        </p>
      </div>

      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {FEATURED.map((s, i) => (
          <div
            key={s}
            className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0"
            style={{ opacity: i > 3 ? 0.5 : 1 }}
          >
            <ArtImage serial={s} w={200} priority={i < 3} className="h-20 w-20 object-cover sm:h-24 sm:w-24" />
          </div>
        ))}
      </div>
    </section>
  )
}
