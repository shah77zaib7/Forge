import { motion } from 'framer-motion'
import { useId, useMemo, useState } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ease } from '@/design/motion'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { formatCompact } from '@/lib/format'

import { chartSeries, ohlcv, timeframes, type TimeframeId, type Tone } from '../data'
import { SectionHeading } from './section-heading'
import { Stat } from './stat'

const CHART_W = 600
const CHART_H = 260

function ChartCanvas({
  series,
  timeframe,
  tone,
}: {
  series: number[]
  timeframe: TimeframeId
  tone: Tone
}) {
  const rawId = useId()
  const gradientId = `chart-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const color =
    tone === 'positive'
      ? 'var(--forge-positive)'
      : tone === 'negative'
        ? 'var(--forge-negative)'
        : 'var(--forge-muted)'

  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const pad = span * 0.14
  const top = max + pad
  const bottom = min - pad
  const range = top - bottom

  const x = (index: number) => (index / (series.length - 1)) * CHART_W
  const y = (value: number) => CHART_H - ((value - bottom) / range) * CHART_H

  const line = series
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z`
  const lastY = y(series[series.length - 1])

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="none"
      className="h-52 w-full sm:h-64"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Faint horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((fraction) => (
        <line
          key={fraction}
          x1={0}
          x2={CHART_W}
          y1={CHART_H * fraction}
          y2={CHART_H * fraction}
          stroke="var(--forge-line)"
          strokeDasharray="1 6"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Keyed by timeframe so each switch re-draws the line */}
      <motion.g
        key={timeframe}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: ease.smooth }}
      >
        <path d={area} fill={`url(#${gradientId})`} />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: ease.smooth }}
        />
        <line
          x1={0}
          x2={CHART_W}
          y1={lastY}
          y2={lastY}
          stroke="var(--forge-line-strong)"
          strokeDasharray="2 5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Short tick on the last price — a dot would stretch into an
            ellipse under the chart's non-uniform scaling. */}
        <line
          x1={CHART_W}
          x2={CHART_W}
          y1={lastY - 5}
          y2={lastY + 5}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.g>
    </svg>
  )
}

/**
 * The hero chart — a calm, self-drawn placeholder (no TradingView yet).
 * Timeframe chips regenerate a deterministic series that ends at spot,
 * with High / Low / Open / Close / Volume below.
 */
export function HeroChart({ coin }: { coin: Coin }) {
  const [timeframeId, setTimeframeId] = useState<TimeframeId>('1D')
  const timeframe = useMemo(
    () => timeframes.find((tf) => tf.id === timeframeId) ?? timeframes[2],
    [timeframeId],
  )
  const series = useMemo(() => chartSeries(coin, timeframe), [coin, timeframe])
  const ohlc = useMemo(() => ohlcv(coin, timeframe, series), [coin, timeframe, series])
  const tone = coin.change24h > 0 ? 'positive' : coin.change24h < 0 ? 'negative' : 'neutral'

  const stats = [
    { label: 'High', value: formatMarketPrice(ohlc.high) },
    { label: 'Low', value: formatMarketPrice(ohlc.low) },
    { label: 'Open', value: formatMarketPrice(ohlc.open) },
    { label: 'Close', value: formatMarketPrice(ohlc.close) },
    { label: 'Volume', value: `$${formatCompact(ohlc.volume)}` },
  ]

  return (
    <section id="forge-chart" className="scroll-mt-24">
      <SectionHeading eyebrow="01 — Chart" title="Price action" />
      <GlassCard className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <span className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-faint sm:block">
            Timeframe
          </span>
          <div className="ml-auto max-w-full overflow-x-auto pb-0.5">
            <SegmentedControl
              size="sm"
              options={timeframes.map((tf) => ({ value: tf.id, label: tf.id }))}
              value={timeframeId}
              onChange={setTimeframeId}
            />
          </div>
        </div>

        <div className="px-3 pb-3 pt-6 sm:px-6 sm:pb-4">
          <ChartCanvas series={series} timeframe={timeframeId} tone={tone} />
        </div>

        <div className="grid grid-cols-3 gap-x-4 gap-y-6 border-t border-border px-5 py-6 sm:grid-cols-5 sm:px-6">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </GlassCard>
    </section>
  )
}
