import { useMemo } from 'react'

import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { surfaceSource } from '@/features/markets/services/market-router'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import type { LiquidityTimeframe } from '../data'
import { LiveDataStatus } from './live-data-status'

/** Human label for a model source id, e.g. 'swing_high' → 'Swing high'. */
function humanSource(source: string): string {
  return source
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

/**
 * Forge Liquidity ladder — the detected liquidity zones from the Liquidity
 * Model rendered as a premium vertical read anchored to the chart card:
 * buy-side pools above the spot line, sell-side below, positioned by real
 * price. Emphasis follows the model's rank (high > medium > low); swept
 * zones are dashed and tagged. The TradingView embed exposes no programmatic
 * drawing API, so this overlay lives inside the same card, keyed to the
 * same model output and timeframe as the chart.
 */
export function LiquidityLadder({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const { status, analysis, message, provider, symbol, dataAt, freshness } =
    useMarketIntelligence(coin, timeframe.id)
  const ready = status === 'ready' && analysis && !analysis.insufficient

  const ladder = useMemo(() => {
    if (!ready || !analysis) return null
    const zones = [...analysis.liquidity.buySide, ...analysis.liquidity.sellSide]
      // Meaningful zones only — high/medium rank, or swept (they tell a story).
      .filter((zone) => zone.rank !== 'low' || zone.swept)
      .sort((a, b) => a.distancePercent - b.distancePercent)
      .slice(0, 6)
    if (zones.length === 0) return { zones: [], min: 0, max: 0, spot: 0 }
    const prices = zones.map((zone) => zone.price).concat(analysis.currentPrice)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const pad = (max - min) * 0.08 || Math.max(max * 0.001, 1)
    return { zones, min: min - pad, max: max + pad, spot: analysis.currentPrice }
  }, [ready, analysis])

  return (
    <div className="border-t border-border px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-1.5 rounded-full bg-tint/50" />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Forge liquidity</span>
        </div>
        <span className="rounded-full border border-border bg-tint/[0.04] px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted">
          {timeframe.id}
        </span>
      </div>

      {!ready || !ladder ? (
        <div className="mt-3 h-[88px] sm:h-[104px]">
          {status === 'loading' ? (
            <div aria-hidden className="flex h-full animate-pulse flex-col justify-center gap-2.5">
              <div className="h-2 w-3/5 rounded-full bg-tint/[0.07]" />
              <div className="h-px bg-tint/[0.06]" />
              <div className="h-2 w-2/5 rounded-full bg-tint/[0.07]" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <p className="text-xs leading-relaxed text-muted">
                {message ?? 'No liquidity analysis available for this timeframe.'}
              </p>
            </div>
          )}
        </div>
      ) : ladder.zones.length === 0 ? (
        <div className="mt-3 flex h-[88px] items-center justify-center sm:h-[104px]">
          <p className="text-xs text-muted">No significant zones detected on this window.</p>
        </div>
      ) : (
        <div className="relative mt-3 h-[88px] select-none sm:h-[104px]">
          {ladder.zones.map((zone) => {
            const ratio = (ladder.max - zone.price) / (ladder.max - ladder.min) || 0
            const top = `calc(${Math.min(94, Math.max(4, ratio * 100))}%)`
            const isBuy = zone.side === 'buy'
            const lineWeight = zone.rank === 'high' ? 'h-[2px]' : 'h-px'
            const lineOpacity = zone.swept ? 'opacity-30' : zone.rank === 'high' ? 'opacity-90' : zone.rank === 'medium' ? 'opacity-60' : 'opacity-40'
            return (
              <div
                key={`${zone.side}-${zone.price}`}
                className="absolute left-0 right-0 -translate-y-1/2"
                style={{ top }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums tracking-tight',
                      isBuy ? 'text-positive' : 'text-negative',
                    )}
                  >
                    {formatMarketPrice(zone.price)}
                  </span>
                  <span className="hidden truncate text-[10px] text-muted sm:inline">
                    {humanSource(zone.source)}
                    {zone.touches > 1 ? ` · ${zone.touches}×` : ''}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'h-px flex-1 rounded-full',
                      isBuy ? 'bg-positive' : 'bg-negative',
                      lineWeight,
                      lineOpacity,
                      zone.swept && 'border-t border-dashed border-current bg-transparent',
                    )}
                  />
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-faint">
                    {zone.rank}
                    {zone.swept ? ' · swept' : ''}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Spot reference line. */}
          <div
            className="absolute inset-x-0 z-10 -translate-y-1/2"
            style={{
              top: `calc(${Math.min(94, Math.max(4, ((ladder.max - ladder.spot) / (ladder.max - ladder.min)) * 100))}%)`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {formatMarketPrice(ladder.spot)}
              </span>
              <span aria-hidden className="h-px flex-1 border-t border-dashed border-tint/50" />
              <span className="text-[9px] uppercase tracking-wider text-faint">spot</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-1">
        <LiveDataStatus
          source={surfaceSource(coin, provider, symbol, analysis?.candleGranularity ?? null)}
          updatedAt={ready ? dataAt : null}
          freshness={ready ? freshness : undefined}
          note={status === 'loading' ? 'Calculating…' : status === 'insufficient' ? (message ?? 'No data') : 'Awaiting historical feed'}
        />
      </div>
    </div>
  )
}
