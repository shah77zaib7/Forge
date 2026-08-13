import { motion, useReducedMotion } from 'framer-motion'
import { Activity, Check, Crosshair, Minus, ShieldCheck, Waves, Zap } from 'lucide-react'
import { useMemo } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import { useMarketIntelligence } from '@/features/markets/hooks/use-market-intelligence'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { surfaceSource } from '@/features/markets/services/market-router'
import { analyzeForgeV2, type ForgeV2Input } from '@/features/markets/services/forge-v2/engine'
import { useForgeV2 } from '@/features/markets/services/forge-v2/store'
import type { ForgeMarketState } from '@/features/markets/services/forge-v2/types'
import type { Confirmation, Displacement, Retracement } from '@/features/markets/services/setup-intelligence'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import type { LiquidityTimeframe } from '../data'
import { LiveDataStatus } from './live-data-status'
import { SectionHeading } from './section-heading'

const levelMeta: Record<
  ForgeMarketState['scoring']['level'],
  { label: string; chip: string; dot: string; text: string }
> = {
  strong: {
    label: 'Strong setup',
    chip: 'border-positive/25 bg-positive/10 text-positive',
    dot: 'bg-positive',
    text: 'text-positive',
  },
  moderate: {
    label: 'Moderate setup',
    chip: 'border-border bg-tint/[0.06] text-foreground/80',
    dot: 'bg-tint/70',
    text: 'text-foreground/80',
  },
  weak: {
    label: 'Weak setup',
    chip: 'border-warning/25 bg-warning/10 text-warning',
    dot: 'bg-warning',
    text: 'text-warning',
  },
  none: {
    label: 'No setup',
    chip: 'border-border bg-tint/[0.06] text-faint',
    dot: 'bg-muted/50',
    text: 'text-faint',
  },
}

const familyLabel: Record<ForgeMarketState['scoring']['family'], string> = {
  liquidity_sweep: 'Liquidity sweep',
  displacement: 'Displacement',
  confluence: 'Confluence',
  none: '—',
}

const confirmationLabel: Record<Confirmation['kind'], string> = {
  engulfing: 'Engulfing',
  rejection: 'Rejection',
  continuation: 'Continuation',
  structure_reclaim: 'Structure reclaim',
}

/** Contribution rows for the traceable score — one group, its points. */
const CONTRIBUTION_GROUPS: Array<{ key: keyof ForgeMarketState['scoring']['contributions']; label: string }> = [
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'sweep', label: 'Sweep' },
  { key: 'displacement', label: 'Displacement' },
  { key: 'pullback', label: 'Pullback' },
  { key: 'confirmation', label: 'Confirmation' },
  { key: 'context', label: 'Context' },
]

function directionWord(direction: 'long' | 'short' | null): string {
  if (direction === 'long') return 'Long'
  if (direction === 'short') return 'Short'
  return '—'
}

function sweepValue(state: ForgeMarketState): { value: string; tone: 'up' | 'down' | 'flat' } {
  const sweep = state.sweeps.read
  if (!sweep) return { value: 'None recent', tone: 'flat' }
  const direction = sweep.direction === 'long' ? 'up' : 'down'
  const base = `${directionWord(sweep.direction)} · ${sweep.levelPrice !== null ? formatMarketPrice(sweep.levelPrice) : '—'}`
  return { value: sweep.returned ? `${base} · reclaimed` : base, tone: direction }
}

function displacementValue(displacement: Displacement | null): { value: string; tone: 'up' | 'down' | 'flat' } {
  if (!displacement) return { value: 'None detected', tone: 'flat' }
  return {
    value: `${displacement.direction === 'up' ? 'Up' : 'Down'} · ${displacement.strength}/100`,
    tone: displacement.direction,
  }
}

function retracementValue(retracement: Retracement | null): { value: string; tone: 'up' | 'down' | 'flat' } {
  if (!retracement) return { value: '—', tone: 'flat' }
  if (!retracement.enteredZone) return { value: 'Too shallow', tone: 'flat' }
  return {
    value: `${Math.round(retracement.depthPercent * 100)}% of move${retracement.reaction === 'held' ? ' · held' : retracement.reaction === 'broke' ? ' · broke' : ''}`,
    tone: retracement.reaction === 'held' ? 'up' : retracement.reaction === 'broke' ? 'down' : 'flat',
  }
}

function confirmationValue(state: ForgeMarketState): { value: string; tone: 'up' | 'down' | 'flat' } {
  const confirmation = state.confirmation.read
  if (!confirmation) return { value: 'None yet', tone: 'flat' }
  return {
    value: `${directionWord(confirmation.direction)} ${confirmationLabel[confirmation.kind]}`,
    tone: confirmation.direction === 'long' ? 'up' : 'down',
  }
}

const toneClass = (tone: 'up' | 'down' | 'flat') =>
  tone === 'up' ? 'text-positive' : tone === 'down' ? 'text-negative' : 'text-foreground/80'

function DetectionRow({
  icon,
  label,
  value,
  tone,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'up' | 'down' | 'flat'
  delay: number
}) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.smooth, delay }}
      className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-tint/[0.03] px-3 py-2.5"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-tint/[0.05]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
        <p className={cn('truncate font-mono text-xs tabular-nums tracking-tight', toneClass(tone))}>{value}</p>
      </div>
    </motion.div>
  )
}

function SetupSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-hidden>
      <div className="h-10 animate-pulse rounded-xl border border-border bg-tint/[0.03]" />
      <div className="space-y-2">
        <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-tint/[0.07]" />
        <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-tint/[0.07]" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl border border-border bg-tint/[0.03]" />
        ))}
      </div>
    </div>
  )
}

/**
 * Setup Intelligence — the deterministic read of Forge's two setup families
 * (liquidity sweep / displacement), derived from the SAME Liquidity Model
 * output as the Depth book and Oracle Summary. Every claim is a measurement
 * of the real candles; missing evidence is reported, never invented.
 */
export function SetupIntelligenceCard({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  const { status, analysis, candles, provider, symbol, dataAt, freshness, message, refresh } =
    useMarketIntelligence(coin, timeframe.id)
  const reduceMotion = useReducedMotion()
  const { config } = useForgeV2()

  const setup = useMemo<ForgeMarketState | null>(() => {
    if (status !== 'ready' || !analysis || analysis.insufficient || !candles) return null
    const input: ForgeV2Input = {
      asset: coin.ticker,
      timeframe: timeframe.id,
      analysis,
      candles,
      config,
    }
    return analyzeForgeV2(input)
  }, [status, analysis, candles, coin.ticker, timeframe.id, config])

  const ready = setup !== null
  const meta = ready ? levelMeta[setup.scoring.level] : levelMeta.none

  return (
    <section>
      <SectionHeading eyebrow="08 — Setup" title="Setup intelligence" />

      {status === 'loading' ? (
        <SetupSkeleton />
      ) : !ready ? (
        <GlassCard padding="sm" className="mt-4">
          <div className="flex items-center gap-3 px-2 py-3">
            <Minus size={14} strokeWidth={1.75} className="shrink-0 text-faint" />
            <p className="text-xs leading-relaxed text-muted">
              {status === 'insufficient'
                ? (message ?? 'No setup analysis available for this window.')
                : 'Historical data temporarily unavailable. Live prices are unaffected.'}
            </p>
            {status === 'error' && (
              <button
                type="button"
                onClick={refresh}
                className="ml-auto shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:bg-tint/[0.05] hover:text-foreground"
              >
                Retry
              </button>
            )}
          </div>
          <LiveDataStatus
            source={surfaceSource(coin, provider, symbol, analysis?.candleGranularity ?? null)}
            updatedAt={null}
            freshness={freshness}
            note="Awaiting historical feed"
          />
        </GlassCard>
      ) : (
        <GlassCard variant="strong" className="mt-4">
          <div className="p-5 sm:p-6">
            {/* Quality header. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={cn('size-2 rounded-full', meta.dot)} />
                <span className="text-sm font-semibold tracking-tight text-foreground">Setup quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    meta.chip,
                  )}
                >
                  {meta.label}
                </span>
                <span className="rounded-full border border-border bg-tint/[0.04] px-2 py-1 font-mono text-[10px] tabular-nums text-muted">
                  {familyLabel[setup.scoring.family]}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-faint">{setup.scoring.total}/100</span>
              </div>
            </div>

            {/* Deterministic read. */}
            <motion.p
              key={`${coin.id}:${timeframe.id}`}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: ease.smooth }}
              className="mt-4 text-sm leading-relaxed text-foreground/85"
            >
              {setup.setup.read}
            </motion.p>

            {/* Detection grid. */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <DetectionRow
                icon={<Waves size={12} strokeWidth={1.75} className="text-faint" />}
                label="Sweep"
                value={sweepValue(setup).value}
                tone={sweepValue(setup).tone}
                delay={0}
              />
              <DetectionRow
                icon={<Zap size={12} strokeWidth={1.75} className="text-faint" />}
                label="Displacement"
                value={displacementValue(setup.displacement.read).value}
                tone={displacementValue(setup.displacement.read).tone}
                delay={0.06}
              />
              <DetectionRow
                icon={<Crosshair size={12} strokeWidth={1.75} className="text-faint" />}
                label="Retracement"
                value={retracementValue(setup.pullback.read).value}
                tone={retracementValue(setup.pullback.read).tone}
                delay={0.12}
              />
              <DetectionRow
                icon={<Activity size={12} strokeWidth={1.75} className="text-faint" />}
                label="Confirmation"
                value={confirmationValue(setup).value}
                tone={confirmationValue(setup).tone}
                delay={0.18}
              />
            </div>

            {/* Traceable score — every group contribution, live from V2. */}
            <div className="mt-5 grid grid-cols-3 gap-1.5 border-t border-border pt-4">
              {CONTRIBUTION_GROUPS.map(({ key, label }) => {
                const points = setup.scoring.contributions[key]
                const active = points > 0
                return (
                  <div
                    key={key}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-center',
                      active ? 'border-positive/20 bg-positive/[0.04]' : 'border-border/60 bg-tint/[0.02]',
                    )}
                  >
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-faint">{label}</p>
                    <p
                      className={cn(
                        'mt-0.5 font-mono text-xs tabular-nums',
                        active ? 'text-positive' : 'text-faint',
                      )}
                    >
                      +{points}
                    </p>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-faint">
              <span>Forge V2 · config v{setup.metadata.configVersion}</span>
              {setup.scoring.cappedByNoConfirmation && <span className="text-warning">No-confirmation cap applied</span>}
              {setup.confirmation.timeframe !== timeframe.id && setup.confirmation.read && (
                <span>Confirmation on {setup.confirmation.timeframe}</span>
              )}
            </p>

            {/* Why — one measurable fact per reason. */}
            {setup.scoring.reasons.length > 0 && (
              <ul className="mt-5 space-y-2 border-t border-border pt-4">
                {setup.scoring.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                    <ShieldCheck size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
                    <span>{reason}</span>
                  </li>
                ))}
                {setup.scoring.missing.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-xs leading-relaxed text-warning/80">
                    <Minus size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning/70" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}

            {setup.confirmation.read && (
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted">
                <Check size={12} strokeWidth={2} className="text-positive" />
                {setup.confirmation.read.description}
              </p>
            )}
          </div>

          <LiveDataStatus
            source={surfaceSource(coin, provider, symbol, analysis?.candleGranularity ?? null)}
            updatedAt={dataAt}
            freshness={freshness}
            note="Awaiting historical feed"
          />
        </GlassCard>
      )}
    </section>
  )
}
