import { useEffect, useState } from 'react'

function agoLabel(epochMs: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - epochMs) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

/**
 * Quiet live-feed row — the "Source — X · Updated Xs ago" pattern used by
 * market-analysis cards. Ticks every 30s; when `updatedAt` is null (no data
 * has arrived yet) it shows an honest note instead of a timestamp.
 */
export function LiveDataStatus({
  source,
  updatedAt,
  note,
}: {
  source: string
  updatedAt: number | null
  note?: string
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
      <span aria-hidden className="relative flex size-1.5">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
            updatedAt ? 'bg-positive' : 'bg-muted/50'
          }`}
        />
        <span className={`relative inline-flex size-1.5 rounded-full ${updatedAt ? 'bg-positive' : 'bg-muted/50'}`} />
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
