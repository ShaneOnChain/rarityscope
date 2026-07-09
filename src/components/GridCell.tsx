import Link from 'next/link'
import { memo } from 'react'
import { accentColor, grade } from '@/lib/rarity'
import { ArtImage } from './ArtImage'

/** One gallery tile: art thumb + serial + rank, accent-bordered by rarity band, minted pip. */
export const GridCell = memo(function GridCell({
  serial,
  rank,
  size,
  minted,
}: {
  serial: number
  rank?: number
  size: number
  minted?: boolean
}) {
  const color = rank !== undefined ? accentColor(rank) : 'var(--color-surface-3)'
  const letter = rank !== undefined ? grade(rank).letter : ''
  return (
    <Link
      href={`/nft/${serial}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-surface-0 transition-colors hover:bg-surface-1"
      style={{ width: size, borderColor: 'var(--color-surface-3)' }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <ArtImage serial={serial} w={200} className="h-full w-full object-cover" />
        {letter && (
          <span
            className="absolute right-1 top-1 rounded-md px-1 py-0.5 font-mono text-[10px] font-bold"
            style={{
              color,
              backgroundColor: 'color-mix(in srgb, var(--color-dark) 80%, transparent)',
              border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            }}
          >
            {letter}
          </span>
        )}
        {minted !== undefined && (
          <span
            className="absolute left-1 top-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-dark) 80%, transparent)' }}
            title={minted ? 'minted' : 'still in the pool'}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: minted ? 'var(--color-mint)' : 'transparent', border: minted ? 'none' : '1px solid var(--color-text-muted)' }}
            />
            <span style={{ color: minted ? 'var(--color-mint)' : 'var(--color-text-muted)' }}>{minted ? 'minted' : 'pool'}</span>
          </span>
        )}
      </div>
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className="font-mono text-[11px] text-text-secondary">#{serial}</span>
        <span className="font-mono text-[11px]" style={{ color }}>
          {rank !== undefined ? rank.toLocaleString() : '·'}
        </span>
      </div>
    </Link>
  )
})
