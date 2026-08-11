import { formatMarketPrice } from '@/features/markets/lib/format'
import type { TimeframeAnalysis } from '@/features/markets/services/market-intelligence'
import type { Candle } from '@/features/markets/services/history'
import type { Coin } from '@/features/markets/types'
import { formatChange, formatCompact } from '@/lib/format'
import type { LiquidityTimeframe, Tone } from '@/features/workspace/data'

import type { MarketContextSnapshot } from '../types'

/** Human label for a model source id, e.g. 'swing_high' → 'Swing high'. */
function humanSource(source: string): string {
  return source
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

function toneFor(trend: string): Tone {
  return trend === 'bullish' ? 'positive' : trend === 'bearish' ? 'negative' : 'neutral'
}

/** Window return from real closes — (last close − previous close) / previous close. */
function windowReturnFromCandles(candles: Candle[] | null): string {
  if (!candles || candles.length < 2) return '—'
  const previous = candles[candles.length - 2].close
  const last = candles[candles.length - 1].close
  if (!Number.isFinite(previous) || previous <= 0) return '—'
  const change = ((last - previous) / previous) * 100
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
}

function formatLevel(zone: { price: number; zoneLow: number; zoneHigh: number; rank: string; swept: boolean } | undefined): string {
  if (!zone) return '—'
  const band = zone.zoneHigh !== zone.zoneLow ? ` ${formatMarketPrice(zone.zoneLow)}–${formatMarketPrice(zone.zoneHigh)}` : ''
  return `${formatMarketPrice(zone.price)}${band} · ${zone.rank[0].toUpperCase()}${zone.rank.slice(1)}${zone.swept ? ' · swept' : ''}`
}

/**
 * The exact market read Oracle is working from — the Market Context sheet
 * displays this. Built from the Forge Liquidity Model output (the same
 * deterministic engine as the Liquidity Snapshot) plus the real candle
 * series: no mock figures, no second detector. When the model has no usable
 * data for the window, `unavailable` is true and the numeric reads are
 * honest dashes.
 */
export function buildMarketContext(
  coin: Coin,
  timeframe: LiquidityTimeframe,
  analysis: TimeframeAnalysis | null,
  candles: Candle[] | null,
  fetchedAt: number | null,
  source: string,
): MarketContextSnapshot {
  const ready = analysis !== null && !analysis.insufficient
  const structure = analysis?.structure
  const momentum = analysis?.momentum
  const buy = analysis?.liquidity.buySide[0]
  const sell = analysis?.liquidity.sellSide[0]
  const support = analysis?.support[0]
  const resistance = analysis?.resistance[0]

  return {
    coinId: coin.id,
    name: coin.name,
    ticker: coin.ticker,
    timeframeId: timeframe.id,
    price: formatMarketPrice(coin.price),
    change24h: formatChange(coin.change24h),
    windowReturn: ready ? windowReturnFromCandles(candles) : '—',
    trend: !ready ? '—' : structure!.trend === 'bullish' ? 'Bullish' : structure!.trend === 'bearish' ? 'Bearish' : 'Sideways',
    trendTone: !ready ? 'neutral' : toneFor(structure!.trend),
    structure: !ready ? '—' : structure!.label,
    momentum: !ready || !momentum ? '—' : `${momentum.state} · ${momentum.direction}`,
    volume: coin.volume24h === null ? '—' : `$${formatCompact(coin.volume24h)}`,
    buyLiquidity: formatLevel(buy),
    sellLiquidity: formatLevel(sell),
    support: support ? formatMarketPrice(support.price) : '—',
    resistance: resistance ? formatMarketPrice(resistance.price) : '—',
    zones: ready
      ? [...analysis!.liquidity.buySide, ...analysis!.liquidity.sellSide].map((zone) => ({
          side: zone.side,
          price: zone.price,
          zoneLow: zone.zoneLow,
          zoneHigh: zone.zoneHigh,
          source: humanSource(zone.source),
          rank: zone.rank,
          strength: zone.strength,
          touches: zone.touches,
          swept: zone.swept,
          distancePercent: zone.distancePercent,
        }))
      : [],
    sweeps: ready
      ? analysis!.sweeps.map((sweep) => ({
          side: sweep.side,
          direction: sweep.direction,
          sweepPrice: sweep.sweepPrice,
          returned: sweep.returned,
        }))
      : [],
    granularity: analysis?.candleGranularity ?? '',
    source,
    unavailable: !ready,
    updatedAt: fetchedAt ?? Date.now(),
  }
}
