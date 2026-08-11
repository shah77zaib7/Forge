import { motion } from 'framer-motion'
import { Check, Orbit, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { Sparkline } from '@/components/ui/sparkline'
import { ease } from '@/design/motion'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframeId } from '@/features/workspace/data'
import { cn } from '@/lib/cn'
import { changeTone } from '@/lib/format'

import { getGreeting, suggestions, THINK_STEPS } from '../data'
import type { OracleMessage, OracleMode, Suggestion } from '../types'
import { OracleResponseCard } from './response-card'
import { SuggestionChips } from './suggestion-chips'

/* ------------------------------------------------------------------ */
/* Empty state — the analyst's greeting                                */
/* ------------------------------------------------------------------ */

function EmptyState({
  coin,
  timeframeId,
  mode,
  onPickSuggestion,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  mode: OracleMode
  onPickSuggestion: (suggestion: Suggestion) => void
}) {
  const greeting = useMemo(() => getGreeting(), [])

  // Sized to the usable area: one dynamic viewport minus the measured
  // composer height and the fixed top chrome (status pill + page offset),
  // so the greeting centers above the composer instead of behind it.
  return (
    <div className="flex min-h-[calc(100dvh_-_var(--forge-composer-h,13.5rem)_-_9rem)] flex-col items-center justify-center px-2 pt-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex size-12 items-center justify-center rounded-glass border border-border bg-tint/[0.05]"
      >
        <Orbit size={22} strokeWidth={1.5} className="text-muted" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="mt-5 flex items-center gap-2 rounded-full border border-border bg-tint/[0.03] px-3 py-1 text-[11px] font-medium text-muted"
      >
        <Sparkles size={11} strokeWidth={1.75} className="text-faint" />
        Analyzing {coin.name} · {timeframeId} window
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16 }}
        className="mt-5 max-w-xl text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
      >
        {greeting}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.24 }}
        className="mt-3.5 max-w-md text-sm leading-relaxed text-muted"
      >
        Ask about structure, liquidity, momentum or a full trading plan — I'll read the window and
        show you what I see.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.3 }}
        className="mt-2.5 text-xs text-faint"
      >
        {mode === 'teacher'
          ? "Teacher mode — I'll explain the why behind every read as we go."
          : 'Trader mode — concise reads with levels, setups and risk.'}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.32 }}
        className="mt-8"
      >
        <SuggestionChips suggestions={suggestions} onPick={onPickSuggestion} />
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function UserMessage({ text, time, chart }: { text: string; time: string; chart?: Coin }) {
  const chartTone: 'positive' | 'negative' | 'neutral' = chart ? changeTone(chart.change24h) : 'neutral'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] rounded-hero glass px-4 py-3">
        <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
        {chart && (
          <div className="mt-2.5 flex items-center gap-2.5 rounded-panel border border-border bg-tint/[0.03] px-2.5 py-2">
            <AssetIcon ticker={chart.ticker} color={chart.color} size="sm" className="size-6 text-[10px]" />
            <Sparkline data={chart.spark} width={72} height={24} tone={chartTone} />
            <span className="text-[10px] font-medium text-faint">{chart.ticker} · chart</span>
          </div>
        )}
        <p className="mt-1.5 text-right text-[10px] tabular-nums text-faint">{time}</p>
      </div>
    </motion.div>
  )
}

function OracleMessageView({
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="group"
    >
      {/* Analyst byline — a quiet icon + timestamp above every read. */}
      <div className="mb-2 flex items-center gap-2 pl-1">
        <span className="flex size-5 items-center justify-center rounded-md border border-border bg-tint/[0.05]">
          <Orbit size={10} strokeWidth={1.75} className="text-faint" />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-faint">Oracle</span>
        <span className="text-[10px] tabular-nums text-faint/80">{message.time}</span>
        {message.fromHistory && (
          <span className="rounded-full border border-border bg-tint/[0.04] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-faint">
            From history
          </span>
        )}
      </div>
      <OracleResponseCard
        message={message}
        onStreamed={onStreamed}
        onRegenerate={onRegenerate}
        onSave={onSave}
      />
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Thinking — the staged analysis sequence                             */
/* ------------------------------------------------------------------ */

function ThinkingStep({ label, state }: { label: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: state === 'pending' ? 0.45 : 1, x: 0 }}
      transition={{ duration: 0.25, ease: ease.smooth }}
      className="flex items-center gap-2.5 text-[13px]"
    >
      {state === 'done' ? (
        <motion.span
          initial={{ scale: 0.4 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.4 }}
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-positive/15"
        >
          <Check size={9} strokeWidth={3} className="text-positive" />
        </motion.span>
      ) : state === 'active' ? (
        <span className="size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-border-strong border-t-transparent" />
      ) : (
        <span className="size-3.5 shrink-0 rounded-full border border-border-strong/50" />
      )}
      <span
        className={cn(
          state === 'done' && 'text-muted',
          state === 'active' && 'text-foreground',
          state === 'pending' && 'text-faint',
        )}
      >
        {label}…
      </span>
    </motion.li>
  )
}

/** The analyst's staged read — each lens completes with a check. */
function ThinkingSkeleton({
  coin,
  timeframeId,
  mode,
  modelLabel,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  mode: OracleMode
  modelLabel: string
}) {
  const [step, setStep] = useState(0)
  const steps = THINK_STEPS.map((label, index) =>
    index === THINK_STEPS.length - 1 && mode === 'teacher' ? 'Preparing the lesson' : label,
  )

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, THINK_STEPS.length - 1)), 560)
    return () => window.clearInterval(id)
  }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <GlassCard className="p-5">
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ opacity: [0.35, 1, 0.35] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            className="flex size-9 items-center justify-center rounded-lg border border-border bg-tint/[0.05]"
          >
            <Orbit size={15} strokeWidth={1.75} className="text-muted" />
          </motion.span>
          <div>
            <p className="text-xs font-medium text-foreground">
              Analyzing {coin.name} · {modelLabel}
            </p>
            <p className="text-[11px] text-faint">Reading the {timeframeId} window across five lenses…</p>
          </div>
        </div>
        <ul className="mt-5 space-y-2.5">
          {steps.map((label, index) => (
            <ThinkingStep
              key={label}
              label={label}
              state={index < step ? 'done' : index === step ? 'active' : 'pending'}
            />
          ))}
        </ul>
      </GlassCard>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* Status + dividers                                                   */
/* ------------------------------------------------------------------ */

/** Tiny live indicator — Ready when idle, Analyzing… while busy,
 *  Updated just now once a read lands. */
function OracleStatusPill({ state }: { state: 'ready' | 'analyzing' | 'updated' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-tint/[0.03] px-3 py-1 text-[10px] font-medium text-muted">
        {state === 'analyzing' ? (
          <>
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted/60 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-muted" />
            </span>
            Analyzing…
          </>
        ) : state === 'ready' ? (
          <>
            <span className="size-1.5 rounded-full bg-positive" aria-hidden />
            Ready
          </>
        ) : (
          <>
            <span className="size-1.5 rounded-full bg-positive" aria-hidden />
            Updated just now
          </>
        )}
      </div>
    </motion.div>
  )
}

/** Elegant hairline separator between conversation chapters. */
function ConversationDivider({ label }: { label: string }) {
  return (
    <div role="separator" className="flex items-center gap-3 py-1" aria-label={label}>
      <div className="h-px flex-1 bg-tint/[0.07]" />
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">{label}</span>
      <div className="h-px flex-1 bg-tint/[0.07]" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Conversation                                                        */
/* ------------------------------------------------------------------ */

export function Conversation({
  messages,
  isThinking,
  hasStreaming,
  coin,
  timeframeId,
  mode,
  modelLabel,
  onStreamed,
  onRegenerate,
  onSave,
  onPickSuggestion,
}: {
  messages: OracleMessage[]
  isThinking: boolean
  hasStreaming: boolean
  coin: Coin
  timeframeId: LiquidityTimeframeId
  mode: OracleMode
  /** The active Oracle model — shown while a request is in flight. */
  modelLabel: string
  onStreamed: (id: string) => void
  onRegenerate: (id: string) => void
  onSave?: (message: OracleMessage) => 'saved' | 'exists' | null
  onPickSuggestion: (suggestion: Suggestion) => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Follow new messages and the thinking state.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, isThinking])

  // Stay pinned to the bottom while a response is streaming in.
  useEffect(() => {
    if (!hasStreaming) return
    const id = window.setInterval(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }, 240)
    return () => window.clearInterval(id)
  }, [hasStreaming])

  if (messages.length === 0 && !isThinking) {
    return (
      <div className="space-y-6">
        <OracleStatusPill state="ready" />
        <EmptyState
          coin={coin}
          timeframeId={timeframeId}
          mode={mode}
          onPickSuggestion={onPickSuggestion}
        />
      </div>
    )
  }

  const status: 'analyzing' | 'updated' = isThinking || hasStreaming ? 'analyzing' : 'updated'

  return (
    <div role="log" aria-live="polite" className="space-y-6">
      <OracleStatusPill state={status} />

      {messages.map((message, index) => {
        // A user message that starts a fresh exchange gets a chapter divider.
        // Adjacent user bubbles (post-regenerate) still split on a divider.
        const isNewAnalysis =
          message.role === 'user' &&
          (index === 0 ||
            messages[index - 1]?.role === 'oracle' ||
            messages[index - 1]?.role === 'user')

        return (
          <Fragment key={message.id}>
            {isNewAnalysis && <ConversationDivider label={index === 0 ? 'Today' : 'New Analysis'} />}
            {message.role === 'user' ? (
              <UserMessage text={message.text ?? ''} time={message.time} chart={message.chart} />
            ) : (
              <OracleMessageView
                message={message}
                onStreamed={onStreamed}
                onRegenerate={onRegenerate}
                onSave={onSave}
              />
            )}
          </Fragment>
        )
      })}

      {isThinking && <ThinkingSkeleton coin={coin} timeframeId={timeframeId} mode={mode} modelLabel={modelLabel} />}
      {/* scroll-margin keeps the newest card clear of the floating composer —
          sized from the same measured --forge-composer-h as the page clearance. */}
      <div ref={bottomRef} className="h-1 scroll-mb-[var(--forge-composer-h,13.5rem)]" />
    </div>
  )
}
