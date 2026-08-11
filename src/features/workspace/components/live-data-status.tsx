import { useEffect, useState } from 'react'

import type { Freshness } from '@/features/markets/services/market-router'

function agoLabel(epochMs: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - epochMs) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

/**
 * Honest freshness styling — LIVE (green pulse), RECENT (quiet), STALE
 * (amber advisory) or UNAVAILABLE (muted). Derived from the actual candle
 * data timestamp, never from the fetch time.
 */
const freshnessMeta: Record<Freshness, { label: string; chip: string; dot: string }> = {
  live: { label: 'Live', chip: 'border-positive/25 bg-positive/10 text-positive', dot: 'bg-positive' },
  recent: { label: 'Recent', chip: 'border-border bg-tint/[0.06] text-muted', dot: 'bg-tint/60' },
  stale: { label: 'Stale', chip: 'border-warning/25 bg-warning/10 text-warning', dot: 'bg-warning' },
  unavailable: { label: 'Unavailable', chip: 'border-border bg-tint/[0.06] text-faint', dot: 'bg-muted/50' },
}

/**
 * Quiet live-feed row — the "Source — X · Updated Xs ago" pattern used by
 * market-analysis cards. `updatedAt` is the honest data timestamp (newest
 * closed candle, not fetch time) so the age claim matches the data's real
 * freshness. Ticks every 30s; when `updatedAt` is null (no data has arrived
 * yet) it shows an honest note instead of a timestamp.
 */
export function LiveDataStatus({
  source,
  updatedAt,
  freshness,
  note,
}: {
  source: string
  updatedAt: number | null
  freshness?: Freshness
  note?: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const meta = freshness ? freshnessMeta[freshness] : null
  const live = freshness === 'live'

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
      {meta && (
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${meta.chip}`}
        >
          {meta.label}
        </span>
      )}
      <span aria-hidden className="relative flex size-1.5">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${
            live ? 'animate-ping opacity-60' : 'opacity-100'
          } ${meta?.dot ?? (updatedAt ? 'bg-positive' : 'bg-muted/50')}`}
        />
        <span className={`relative inline-flex size-1.5 rounded-full ${meta?.dot ?? (updatedAt ? 'bg-positive' : 'bg-muted/50')}`} />
      </span>
      <span>
        Source — <span className="text-muted">{source}</span>
      </span>
      <span aria-hidden className="text-tint/40">
        ·
      </span>
      <span>{updatedAt ? `Updated ${agoLabel(updatedAt, now)}` : (note ?? 'Waiting for data')}</span>
    </div>
  )
}
