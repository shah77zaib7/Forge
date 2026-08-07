import { motion } from 'framer-motion'
import { Activity, ArrowDownRight, ArrowUpRight, MoveRight } from 'lucide-react'
import { useMemo } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import {
  marketStatus,
  type LiquidityTimeframe,
  type MarketStatusData,
  type Tone,
} from '../data'

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
  direction?: MarketStatusData['trend']['direction']
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

/**
 * Market Status — the first thing a trader reads. A compact pulse of the
 * window: trend, momentum, volume, structure and bias. Driven by the
 * same shared timeframe as Oracle and Depth, so the whole workspace
 * speaks with one voice.
 */
export function MarketStatus({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const status = useMemo(() => marketStatus(coin, timeframe), [coin, timeframe])

  const cells: Array<{
    label: string
    value: string
    tone?: Tone
    direction?: MarketStatusData['trend']['direction']
  }> = [
    {
      label: 'Trend',
      value: status.trend.label,
      tone: status.trend.tone,
      direction: status.trend.direction,
    },
    { label: 'Momentum', value: status.momentum },
    { label: 'Volume', value: status.volume },
    { label: 'Market Structure', value: status.structure },
    { label: 'Bias', value: status.bias },
  ]

  return (
    <GlassCard className="mt-10">
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity size={14} strokeWidth={1.75} className="text-faint" />
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
              Market status
            </span>
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
      </div>
    </GlassCard>
  )
}
