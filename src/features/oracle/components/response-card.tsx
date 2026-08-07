import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  Check,
  Layers,
  Target,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'

import { useProgressive } from '../hooks/use-oracle-stream'
import type {
  AnalysisCard,
  EducationalCard,
  LiquidityCard,
  LiquidityWall,
  OracleCard,
  OracleMessage,
  TradeSetupCard,
  WarningCard,
} from '../types'
import { ConfidenceMeter } from './confidence-meter'

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

function Reveal({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.smooth }}
    >
      {children}
    </motion.div>
  )
}

function CardSection({
  visible,
  label,
  children,
}: {
  visible: boolean
  label: string
  children: ReactNode
}) {
  return (
    <Reveal visible={visible}>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">{label}</p>
      <div className="mt-2">{children}</div>
    </Reveal>
  )
}

function CardHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
}: {
  icon: typeof BrainCircuit
  title: string
  subtitle: string
  badge?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-tint/[0.05]">
          <Icon size={14} strokeWidth={1.75} className="text-muted" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tracking-tight text-foreground">{title}</p>
          <p className="truncate text-[11px] text-faint">{subtitle}</p>
        </div>
      </div>
      {badge}
    </div>
  )
}

/** Streaming caret — a quiet pulsing mark at the end of live text. */
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-3 w-px animate-pulse rounded-full bg-foreground/50 align-middle"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Analysis — the signature mini-Bloomberg report                      */
/* ------------------------------------------------------------------ */

function AnalysisCardView({
  card,
  streaming,
  progress,
}: {
  card: AnalysisCard
  streaming: boolean
  progress: number
}) {
  const order = [
    'meta',
    'summary',
    ...card.reasoning.map((_, index) => `r${index}`),
    'risk',
    'idea',
    ...card.sections.map((_, index) => `s${index}`),
  ]
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  const chars = Math.ceil(progress * card.summary.length)
  const shownSummary = streaming ? card.summary.slice(0, chars) : card.summary
  const isStreaming = streaming && progress < 1

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={BrainCircuit}
        title="Market Summary"
        subtitle={`${card.market} · ${card.ticker} · ${card.timeframe} window`}
        badge={
          <Badge variant={card.tone} size="sm">
            {card.bias}
          </Badge>
        }
      />

      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible={show('meta')}>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <ConfidenceMeter value={card.confidence} tone={card.tone} progress={progress} className="w-44" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Timeframe
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{card.timeframe}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Market
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{card.market}</p>
            </div>
          </div>
        </Reveal>

        <CardSection visible={show('summary')} label="Summary">
          <p className="text-sm leading-relaxed text-foreground/90">
            {shownSummary}
            {isStreaming && <Caret />}
          </p>
        </CardSection>

        <CardSection visible={show('r0')} label="Reasoning">
          <ul className="space-y-2">
            {card.reasoning.map((point, index) => (
              <Reveal key={point} visible={show(`r${index}`)}>
                <li className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85">
                  <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-tint/[0.35]" />
                  {point}
                </li>
              </Reveal>
            ))}
          </ul>
        </CardSection>

        <CardSection visible={show('risk')} label="Risk">
          <div className="flex items-start gap-2.5 rounded-panel border border-warning/25 bg-warning/[0.06] px-3.5 py-3">
            <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] leading-relaxed text-foreground/85">{card.risk}</p>
          </div>
        </CardSection>

        <CardSection visible={show('idea')} label="Trade idea">
          <p className="text-[13px] leading-relaxed text-foreground/85">{card.tradeIdea}</p>
        </CardSection>

        <Reveal visible={show('s0')}>
          <div className="grid gap-4 sm:grid-cols-3">
            {card.sections.map((section) => (
              <div key={section.title} className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  {section.title}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="text-xs leading-relaxed text-foreground/80">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal visible={!streaming}>
          <div className="flex items-center gap-1.5 border-t border-border pt-4 text-[11px] text-faint">
            <Check size={12} strokeWidth={2.25} className="text-positive" />
            Read complete
          </div>
        </Reveal>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Liquidity map                                                       */
/* ------------------------------------------------------------------ */

function WallTile({
  wall,
  label,
  tone,
  visible,
}: {
  wall: LiquidityWall
  label: string
  tone: 'positive' | 'negative' | 'neutral'
  visible: boolean
}) {
  return (
    <Reveal visible={visible}>
      <div className="rounded-panel border border-border bg-tint/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium',
              tone === 'positive' && 'border-positive/25 bg-positive/10 text-positive',
              tone === 'negative' && 'border-negative/25 bg-negative/10 text-negative',
              tone === 'neutral' && 'border-border bg-tint/[0.06] text-muted',
            )}
          >
            {wall.side === 'buy' ? 'Buy' : 'Sell'}
          </span>
        </div>
        <p className="mt-2.5 font-mono text-xl tabular-nums tracking-tight text-foreground">
          {wall.price}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-faint">Size</span>
          <span className="font-mono text-[11px] tabular-nums text-foreground/80">{wall.size}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">{wall.distance}</p>
      </div>
    </Reveal>
  )
}

function LiquidityCardView({
  card,
  streaming,
  progress,
}: {
  card: LiquidityCard
  streaming: boolean
  progress: number
}) {
  const order = ['buy', 'sell', 'largest', 'summary']
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={Layers}
        title="Liquidity Map"
        subtitle={`${card.market} · ${card.ticker} · ${card.timeframe} window`}
        badge={
          <Badge variant="neutral" size="sm">
            {card.bias}
          </Badge>
        }
      />
      <div className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <WallTile wall={card.buy} label="Nearest buy" tone="positive" visible={show('buy')} />
          <WallTile wall={card.sell} label="Nearest sell" tone="negative" visible={show('sell')} />
          <WallTile wall={card.largest} label="Largest wall" tone="neutral" visible={show('largest')} />
        </div>
        <Reveal visible={show('summary')}>
          <p className="text-[13px] leading-relaxed text-foreground/85">{card.summary}</p>
        </Reveal>
        <Reveal visible={!streaming}>
          <div className="flex items-center gap-1.5 border-t border-border pt-4 text-[11px] text-faint">
            <Check size={12} strokeWidth={2.25} className="text-positive" />
            Read complete
          </div>
        </Reveal>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Trade setup                                                         */
/* ------------------------------------------------------------------ */

function TradeSetupCardView({
  card,
  streaming,
  progress,
}: {
  card: TradeSetupCard
  streaming: boolean
  progress: number
}) {
  const order = ['stats', 'confidence', ...card.checklist.map((_, index) => `c${index}`)]
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  const stats = [
    { label: 'Entry', value: card.entry, tone: undefined },
    { label: 'Stop Loss', value: card.stopLoss, tone: 'negative' as const },
    { label: 'Take Profit', value: card.takeProfit, tone: 'positive' as const },
    { label: 'Risk / Reward', value: card.riskReward, tone: undefined },
  ]

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader icon={Target} title="Trade Setup" subtitle={`${card.market} · ${card.ticker} · ${card.timeframe} window`} />
      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible={show('stats')}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    'mt-1.5 font-mono text-base tabular-nums tracking-tight',
                    stat.tone === 'positive' && 'text-positive',
                    stat.tone === 'negative' && 'text-negative',
                    !stat.tone && 'text-foreground',
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal visible={show('confidence')}>
          <ConfidenceMeter value={card.confidence} tone="neutral" progress={progress} className="w-full sm:w-64" />
        </Reveal>

        <Reveal visible={show('c0')}>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">Checklist</p>
          <ul className="mt-2.5 space-y-2.5">
            {card.checklist.map((item, index) => (
              <Reveal key={item} visible={show(`c${index}`)}>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-positive/10">
                    <Check size={10} strokeWidth={2.5} className="text-positive" />
                  </span>
                  <span className="text-[13px] leading-relaxed text-foreground/85">{item}</span>
                </li>
              </Reveal>
            ))}
          </ul>
        </Reveal>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Educational                                                         */
/* ------------------------------------------------------------------ */

function EducationalCardView({
  card,
  streaming,
  progress,
}: {
  card: EducationalCard
  streaming: boolean
  progress: number
}) {
  const order = ['definition', 'example', 'whenToUse', 'mistakes', 'diagram']
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={BookOpen}
        title="Concept"
        subtitle="Oracle explains · no jargon, just structure"
      />
      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">{card.concept}</h3>
        </Reveal>

        <CardSection visible={show('definition')} label="Definition">
          <p className="text-sm leading-relaxed text-foreground/85">{card.definition}</p>
        </CardSection>

        <CardSection visible={show('example')} label="Example">
          <p className="text-sm leading-relaxed text-foreground/85">{card.example}</p>
        </CardSection>

        <CardSection visible={show('whenToUse')} label="When to use">
          <p className="text-sm leading-relaxed text-foreground/85">{card.whenToUse}</p>
        </CardSection>

        <CardSection visible={show('mistakes')} label="Common mistakes">
          <ul className="space-y-2">
            {card.commonMistakes.map((mistake) => (
              <li key={mistake} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85">
                <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-negative/70" />
                {mistake}
              </li>
            ))}
          </ul>
        </CardSection>

        <Reveal visible={show('diagram')}>
          <div className="flex items-center justify-center gap-3 rounded-panel border border-dashed border-border-strong/60 bg-tint/[0.02] py-8">
            <CandlestickChart size={16} strokeWidth={1.75} className="text-faint" />
            <p className="text-xs text-faint">Diagram placeholder — renders once live charts land</p>
          </div>
        </Reveal>
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Warning — amber advisory                                            */
/* ------------------------------------------------------------------ */

function WarningCardView({ card, progress }: { card: WarningCard; progress: number }) {
  // Fade in just after the leading card begins streaming, so a follow-up
  // advisory never jumps in ahead of the analysis.
  if (progress < 0.15) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: ease.smooth }}
      className="rounded-panel border border-warning/30 bg-warning/[0.07] p-5"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10">
          <AlertTriangle size={14} strokeWidth={1.75} className="text-warning" />
        </span>
        <p className="text-sm font-semibold tracking-tight text-foreground">{card.title}</p>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">{card.body}</p>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export function OracleResponseCard({
  message,
  onStreamed,
}: {
  message: OracleMessage
  onStreamed: (id: string) => void
}) {
  const card = message.card as OracleCard
  const streaming = message.streaming ?? false
  const progress = useProgressive(streaming)

  useEffect(() => {
    if (streaming && progress >= 1) onStreamed(message.id)
  }, [streaming, progress, message.id, onStreamed])

  switch (card.kind) {
    case 'analysis':
      return <AnalysisCardView card={card} streaming={streaming} progress={progress} />
    case 'liquidity':
      return <LiquidityCardView card={card} streaming={streaming} progress={progress} />
    case 'trade-setup':
      return <TradeSetupCardView card={card} streaming={streaming} progress={progress} />
    case 'educational':
      return <EducationalCardView card={card} streaming={streaming} progress={progress} />
    case 'warning':
      return <WarningCardView card={card} progress={progress} />
  }
}
