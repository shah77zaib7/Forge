import { motion } from 'framer-motion'
import { Activity, ArrowDownRight, ArrowUpRight, MoveRight } from 'lucide-react'

import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/cn'

import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframe } from '../data'
import { LiveDataStatus } from './live-data-status'

type Tone = 'positive' | 'negative' | 'neutral'

const toneClass: Record<Tone, string> = {
  positive: 'border-positive/25 bg-positive/10 text-positive',
  negative: 'border-negative/25 bg-negative/10 text-negative',
  neutral: 'border-border bg-tint/[0.06] text-muted',
}

function StatusCell({
  label,
  value,
  tone,
  direction,
}: {
  label: string
  value: string
  tone?: Tone
  direction?: 'up' | 'down' | 'flat'
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: ease.smooth } },
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
      {tone ? (
        /* Remounts with the grid — the badge pops softly when it flips. */
        <motion.span
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: ease.smooth }}
          className={cn(
            'mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
            toneClass[tone],
          )}
        >
          {value}
          {direction === 'up' && <ArrowUpRight size={12} strokeWidth={2.25} />}
          {direction === 'down' && <ArrowDownRight size={12} strokeWidth={2.25} />}
          {direction === 'flat' && <MoveRight size={12} strokeWidth={2.25} />}
        </motion.span>
      ) : (
        <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
      )}
    </motion.div>
  )
}

interface Cell {
  label: string
  value: string
  tone?: Tone
  direction?: 'up' | 'down' | 'flat'
}

/**
 * Market Status — the first thing a trader reads. A compact pulse of the
 * window: trend, momentum, structure and bias come from the Market
 * Intelligence Engine over real CoinGecko OHLC candles; volume is the real
 * 24h traded volume from the live quote. Windows the provider can't feed
 * render an honest dash instead of a fabricated read.
 */
export function MarketStatus({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const { status, analysis, message, fetchedAt } = useMarketIntelligence(coin, timeframe.id)
  const ready = status === 'ready' && analysis && !analysis.insufficient

  const structure = analysis?.structure
  const momentum = analysis?.momentum
  const resistance = analysis?.resistance[0]
  const support = analysis?.support[0]

  const bias =
    !structure
      ? '—'
      : structure.trend === 'sideways'
        ? 'Range'
        : structure.trend === 'bullish'
          ? resistance && resistance.distancePercent < 0.5
            ? 'Breakout'
            : 'Continuation'
          : support && support.distancePercent < 0.5
            ? 'Reversal'
            : 'Continuation'

  const cells: Cell[] = [
    {
      label: 'Trend',
      value: !ready ? '—' : structure!.trend === 'bullish' ? 'Bullish' : structure!.trend === 'bearish' ? 'Bearish' : 'Sideways',
      tone: !ready ? 'neutral' : structure!.trend === 'bullish' ? 'positive' : structure!.trend === 'bearish' ? 'negative' : 'neutral',
      direction: !ready
        ? undefined
        : structure!.trend === 'bullish'
          ? 'up'
          : structure!.trend === 'bearish'
            ? 'down'
            : 'flat',
    },
    {
      label: 'Momentum',
      value: !ready || !momentum ? '—' : `${momentum.state[0].toUpperCase()}${momentum.state.slice(1)} ${momentum.direction === 'up' ? '↑' : momentum.direction === 'down' ? '↓' : '→'}`,
    },
    { label: 'Volume 24h', value: coin.volume24h === null ? '—' : `$${formatCompact(coin.volume24h)}` },
    { label: 'Market Structure', value: !ready || !structure ? '—' : structure.label },
    { label: 'Bias', value: bias },
  ]

  return (
    <GlassCard className="mt-10">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={14} strokeWidth={1.75} className="text-faint" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Market status</span>
          </div>
          <span className="rounded-full border border-border bg-tint/[0.04] px-2.5 py-1 font-mono text-[11px] tabular-nums text-muted">
            {timeframe.id} window
          </span>
        </div>

        <motion.div
          key={timeframe.id}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          aria-live="polite"
          className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5"
        >
          {cells.map((cell) => (
            <StatusCell
              key={cell.label}
              label={cell.label}
              value={cell.value}
              tone={cell.tone}
              direction={cell.direction}
            />
          ))}
        </motion.div>

        <LiveDataStatus
          source="CoinGecko · OHLC"
          updatedAt={ready ? fetchedAt : null}
          note={status === 'error' || message ? 'Awaiting historical feed' : 'Calculating…'}
        />
      </div>
    </GlassCard>
  )
}
