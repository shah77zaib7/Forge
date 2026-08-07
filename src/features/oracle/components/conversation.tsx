import { motion } from 'framer-motion'
import { Orbit, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframeId } from '@/features/workspace/data'

import { getGreeting, suggestions } from '../data'
import type { OracleMessage, Suggestion } from '../types'
import { OracleResponseCard } from './response-card'
import { SuggestionChips } from './suggestion-chips'

/* ------------------------------------------------------------------ */
/* Empty state — the analyst's greeting                                */
/* ------------------------------------------------------------------ */

function EmptyState({
  coin,
  timeframeId,
  onPickSuggestion,
}: {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onPickSuggestion: (suggestion: Suggestion) => void
}) {
  const greeting = useMemo(() => getGreeting(), [])

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-2 pb-24 pt-8 text-center">
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
        className="mt-4 flex items-center gap-2 rounded-full border border-border bg-tint/[0.03] px-3 py-1 text-[11px] font-medium text-muted"
      >
        <Sparkles size={11} strokeWidth={1.75} className="text-faint" />
        Analyzing {coin.name} · {timeframeId} window
      </motion.p>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16 }}
        className="mt-4 max-w-xl text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
      >
        {greeting}
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.24 }}
        className="mt-3 max-w-md text-sm leading-relaxed text-muted"
      >
        Ask about structure, liquidity, momentum or a full trading plan — I'll read the window and
        show you what I see.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.32 }}
        className="mt-7"
      >
        <SuggestionChips suggestions={suggestions} onPick={onPickSuggestion} />
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function UserMessage({ text, time }: { text: string; time: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-end"
    >
      <div className="max-w-[85%] rounded-hero glass px-4 py-2.5">
        <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
        <p className="mt-1 text-right text-[10px] tabular-nums text-faint">{time}</p>
      </div>
    </motion.div>
  )
}

function OracleMessageView({
  message,
  onStreamed,
}: {
  message: OracleMessage
  onStreamed: (id: string) => void
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <OracleResponseCard message={message} onStreamed={onStreamed} />
      <p className="mt-2 pl-1 text-[10px] tabular-nums text-faint">{message.time}</p>
    </motion.div>
  )
}

/** Shimmer skeleton shown while Oracle "thinks" before a response. */
function ThinkingSkeleton() {
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
            <p className="text-xs font-medium text-foreground">Oracle is reading the market</p>
            <p className="text-[11px] text-faint">Weighing structure, liquidity, volume and momentum…</p>
          </div>
        </div>
        <div className="mt-4 space-y-2" aria-hidden>
          <div className="h-2.5 w-full animate-pulse rounded-full bg-tint/[0.06]" />
          <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-tint/[0.05]" />
          <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-tint/[0.04]" />
        </div>
      </GlassCard>
    </motion.div>
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
  onStreamed,
  onPickSuggestion,
}: {
  messages: OracleMessage[]
  isThinking: boolean
  hasStreaming: boolean
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onStreamed: (id: string) => void
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
    return <EmptyState coin={coin} timeframeId={timeframeId} onPickSuggestion={onPickSuggestion} />
  }

  return (
    <div role="log" aria-live="polite" className="space-y-5">
      {messages.map((message) =>
        message.role === 'user' ? (
          <UserMessage key={message.id} text={message.text ?? ''} time={message.time} />
        ) : (
          <OracleMessageView key={message.id} message={message} onStreamed={onStreamed} />
        ),
      )}
      {isThinking && <ThinkingSkeleton />}
      <div ref={bottomRef} className="h-1" />
    </div>
  )
}
