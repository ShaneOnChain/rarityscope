import { grade, accentColor } from '@/lib/rarity'

/** Grade pill colored by rank band, optionally with its label. Letters come from grade(). */
export function GradeBadge({
  rank,
  showLabel = true,
  size = 'md',
}: {
  rank: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const g = grade(rank)
  const color = accentColor(rank)
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2.5 py-1 text-sm'

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-md font-mono font-bold ${pad}`}
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 33%, transparent)` }}
      >
        {g.letter}
      </span>
      {showLabel && <span className="text-text-secondary text-sm">{g.label}</span>}
    </span>
  )
}
