import { motion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Flame,
  MoveHorizontal,
  Shield,
  TrendingDown,
  TrendingUp,
  WifiOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ease } from '@/design/motion'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { LevelCandidate, LiquidityCandidate } from '@/features/markets/services/market-intelligence'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import { liquidityTimeframes, type LiquidityTimeframeId } from '../data'
import { LiveDataStatus } from './live-data-status'
import { SectionHeading } from './section-heading'

const icons: Record<'buy' | 'sell' | 'support' | 'resistance', LucideIcon> = {
  buy: ArrowDownToLine,
  sell: ArrowUpFromLine,
  support: Shield,
  resistance: Flame,
}

/** 'swing_high' → 'Swing high', 'previous_4h_high' → 'Previous 4h high' … */
function humanSource(source: string): string {
  return source
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

interface CardData {
  label: string
  icon: 'buy' | 'sell' | 'support' | 'resistance' | 'trend'
  value: string
  caption: string
  tone: 'positive' | 'negative' | 'neutral'
  details?: Array<{ label: string; value: string }>
}

function levelDetails(level: LevelCandidate | LiquidityCandidate): Array<{ label: string; value: string }> {
  const details = [
    { label: 'Source', value: humanSource(level.source) },
    { label: 'Strength', value: `${Math.round(level.strength * 100)}%` },
  ]
  if ('touches' in level && level.touches > 1) details.push({ label: 'Tests', value: `${level.touches}` })
  if ('rank' in level) details.push({ label: 'Rank', value: level.rank[0].toUpperCase() + level.rank.slice(1) })
  if ('zoneLow' in level && level.zoneHigh !== level.zoneLow) {
    details.push({
      label: 'Zone',
      value: `${formatMarketPrice(level.zoneLow)} – ${formatMarketPrice(level.zoneHigh)}`,
    })
  }
  if ('swept' in level && level.swept) details.push({ label: 'State', value: 'Swept' })
  return details
}

function buildCards(analysis: NonNullable<ReturnType<typeof useMarketIntelligence>['analysis']>): CardData[] {
  const { liquidity, support, resistance, structure, momentum } = analysis
  const buy = liquidity.buySide[0]
  const sell = liquidity.sellSide[0]
  const sup = support[0]
  const res = resistance[0]

  const trendTone: CardData['tone'] =
    structure?.trend === 'bullish' ? 'positive' : structure?.trend === 'bearish' ? 'negative' : 'neutral'
  const momentumCaption = momentum
    ? `Momentum ${momentum.state} · ${momentum.direction}`
    : structure
      ? structure.label
      : 'Insufficient data'

  return [
    {
      label: 'Nearest Buy Liquidity',
      icon: 'buy',
      value: buy ? formatMarketPrice(buy.price) : '—',
      caption: buy ? `${buy.distancePercent.toFixed(2)}% above spot` : 'No significant buy-side pool',
      tone: 'neutral',
      details: buy ? levelDetails(buy) : undefined,
    },
    {
      label: 'Nearest Sell Liquidity',
      icon: 'sell',
      value: sell ? formatMarketPrice(sell.price) : '—',
      caption: sell ? `${sell.distancePercent.toFixed(2)}% below spot` : 'No significant sell-side pool',
      tone: 'neutral',
      details: sell ? levelDetails(sell) : undefined,
    },
    {
      label: 'Strong Support',
      icon: 'support',
      value: sup ? formatMarketPrice(sup.price) : '—',
      caption: sup ? `${sup.distancePercent.toFixed(2)}% below spot` : 'No significant support',
      tone: 'neutral',
      details: sup ? levelDetails(sup) : undefined,
    },
    {
      label: 'Strong Resistance',
      icon: 'resistance',
      value: res ? formatMarketPrice(res.price) : '—',
      caption: res ? `${res.distancePercent.toFixed(2)}% above spot` : 'No significant resistance',
      tone: 'neutral',
      details: res ? levelDetails(res) : undefined,
    },
    {
      label: 'Trend',
      icon: 'trend',
      value: structure?.trend === 'bullish' ? 'Uptrend' : structure?.trend === 'bearish' ? 'Downtrend' : 'Sideways',
      caption: structure ? momentumCaption : 'Insufficient data',
      tone: trendTone,
    },
  ]
}

function LiquidityCard({ item }: { item: CardData }) {
  const Icon =
    item.icon === 'trend'
      ? item.tone === 'negative'
        ? TrendingDown
        : item.tone === 'positive'
          ? TrendingUp
          : MoveHorizontal
      : icons[item.icon]

  return (
    <GlassCard padding="sm" className="flex min-h-28 flex-col justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-tint/[0.05]">
          <Icon size={14} strokeWidth={1.75} className="text-muted" />
        </span>
        <p className="text-[11px] font-medium leading-tight text-muted">{item.label}</p>
      </div>
      <div>
        <p
          className={cn(
            'font-mono text-lg tabular-nums tracking-tight',
            item.tone === 'positive' && 'text-positive',
            item.tone === 'negative' && 'text-negative',
            item.tone === 'neutral' && 'text-foreground',
          )}
        >
          {item.value}
        </p>
        {item.details?.map((detail) => (
          <div key={detail.label} className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-faint">{detail.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-foreground/80">{detail.value}</span>
          </div>
        ))}
        <p className="mt-0.5 text-[11px] text-faint">{item.caption}</p>
      </div>
    </GlassCard>
  )
}

function LiquiditySkeleton() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2" aria-hidden>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-28 animate-pulse flex-col justify-between gap-3 rounded-hero border border-border bg-tint/[0.03] p-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-tint/[0.07]" />
            <div className="h-2.5 w-24 rounded-full bg-tint/[0.07]" />
          </div>
          <div>
            <div className="h-4 w-20 rounded-full bg-tint/[0.07]" />
            <div className="mt-2 h-2 w-16 rounded-full bg-tint/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Honest state when the provider can't supply this window's candles. */
function LiquidityEmpty({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-panel border border-dashed border-border px-6 py-8 text-center">
      <WifiOff size={18} strokeWidth={1.5} className="text-faint" />
      <p className="mt-3 text-sm font-medium text-foreground">No analysis for this window</p>
      <p className="mt-1 max-w-60 text-xs leading-relaxed text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:bg-tint/[0.05] hover:text-foreground"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/**
 * Forge's signature depth view — where liquidity actually sits, per window.
 * Every level is computed by the Market Intelligence Engine from real
 * CoinGecko OHLC candles: swing/equal/range/previous-period highs and lows
 * with deterministic significance filtering. Unsupported windows show an
 * honest empty state instead of fabricated numbers.
 */
export function LiquiditySnapshot({
  coin,
  timeframeId,
  onTimeframeChange,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
}) {
  const { status, analysis, message, fetchedAt, refresh } = useMarketIntelligence(coin, timeframeId)
  const items = analysis ? buildCards(analysis) : []

  return (
    <section>
      <SectionHeading eyebrow="04 — Depth" title="Liquidity snapshot" />

      {/* Chip row — identical in styling to the hero chart's timeframe selector. */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-faint sm:block">
          Timeframe
        </span>
        <div className="ml-auto max-w-full overflow-x-auto pb-0.5">
          <SegmentedControl
            size="sm"
            options={liquidityTimeframes.map((tf) => ({ value: tf.id, label: tf.id }))}
            value={timeframeId}
            onChange={onTimeframeChange}
          />
        </div>
      </div>

      {status === 'loading' ? (
        <LiquiditySkeleton />
      ) : status === 'ready' && items.length > 0 ? (
        /* Keyed by timeframe — each switch remounts and replays the stagger. */
        <motion.div
          key={timeframeId}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.045 } },
          }}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2"
        >
          {items.map((item) => (
            <motion.div
              key={item.label}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.32, ease: ease.smooth },
                },
              }}
            >
              <LiquidityCard item={item} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <LiquidityEmpty message={message ?? 'No historical data for this window.'} onRetry={status === 'error' ? refresh : undefined} />
      )}

      <LiveDataStatus
        source={
          status === 'ready'
            ? `${timeframeId === '1M' || timeframeId === '5M' || timeframeId === '15M' ? 'Exchange klines' : 'CoinGecko'} · ${analysis?.candleGranularity ?? ''}`
            : 'OHLC history'
        }
        updatedAt={status === 'ready' ? fetchedAt : null}
        note={
          status === 'loading'
            ? 'Calculating…'
            : status === 'insufficient'
              ? (message ?? 'No historical data for this window.')
              : 'Awaiting historical feed'
        }
      />
    </section>
  )
}
