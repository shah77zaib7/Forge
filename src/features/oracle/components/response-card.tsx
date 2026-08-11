import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  BookOpen,
  BrainCircuit,
  CandlestickChart,
  Check,
  Copy,
  Layers,
  Newspaper,
  RefreshCw,
  Share,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'

import { cardToText } from '../data'
import { useProgressive } from '../hooks/use-oracle-stream'
import type {
  AiAnalysisCard,
  AiErrorCard,
  AnalysisCard,
  ComparisonCard,
  EducationalCard,
  LiquidityCard,
  LiquidityWall,
  MarketBriefCard,
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
  icon: LucideIcon
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

/** A quiet bulleted list — used by brief and reasoning sections. */
function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85">
          <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-tint/[0.35]" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Message actions — Copy / Save / Share / Regenerate                  */
/* ------------------------------------------------------------------ */

function MessageActions({
  card,
  messageId,
  onRegenerate,
  onSave,
}: {
  card: OracleCard
  messageId: string
  onRegenerate: (id: string) => void
  onSave?: () => 'saved' | 'exists' | null
}) {
  const [hint, setHint] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const flash = (label: string) => {
    setHint(label)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHint(null), 1600)
  }

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(cardToText(card))
      flash('Copied')
    } catch {
      flash('Copy unavailable')
    }
  }

  const actions: Array<{ icon: LucideIcon; label: string; run: () => void }> = [
    { icon: Copy, label: 'Copy', run: copy },
    {
      icon: Bookmark,
      label: 'Save analysis',
      run: () => {
        const result = onSave?.()
        if (result === 'saved') flash('Saved to history')
        else if (result === 'exists') flash('Already saved')
      },
    },
    { icon: Share, label: 'Share', run: () => flash('Sharing lands with the live Oracle') },
    {
      icon: RefreshCw,
      label: 'Regenerate',
      run: () => {
        flash('Regenerating…')
        onRegenerate(messageId)
      },
    },
  ]

  return (
    <div className="relative flex items-center gap-0.5">
      {hint && (
        <motion.span
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-full mr-2 whitespace-nowrap text-[10px] text-faint"
        >
          {hint}
        </motion.span>
      )}
      {actions.map(({ icon: Icon, label, run }) => (
        <button
          key={label}
          type="button"
          onClick={run}
          aria-label={label}
          title={label}
          className="flex size-7 items-center justify-center rounded-full text-faint opacity-100 transition-all duration-200 hover:bg-tint/[0.06] hover:text-foreground focus-visible:opacity-100 active:scale-90 lg:opacity-0 lg:group-hover:opacity-100"
        >
          <Icon size={13} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

/**
 * Card footer — a quiet \"Read complete\" cue on the left and the message
 * actions on the right. Fades in once the stream finishes. Actions are
 * always visible on touch (no hover), hidden until hover on desktop.
 */
function CardFooter({
  card,
  messageId,
  onRegenerate,
  onSave,
}: {
  card: OracleCard
  messageId: string
  onRegenerate: (id: string) => void
  onSave?: () => 'saved' | 'exists' | null
}) {
  const isWarning = card.kind === 'warning'
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: ease.smooth }}
      className={cn(
        'flex items-center justify-between gap-3 border-t border-border pt-4',
        isWarning && 'border-transparent',
      )}
    >
      {!isWarning && (
        <div className="flex items-center gap-1.5 text-[11px] text-faint">
          <Check size={12} strokeWidth={2.25} className="text-positive" />
          Read complete
        </div>
      )}
      <MessageActions card={card} messageId={messageId} onRegenerate={onRegenerate} onSave={onSave} />
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Analysis — the signature mini-Bloomberg report                      */
/* ------------------------------------------------------------------ */

const AnalysisCardView = memo(function AnalysisCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: AnalysisCard
  streaming: boolean
  progress: number
  footer?: ReactNode
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
          <BulletList items={card.reasoning} />
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

        {footer}
      </div>
    </GlassCard>
  )
})

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

const LiquidityCardView = memo(function LiquidityCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: LiquidityCard
  streaming: boolean
  progress: number
  footer?: ReactNode
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
        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* Trade setup                                                         */
/* ------------------------------------------------------------------ */

const TradeSetupCardView = memo(function TradeSetupCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: TradeSetupCard
  streaming: boolean
  progress: number
  footer?: ReactNode
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

        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* Comparison — side-by-side read of two assets                        */
/* ------------------------------------------------------------------ */

const ComparisonCardView = memo(function ComparisonCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: ComparisonCard
  streaming: boolean
  progress: number
  footer?: ReactNode
}) {
  const order = ['table', 'conclusion']
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={ArrowLeftRight}
        title="Comparison"
        subtitle={`${card.primary.ticker} vs ${card.secondary.ticker} · ${card.timeframe} window`}
      />
      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible={show('table')}>
          {/* Negative margins keep the table flush with the card while
              it scrolls horizontally on narrow screens. */}
          <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[20rem] border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="pb-2.5 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
                  >
                    Metric
                  </th>
                  <th scope="col" className="pb-2.5 pr-4 text-left text-xs font-semibold text-foreground">
                    {card.primary.ticker}
                  </th>
                  <th scope="col" className="pb-2.5 text-left text-xs font-semibold text-foreground">
                    {card.secondary.ticker}
                  </th>
                </tr>
              </thead>
              <tbody>
                {card.rows.map((row) => (
                  <tr key={row.metric} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 pr-4 text-[13px] text-muted">{row.metric}</td>
                    <td className="py-2.5 pr-4 text-[13px] font-medium text-foreground">{row.primary}</td>
                    <td className="py-2.5 text-[13px] text-foreground/85">{row.secondary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <CardSection visible={show('conclusion')} label="Conclusion">
          <p className="text-[13px] leading-relaxed text-foreground/85">{card.conclusion}</p>
        </CardSection>

        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* Market brief — scannable daily read                                 */
/* ------------------------------------------------------------------ */

const MarketBriefCardView = memo(function MarketBriefCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: MarketBriefCard
  streaming: boolean
  progress: number
  footer?: ReactNode
}) {
  const order = ['headline', 'happening', 'why', 'watch']
  const total = order.length
  const show = (slot: string) => !streaming || progress >= (order.indexOf(slot) + 1) / total

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={Newspaper}
        title="Market Brief"
        subtitle={`${card.market} · ${card.ticker} · ${card.timeframe} window`}
      />
      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible={show('headline')}>
          <p className="text-[15px] font-medium leading-relaxed tracking-tight text-foreground">
            {card.headline}
          </p>
        </Reveal>

        <CardSection visible={show('happening')} label="What's happening">
          <BulletList items={card.happening} />
        </CardSection>

        <CardSection visible={show('why')} label="Why it matters">
          <BulletList items={card.whyItMatters} />
        </CardSection>

        <CardSection visible={show('watch')} label="What to watch">
          <BulletList items={card.watch} />
        </CardSection>

        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* Educational                                                         */
/* ------------------------------------------------------------------ */

const EducationalCardView = memo(function EducationalCardView({
  card,
  streaming,
  progress,
  footer,
}: {
  card: EducationalCard
  streaming: boolean
  progress: number
  footer?: ReactNode
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

        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* Warning — amber advisory                                            */
/* ------------------------------------------------------------------ */

const WarningCardView = memo(function WarningCardView({
  card,
  progress,
  footer,
}: {
  card: WarningCard
  progress: number
  footer?: ReactNode
}) {
  // Fade in just after the leading card begins streaming, so a follow-up
  // advisory never jumps in ahead of the analysis.
  if (progress < 0.15) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: ease.smooth }}
    >
      <div className="rounded-panel border border-warning/30 bg-warning/[0.07] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10">
            <AlertTriangle size={14} strokeWidth={1.75} className="text-warning" />
          </span>
          <p className="text-sm font-semibold tracking-tight text-foreground">{card.title}</p>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">{card.body}</p>
      </div>
      {footer && <div className="mt-2 px-1">{footer}</div>}
    </motion.div>
  )
})

/* ------------------------------------------------------------------ */
/* AI analysis — the normalized model router output                    */
/* ------------------------------------------------------------------ */

function biasTone(bias: AiAnalysisCard['analysis']['bias']): 'positive' | 'negative' | 'neutral' {
  return bias === 'bullish' ? 'positive' : bias === 'bearish' ? 'negative' : 'neutral'
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const AiAnalysisCardView = memo(function AiAnalysisCardView({
  card,
  footer,
}: {
  card: AiAnalysisCard
  footer?: ReactNode
}) {
  const { analysis, meta } = card
  const tone = biasTone(analysis.bias)
  const setup = analysis.setup

  const setupLine =
    setup.family === 'none'
      ? 'No setup is forming in this window.'
      : [
          setup.family.replace(/_/g, ' '),
          setup.level,
          setup.direction ? `· ${setup.direction}` : '',
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <GlassCard className="overflow-hidden">
      <CardHeader
        icon={Sparkles}
        title="Oracle Analysis"
        subtitle={`${analysis.sourceData.symbol} · ${analysis.sourceData.timeframe} · ${card.modelLabel}`}
        badge={
          <Badge variant={tone} size="sm">
            {analysis.bias}
          </Badge>
        }
      />

      <div className="space-y-5 p-5 sm:p-6">
        <Reveal visible>
          <p className="text-sm leading-relaxed text-foreground/90">{analysis.summary}</p>
        </Reveal>

        <Reveal visible>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Setup</p>
              <p className="mt-1.5 text-[13px] font-medium capitalize text-foreground">{setupLine}</p>
              {setup.entryArea && <p className="mt-1 text-[11px] text-muted">{setup.entryArea}</p>}
            </div>
            <div className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Nearest liquidity
              </p>
              <p className="mt-1.5 font-mono text-[13px] tabular-nums text-foreground">
                {analysis.liquidity.nearestBuy ? `${analysis.liquidity.nearestBuy} above` : '— above'}
              </p>
              <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">
                {analysis.liquidity.nearestSell ? `${analysis.liquidity.nearestSell} below` : '— below'}
              </p>
            </div>
            <div className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Invalidation</p>
              <p className="mt-1.5 text-[13px] leading-snug text-foreground">
                {analysis.invalidation ?? 'None supplied'}
              </p>
            </div>
          </div>
        </Reveal>

        {analysis.liquidity.notes.length > 0 && (
          <CardSection visible label="Liquidity notes">
            <BulletList items={analysis.liquidity.notes} />
          </CardSection>
        )}

        <Reveal visible>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Displacement</p>
              <p className="mt-1.5 text-[13px] font-medium text-foreground">
                {analysis.displacement.present
                  ? `${analysis.displacement.direction ?? '—'} · strength ${analysis.displacement.strength ?? '—'}/100`
                  : 'Not detected in this window'}
              </p>
              {analysis.displacement.notes.length > 0 && (
                <p className="mt-1 text-[11px] text-muted">{analysis.displacement.notes.join(' · ')}</p>
              )}
            </div>
            <div className="rounded-panel border border-border bg-tint/[0.03] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Confirmation</p>
              <p className="mt-1.5 text-[13px] font-medium text-foreground">
                {analysis.confirmation.present ? (analysis.confirmation.kind ?? 'present') : 'None yet'}
              </p>
              {analysis.confirmation.description && (
                <p className="mt-1 text-[11px] text-muted">{analysis.confirmation.description}</p>
              )}
            </div>
          </div>
        </Reveal>

        <Reveal visible>
          <ConfidenceMeter value={analysis.confidence} tone={tone} className="w-full sm:w-64" />
        </Reveal>

        {analysis.reasoning.length > 0 && (
          <CardSection visible label="Why Oracle read it this way">
            <BulletList items={analysis.reasoning} />
          </CardSection>
        )}

        {analysis.risks.length > 0 && (
          <CardSection visible label="Risks">
            <div className="rounded-panel border border-warning/25 bg-warning/[0.06] p-3.5">
              <ul className="space-y-2">
                {analysis.risks.map((risk) => (
                  <li key={risk} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85">
                    <AlertTriangle size={12} strokeWidth={1.75} className="mt-1 shrink-0 text-warning" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </CardSection>
        )}

        {/* Provenance — server-stamped data facts + request metadata. */}
        <Reveal visible>
          <div className="rounded-panel border border-border/70 bg-tint/[0.02] px-3.5 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-faint">Source data</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {analysis.sourceData.source} · {analysis.sourceData.symbol} · {analysis.sourceData.timeframe} ·{' '}
              {analysis.sourceData.candleCount} candles · freshness:{' '}
              <span className={analysis.sourceData.freshness === 'live' ? 'text-positive' : 'text-muted'}>
                {analysis.sourceData.freshness}
              </span>
              {!analysis.sourceData.dataComplete && ' · incomplete data'}
            </p>
            {meta && (
              <p className="mt-1 text-[11px] text-faint">
                {meta.provider} · {formatLatency(meta.latencyMs)}
                {meta.promptTokens !== null && meta.completionTokens !== null
                  ? ` · ${meta.promptTokens + meta.completionTokens} tokens`
                  : ''}
                {meta.estimatedCostUsd !== null ? ` · ~$${meta.estimatedCostUsd.toFixed(4)} est` : ''}
              </p>
            )}
          </div>
        </Reveal>

        {footer}
      </div>
    </GlassCard>
  )
})

/* ------------------------------------------------------------------ */
/* AI error — an honest failure, never a silent pretend-success        */
/* ------------------------------------------------------------------ */

const AiErrorCardView = memo(function AiErrorCardView({
  card,
  footer,
}: {
  card: AiErrorCard
  footer?: ReactNode
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: ease.smooth }}>
      <div className="rounded-panel border border-warning/30 bg-warning/[0.07] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10">
            <AlertTriangle size={14} strokeWidth={1.75} className="text-warning" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {card.modelLabel} could not complete the analysis
            </p>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-warning/90">{card.code}</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-foreground/85">{card.message}</p>
        {card.detail && <p className="mt-1.5 text-xs leading-relaxed text-muted">{card.detail}</p>}
        <p className="mt-3 text-[11px] text-faint">
          Your chart and market data are unaffected. You can retry, or switch models in the Oracle model selector.
        </p>
      </div>
      {footer && <div className="mt-2 px-1">{footer}</div>}
    </motion.div>
  )
})

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

export function OracleResponseCard({
  message,
  onStreamed,
  onRegenerate,
  onSave,
}: {
  message: OracleMessage
  onStreamed: (id: string) => void
  onRegenerate: (id: string) => void
  onSave?: (message: OracleMessage) => 'saved' | 'exists' | null
}) {
  const card = message.card as OracleCard
  const streaming = message.streaming ?? false
  const progress = useProgressive(streaming)

  useEffect(() => {
    if (streaming && progress >= 1) onStreamed(message.id)
  }, [streaming, progress, message.id, onStreamed])

  // Built once per message so memoized card views skip re-renders on
  // streaming progress frames — only the footer's own mount fades in.
  const footer = useMemo(
    () =>
      !streaming ? (
        <CardFooter
          card={card}
          messageId={message.id}
          onRegenerate={onRegenerate}
          onSave={onSave ? () => onSave(message) : undefined}
        />
      ) : null,
    [card, streaming, message.id, onRegenerate, onSave, message],
  )

  switch (card.kind) {
    case 'analysis':
      return <AnalysisCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'liquidity':
      return <LiquidityCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'trade-setup':
      return <TradeSetupCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'comparison':
      return <ComparisonCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'market-brief':
      return <MarketBriefCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'educational':
      return <EducationalCardView card={card} streaming={streaming} progress={progress} footer={footer} />
    case 'warning':
      return <WarningCardView card={card} progress={progress} footer={footer} />
    case 'ai':
      return <AiAnalysisCardView card={card} footer={footer} />
    case 'ai-error':
      return <AiErrorCardView card={card} footer={footer} />
  }
}
