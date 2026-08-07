import { motion } from 'framer-motion'
import { ArrowDownToLine, ArrowUpFromLine, Flame, MoveHorizontal, Shield, TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ease } from '@/design/motion'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import {
  DEFAULT_LIQUIDITY_TIMEFRAME,
  liquiditySnapshot,
  liquidityTimeframes,
  type LiquidityItem,
  type LiquidityTimeframeId,
} from '../data'
import { SectionHeading } from './section-heading'

const icons: Record<Exclude<LiquidityItem['icon'], 'trend'>, LucideIcon> = {
  buy: ArrowDownToLine,
  sell: ArrowUpFromLine,
  support: Shield,
  resistance: Flame,
}

function LiquidityCard({ item }: { item: LiquidityItem }) {
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
          <div
            key={detail.label}
            className="mt-1 flex items-baseline justify-between gap-2"
          >
            <span className="text-[11px] text-faint">{detail.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-foreground/80">
              {detail.value}
            </span>
          </div>
        ))}
        <p className="mt-0.5 text-[11px] text-faint">{item.caption}</p>
      </div>
    </GlassCard>
  )
}

/** Quiet live-feed row — becomes real once order-book APIs land. */
function DataStatus() {
  const [seconds, setSeconds] = useState(12)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 30), 30000)
    return () => window.clearInterval(id)
  }, [])

  const ago =
    seconds < 60
      ? `${seconds}s ago`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m ago`
        : `${Math.floor(seconds / 3600)}h ago`

  return (
    <div className="mt-3 flex items-center gap-2 text-[11px] text-faint">
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-positive" />
      </span>
      <span>
        Source — <span className="text-muted">Hyblock</span>
      </span>
      <span aria-hidden className="text-tint/40">
        ·
      </span>
      <span>
        Updated <span className="text-muted">{ago}</span>
      </span>
    </div>
  )
}

/** Forge's signature depth view — where liquidity actually sits, per window. */
export function LiquiditySnapshot({
  coin,
  timeframeId,
  onTimeframeChange,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
}) {
  const timeframe = useMemo(
    () =>
      liquidityTimeframes.find((tf) => tf.id === timeframeId) ??
      liquidityTimeframes.find((tf) => tf.id === DEFAULT_LIQUIDITY_TIMEFRAME)!,
    [timeframeId],
  )
  const items = useMemo(() => liquiditySnapshot(coin, timeframe), [coin, timeframe])

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

      {/* Keyed by timeframe — each switch remounts and replays the stagger. */}
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

      <DataStatus />
    </section>
  )
}
