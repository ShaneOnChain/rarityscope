'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadDetail, type Detail } from '@/lib/data'
import { isValidSerial, grade, rarerThan } from '@/lib/rarity'
import { useMethod } from '@/context/MethodContext'
import { CompareForm } from '@/components/CompareForm'
import { ReportCard } from '@/components/ReportCard'

const traitKey = (t: { trait_type: string; value: string }) => `${t.trait_type}:${t.value}`

function useDetail(serial: number | null) {
  const [detail, setDetail] = useState<Detail | null | 'loading'>(serial ? 'loading' : null)
  useEffect(() => {
    if (serial === null) {
      setDetail(null)
      return
    }
    let alive = true
    setDetail('loading')
    loadDetail(serial)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setDetail(null))
    return () => {
      alive = false
    }
  }, [serial])
  return detail
}

function Column({
  serial,
  detail,
  highlight,
}: {
  serial: number | null
  detail: Detail | null | 'loading'
  highlight?: Set<string>
}) {
  if (serial === null)
    return (
      <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-surface-3 p-6 text-center text-text-muted">
        pick a piece to compare
      </div>
    )
  if (detail === 'loading')
    return <div className="animate-pulse-dot rounded-2xl border border-surface-3 p-6 text-text-muted">loading #{serial}…</div>
  if (!detail)
    return <div className="rounded-2xl border border-surface-3 p-6 text-text-secondary">no data for #{serial}.</div>
  return <ReportCard serial={serial} detail={detail} highlight={highlight} showCompareCta={false} />
}

function CompareView() {
  const { method } = useMethod()
  const params = useSearchParams()
  const rawA = params.get('a') ?? ''
  const rawB = params.get('b') ?? ''
  const a = isValidSerial(Number(rawA)) ? Number(rawA) : null
  const b = isValidSerial(Number(rawB)) ? Number(rawB) : null

  const detailA = useDetail(a)
  const detailB = useDetail(b)

  // Traits unique to each side (present here, absent on the other) get highlighted.
  const { hlA, hlB } = useMemo(() => {
    if (detailA === 'loading' || detailB === 'loading' || !detailA || !detailB) return { hlA: undefined, hlB: undefined }
    const keysA = new Set(detailA.traits.map(traitKey))
    const keysB = new Set(detailB.traits.map(traitKey))
    return {
      hlA: new Set(detailA.traits.map(traitKey).filter((k) => !keysB.has(k))),
      hlB: new Set(detailB.traits.map(traitKey).filter((k) => !keysA.has(k))),
    }
  }, [detailA, detailB])

  const bothLoaded = detailA && detailA !== 'loading' && detailB && detailB !== 'loading'
  const rankA = bothLoaded ? (detailA as Detail).ranks[method] : null
  const rankB = bothLoaded ? (detailB as Detail).ranks[method] : null

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 font-display text-2xl font-bold">compare</h1>
      <p className="mb-5 text-text-secondary">two pieces, side by side — see which is rarer before you trade.</p>

      <CompareForm initialA={rawA} initialB={rawB} />

      {rankA !== null && rankB !== null && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-surface-3 bg-surface-0 p-4 text-center">
          <Verdict serial={a!} rank={rankA} winner={rankA <= rankB} />
          <span className="font-display text-text-muted">vs</span>
          <Verdict serial={b!} rank={rankB} winner={rankB <= rankA} />
          <p className="w-full text-sm text-text-secondary">
            {rankA === rankB ? 'same rank' : `#${(rankA < rankB ? a : b)!} is rarer by ${Math.abs(rankA - rankB).toLocaleString()} ranks`}
          </p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Column serial={a} detail={detailA} highlight={hlA} />
        <Column serial={b} detail={detailB} highlight={hlB} />
      </div>
    </div>
  )
}

function Verdict({ serial, rank, winner }: { serial: number; rank: number; winner: boolean }) {
  return (
    <span className="inline-flex flex-col items-center">
      <span className="font-mono text-sm" style={{ color: winner ? 'var(--color-accent)' : undefined }}>
        #{serial} · rank {rank.toLocaleString()}
      </span>
      <span className="text-xs text-text-muted">
        {grade(rank).letter} · rarer than {rarerThan(rank)}%
      </span>
    </span>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-8 text-text-muted">loading…</div>}>
      <CompareView />
    </Suspense>
  )
}
