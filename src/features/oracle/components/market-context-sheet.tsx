import { useEffect, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { cn } from '@/lib/cn'
import { liquidityTimeframes, type LiquidityTimeframeId } from '@/features/workspace/data'

import type { MarketContextSnapshot } from '../types'
import { SheetShell } from './sheet-shell'

/* ------------------------------------------------------------------ */
/* Relative \"last updated\" clock                                      */
/* ------------------------------------------------------------------ */

function relativeLabel(from: number, to: number): string {
  const sec = Math.max(0, Math.round((to - from) / 1000))
  if (sec < 5) return 'just now'
  if (sec < 60) return `${sec} sec ago`
  const min = Math.floor(sec / 60)
  return min < 60 ? `${min} min ago` : 'a while ago'
}

function useNow(intervalMs = 5000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

function Row({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', className)}>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  )
}

function Value({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span
      className={cn(
        'text-[13px] text-foreground',
        mono && 'font-mono text-sm tabular-nums tracking-tight',
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

/** Compact price label for a detected zone (band shown when it spans). */
function formatPrice(zone: { price: number; zoneLow: number; zoneHigh: number }): string {
  return zone.zoneHigh !== zone.zoneLow
    ? `${formatMarketPrice(zone.zoneLow)}–${formatMarketPrice(zone.zoneHigh)}`
    : formatMarketPrice(zone.price)
}

interface MarketContextSheetProps {
  open: boolean
  onClose: () => void
  /** The exact read Oracle is working from right now. */
  snapshot: MarketContextSnapshot
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
}

/**
 * The full market-context readout — exactly what Oracle is analyzing.
 * Bottom sheet on mobile, right-side panel on desktop.
 */
export function MarketContextSheet({
  open,
  onClose,
  snapshot,
  timeframeId,
  onTimeframeChange,
}: MarketContextSheetProps) {
  const now = useNow()
  const updated = relativeLabel(snapshot.updatedAt, now)

  return (
    <SheetShell
      open={open}
      onClose={onClose}
      label="Market context"
      title={
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">Market Context</p>
          <p className="mt-0.5 text-[11px] text-faint">What Oracle is reading right now</p>
        </div>
      }
    >
      <div className="rounded-panel border border-border bg-tint/[0.02] px-4">
        <Row label="Asset">
          <Value>
            {snapshot.name} <span className="text-faint">· {snapshot.ticker}</span>
          </Value>
        </Row>

        {/* Timeframe gets its own stacked row so the full selector fits
            on narrow screens without truncation. Negative margins bleed
            the scroller to the card edges for maximum width. */}
        <div className="border-t border-border py-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            Timeframe
          </span>
          <div className="-mx-4 mt-2 overflow-x-auto px-4 pb-0.5">
            <SegmentedControl
              size="sm"
              options={liquidityTimeframes.map((tf) => ({ value: tf.id, label: tf.id }))}
              value={timeframeId}
              onChange={onTimeframeChange}
            />
          </div>
        </div>

        <Row label="Price" className="border-t border-border">
          <Value mono>{snapshot.price}</Value>
          <span className="ml-2 font-mono text-[11px] tabular-nums text-muted">{snapshot.change24h}</span>
        </Row>

        <Row label="Window" className="border-t border-border">
          <Value mono>{snapshot.windowReturn}</Value>
        </Row>

        <Row label="Trend" className="border-t border-border">
          <Badge variant={snapshot.trendTone} size="sm">
            {snapshot.trend}
          </Badge>
        </Row>

        <Row label="Market Structure" className="border-t border-border">
          <Value>{snapshot.structure}</Value>
        </Row>

        <Row label="Momentum" className="border-t border-border">
          <Value>{snapshot.momentum}</Value>
        </Row>

        <Row label="Volume" className="border-t border-border">
          <Value>{snapshot.volume}</Value>
        </Row>

        <Row label="Nearest Buy Liquidity" className="border-t border-border">
          <Value mono>{snapshot.buyLiquidity}</Value>
        </Row>

        <Row label="Nearest Sell Liquidity" className="border-t border-border">
          <Value mono>{snapshot.sellLiquidity}</Value>
        </Row>

        <Row label="Support" className="border-t border-border">
          <Value mono>{snapshot.support}</Value>
        </Row>

        <Row label="Resistance" className="border-t border-border">
          <Value mono>{snapshot.resistance}</Value>
        </Row>

        {snapshot.zones.length > 0 && (
          <div className="border-t border-border py-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              Detected liquidity zones · {snapshot.granularity}
            </span>
            <ul className="mt-2 space-y-1.5">
              {snapshot.zones.map((zone, index) => {
                const isBuy = zone.side === 'buy'
                return (
                  <li key={`${zone.side}-${zone.price}-${index}`} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className={`size-1.5 shrink-0 rounded-full ${isBuy ? 'bg-positive' : 'bg-negative'}`}
                      />
                      <span className="truncate text-muted">
                        {isBuy ? 'Buy-side' : 'Sell-side'} · {zone.source}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 font-mono text-[12px] tabular-nums text-foreground/80">
                      {formatPrice(zone)}
                      <span className="text-[10px] uppercase tracking-wide text-faint">
                        {zone.rank}
                        {zone.swept ? ' · swept' : ''}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {snapshot.sweeps.length > 0 && (
          <div className="border-t border-border py-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
              Sweeps detected
            </span>
            <ul className="mt-2 space-y-1.5">
              {snapshot.sweeps.map((sweep, index) => (
                <li key={index} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-muted">
                    {sweep.side === 'buy' ? 'Buy-side' : 'Sell-side'} swept {sweep.direction}
                    {sweep.returned ? ' · price returned' : ''}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-foreground/80">
                    {formatMarketPrice(sweep.sweepPrice)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Row label="Last Updated" className="border-t border-border">
          <span className="text-[11px] tabular-nums text-muted">{updated}</span>
        </Row>
      </div>

      {snapshot.unavailable ? (
        <p className="mt-4 text-center text-[10px] leading-relaxed text-faint">
          No liquidity analysis available for this timeframe — the provider has no usable candle
          history for it. Live prices are unaffected.
        </p>
      ) : (
        <p className="mt-4 text-center text-[10px] leading-relaxed text-faint">
          Forge Liquidity Model · {snapshot.source} — deterministic, from real candles.
        </p>
      )}
    </SheetShell>
  )
}
