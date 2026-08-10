import { motion } from 'framer-motion'
import { Check, Gauge } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ease } from '@/design/motion'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'
import { changeTone, formatChange } from '@/lib/format'
import { liquidityTimeframes, type LiquidityTimeframeId, type Tone } from '@/features/workspace/data'

import type { MarketHealth } from '../data'
import { ConfidenceMeter } from './confidence-meter'

/* ------------------------------------------------------------------ */
/* Current market                                                      */
/* ------------------------------------------------------------------ */

function CurrentMarketCard({
  coin,
  timeframeId,
  onTimeframeChange,
  health,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
  health: MarketHealth
}) {
  const tone = changeTone(coin.change24h)

  return (
    <GlassCard padding="md">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Current market</p>

      <div className="mt-3.5 flex items-center gap-3">
        <AssetIcon ticker={coin.ticker} color={coin.color} className="size-10 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{coin.name}</p>
          <p className="text-[11px] text-faint">{coin.ticker}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="font-mono text-2xl tabular-nums tracking-tight text-foreground">
          {formatMarketPrice(coin.price)}
        </p>
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            tone === 'positive' && 'text-positive',
            tone === 'negative' && 'text-negative',
            tone === 'neutral' && 'text-faint',
          )}
        >
          {formatChange(coin.change24h)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-faint">Trend</span>
        <Badge variant={health.trend.tone} size="sm">
          {health.trend.label}
        </Badge>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Timeframe
        </p>
        <div className="overflow-x-auto pb-0.5">
          <SegmentedControl
            size="sm"
            options={liquidityTimeframes.map((tf) => ({ value: tf.id, label: tf.id }))}
            value={timeframeId}
            onChange={onTimeframeChange}
          />
        </div>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Analysis inputs — full transparency on what Oracle weighs           */
/* ------------------------------------------------------------------ */

const analysisInputs = [
  'Selected timeframe',
  'Liquidity',
  'Market Structure',
  'Volume',
  'Momentum',
  'Trend',
  'Support & Resistance',
  'News',
]

function AnalysisInputsCard() {
  return (
    <GlassCard padding="md">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
        Analysis inputs
      </p>
      <ul className="mt-3.5 space-y-2.5">
        {analysisInputs.map((input) => (
          <li key={input} className="flex items-center gap-2.5 text-[13px] text-muted">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-positive/10">
              <Check size={10} strokeWidth={2.5} className="text-positive" />
            </span>
            {input}
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Market health scorecard                                             */
/* ------------------------------------------------------------------ */

function HealthCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: Tone
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
      {tone ? (
        <Badge variant={tone} size="sm" className="mt-1.5">
          {value}
        </Badge>
      ) : (
        <p className="mt-1.5 truncate text-sm font-medium text-foreground">{value}</p>
      )}
    </div>
  )
}

function MarketHealthCard({ health, timeframeId }: { health: MarketHealth; timeframeId: LiquidityTimeframeId }) {
  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
          Market health
        </p>
        <Gauge size={14} strokeWidth={1.75} className="text-faint" />
      </div>

      {/* Keyed by window — the scorecard refreshes itself on switch. */}
      <motion.div
        key={timeframeId}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: ease.smooth }}
      >
        <ConfidenceMeter value={health.confidence} tone={health.trend.tone} className="mt-4" />
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          <HealthCell label="Trend" value={health.trend.label} tone={health.trend.tone} />
          <HealthCell label="Volatility" value={health.volatility} />
          <HealthCell label="Risk" value={health.risk} />
          <HealthCell label="Momentum" value={health.momentum} />
        </div>
      </motion.div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Panel — shared by the desktop sidebar and the mobile sheet          */
/* ------------------------------------------------------------------ */

export function ContextPanel({
  coin,
  timeframeId,
  onTimeframeChange,
  health,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
  health: MarketHealth
}) {
  return (
    <div className="space-y-6">
      <CurrentMarketCard
        coin={coin}
        timeframeId={timeframeId}
        onTimeframeChange={onTimeframeChange}
        health={health}
      />
      <AnalysisInputsCard />
      <MarketHealthCard health={health} timeframeId={timeframeId} />
    </div>
  )
}
