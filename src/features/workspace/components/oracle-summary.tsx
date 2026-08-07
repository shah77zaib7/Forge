import { motion, useInView, useReducedMotion } from 'framer-motion'
import { ArrowRight, Orbit } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import type { Coin } from '@/features/markets/types'

import {
  oracleAssessment,
  oracleInputs,
  type LiquidityTimeframe,
  type Tone,
} from '../data'
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

/**
 * The Oracle Summary — Forge's signature surface. A composed, honest AI
 * read on the window: what it weighs is stated on the card, and the
 * confidence bars tween to new values whenever the shared timeframe
 * changes.
 */
export function OracleSummary({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const navigate = useNavigate()
  const assessment = useMemo(() => oracleAssessment(coin, timeframe), [coin, timeframe])

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
                {assessment.summary}
              </motion.p>
            </div>
            <Button onClick={() => navigate('/oracle')} className="shrink-0 lg:self-start">
              Ask Oracle
              <ArrowRight size={15} strokeWidth={2} />
            </Button>
          </div>

          <div className="mt-9 grid gap-7 border-t border-border pt-7 sm:grid-cols-3">
            <ConfidenceBar label="Bullish Confidence" value={assessment.bullish} tone="positive" delay={0} />
            <ConfidenceBar label="Neutral" value={assessment.neutral} tone="neutral" delay={0.12} />
            <ConfidenceBar label="Bearish Risk" value={assessment.bearish} tone="negative" delay={0.24} />
          </div>
        </div>
      </GlassCard>
    </section>
  )
}
