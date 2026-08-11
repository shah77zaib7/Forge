import { motion, useInView, useReducedMotion } from 'framer-motion'
import { ArrowRight, Orbit } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { TimeframeAnalysis } from '@/features/markets/services/market-intelligence'
import type { Coin } from '@/features/markets/types'

import type { LiquidityTimeframe, Tone } from '../data'
import { oracleInputs } from '../data'
import { SectionHeading } from './section-heading'

function ConfidenceBar({
  label,
  value,
  tone,
  delay,
}: {
  label: string
  value: number
  tone: Tone
  delay: number
}) {
  const color =
    tone === 'positive'
      ? 'var(--forge-positive)'
      : tone === 'negative'
        ? 'var(--forge-negative)'
        : 'var(--forge-muted)'
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-32px' })

  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
        <motion.div
          initial={reduceMotion ? `${value}%` : '0%'}
          animate={inView ? `${value}%` : '0%'}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.9, ease: ease.smooth, delay }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/** Human label for a model source id, e.g. 'swing_high' → 'Swing high'. */
function humanSource(source: string): string {
  return source
    .split('_')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ')
}

/**
 * Deterministic confidence from REAL model facts — structure counts,
 * momentum direction/strength, and how close high-ranked liquidity sits.
 * Never an invented probability: a transparent, repeatable mapping.
 */
function deriveConfidence(analysis: TimeframeAnalysis): { bullish: number; neutral: number; bearish: number } {
  const structure = analysis.structure
  let score = 0
  if (structure) {
    const total = structure.hh + structure.hl + structure.lh + structure.ll
    if (total > 0) score = ((structure.hh + structure.hl - structure.lh - structure.ll) / total) * 0.5
  }
  if (analysis.momentum) {
    const weight = analysis.momentum.state === 'strong' ? 1 : analysis.momentum.state === 'moderate' ? 0.6 : 0.3
    score += (analysis.momentum.direction === 'up' ? 0.15 : analysis.momentum.direction === 'down' ? -0.15 : 0) * weight
  }
  const buy = analysis.liquidity.buySide[0]
  const sell = analysis.liquidity.sellSide[0]
  if (buy && !buy.swept && buy.distancePercent < 0.5) score += 0.06
  if (sell && !sell.swept && sell.distancePercent < 0.5) score -= 0.06
  score = Math.min(0.5, Math.max(-0.5, score))
  const bullish = Math.round(Math.min(75, Math.max(5, (score + 0.5) * 100 * 0.75)))
  const bearish = Math.round(Math.min(75, Math.max(5, (0.5 - score) * 100 * 0.75)))
  const neutral = Math.max(0, 100 - bullish - bearish)
  return { bullish, neutral, bearish }
}

/** One deterministic sentence about the nearest liquidity on each side. */
function liquiditySentence(analysis: TimeframeAnalysis): string {
  const buy = analysis.liquidity.buySide[0]
  const sell = analysis.liquidity.sellSide[0]
  const parts: string[] = []
  if (buy) {
    parts.push(
      `nearest buy-side liquidity ${buy.distancePercent.toFixed(2)}% above spot at ${formatMarketPrice(buy.price)} (${humanSource(buy.source)}, ${buy.rank}${buy.swept ? ', swept' : ''})`,
    )
  }
  if (sell) {
    parts.push(
      `sell-side liquidity ${sell.distancePercent.toFixed(2)}% below at ${formatMarketPrice(sell.price)} (${humanSource(sell.source)}, ${sell.rank}${sell.swept ? ', swept' : ''})`,
    )
  }
  return parts.join('; ')
}

/** Deterministic summary from the real window read — no invented levels. */
function buildSummary(coin: Coin, analysis: TimeframeAnalysis): string {
  const structure = analysis.structure
  const trend = structure?.trend ?? 'sideways'
  const label = structure?.label ?? 'Range Bound'
  const momentum = analysis.momentum
    ? `${analysis.momentum.state} ${analysis.momentum.direction === 'up' ? 'upside' : analysis.momentum.direction === 'down' ? 'downside' : 'sideways'} momentum`
    : 'no momentum read yet'
  const open = `${coin.name} reads ${trend} on this window — structure ${label} with ${momentum}.`
  const liquidity = liquiditySentence(analysis)
  const sweeps = analysis.sweeps
    ? `Price swept ${analysis.sweeps.length} detected zone${analysis.sweeps.length === 1 ? '' : 's'}${analysis.sweeps.some((s) => s.returned) ? ', with a return through at least one' : ''}.`
    : ''
  return [open, liquidity ? `${liquidity.charAt(0).toUpperCase() + liquidity.slice(1)}.` : '', sweeps]
    .filter(Boolean)
    .join(' ')
}

/**
 * The Oracle Summary — Forge's signature surface. The read and the
 * confidence bars are derived deterministically from the Forge Liquidity
 * Model (the same engine as the Liquidity Snapshot): trend, structure,
 * momentum, real liquidity zones and sweeps. No mock figures; when the
 * window has no usable data the card says so honestly.
 */
export function OracleSummary({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const navigate = useNavigate()
  const { status, analysis, message, fetchedAt } = useMarketIntelligence(coin, timeframe.id)
  const ready = status === 'ready' && analysis && !analysis.insufficient

  const summary = useMemo(() => {
    if (!ready || !analysis) return null
    return buildSummary(coin, analysis)
  }, [ready, analysis, coin])

  const confidence = useMemo(
    () => (ready && analysis ? deriveConfidence(analysis) : { bullish: 0, neutral: 100, bearish: 0 }),
    [ready, analysis],
  )

  const honestNote =
    status === 'loading'
      ? 'Calculating from real candles…'
      : status === 'insufficient'
        ? (message ?? 'No liquidity analysis available for this timeframe.')
        : status === 'error'
          ? 'Historical data temporarily unavailable. Live prices are unaffected.'
          : null

  return (
    <section>
      <SectionHeading eyebrow="02 — Oracle" title="Oracle Summary" />
      <GlassCard variant="strong" className="mt-4">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Orbit size={14} strokeWidth={1.75} className="text-faint" />
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
                  Based on
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {oracleInputs.map((input) => (
                  <li key={input} className="flex items-center gap-1.5 text-xs text-muted">
                    <span aria-hidden className="size-1 rounded-full bg-tint/40" />
                    {input}
                  </li>
                ))}
              </ul>
              {/* Keyed by window — the read swaps in with a quiet fade. */}
              <motion.p
                key={timeframe.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: ease.smooth }}
                className="mt-4 text-[15px] leading-relaxed text-foreground/90 sm:text-base"
              >
                {honestNote ?? summary}
              </motion.p>
            </div>
            <Button onClick={() => navigate('/oracle')} className="shrink-0 lg:self-start">
              Ask Oracle
              <ArrowRight size={15} strokeWidth={2} />
            </Button>
          </div>

          <div className="mt-9 grid gap-7 border-t border-border pt-7 sm:grid-cols-3">
            <ConfidenceBar label="Bullish Confidence" value={confidence.bullish} tone="positive" delay={0} />
            <ConfidenceBar label="Neutral" value={confidence.neutral} tone="neutral" delay={0.12} />
            <ConfidenceBar label="Bearish Risk" value={confidence.bearish} tone="negative" delay={0.24} />
          </div>

          {ready && fetchedAt && (
            <p className="mt-4 text-[11px] text-faint">
              Forge Liquidity Model · {timeframe.id} · updated {Math.max(0, Math.round((Date.now() - fetchedAt) / 1000))}s ago
            </p>
          )}
        </div>
      </GlassCard>
    </section>
  )
}
