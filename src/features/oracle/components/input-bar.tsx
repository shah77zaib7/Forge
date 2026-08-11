import { motion } from 'framer-motion'
import { ArrowUp, CandlestickChart, History, Mic, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { AssetIcon } from '@/features/markets/components/asset-icon'
import type { Coin } from '@/features/markets/types'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/cn'
import { changeTone } from '@/lib/format'

import type { OracleMode } from '../types'

interface InputBarProps {
  onSend: (text: string, chart?: Coin) => void
  disabled?: boolean
  /** The currently analyzed asset — used by attach-chart and voice. */
  activeCoin: Coin
  /** Trader / Teacher persona — shapes how Oracle answers. */
  mode: OracleMode
  onModeChange: (mode: OracleMode) => void
  /** Opens the market-context sheet. */
  onOpenContext?: () => void
  /** Opens the saved-analysis history sheet. */
  onOpenHistory?: () => void
  historyCount?: number
}

/** How long the mock voice capture window runs before transcribing. */
const VOICE_CAPTURE_MS = 1900

/** Contextual mock dictations — rotating so repeats vary. */
function voicePhrases(coin: Coin): string[] {
  return [
    `Analyze ${coin.name}`,
    `Where is the liquidity for ${coin.ticker} right now?`,
    `Is ${coin.ticker} bullish?`,
    "Explain today's move",
    `Build a trading plan for ${coin.ticker}`,
    `Compare ${coin.name} with Ethereum`,
  ]
}

const toneOf = (coin: Coin): 'positive' | 'negative' | 'neutral' => changeTone(coin.change24h)

/**
 * The floating glass composer — pinned to the bottom of the conversation.
 * Attach-chart pins a live sparkline of the active coin to the message;
 * voice simulates a capture + transcription into the input. Send is the
 * live path. Enter submits, Shift+Enter makes a new line.
 */
export function InputBar({
  onSend,
  disabled = false,
  activeCoin,
  mode,
  onModeChange,
  onOpenContext,
  onOpenHistory,
  historyCount = 0,
}: InputBarProps) {
  const [text, setText] = useState('')
  const [attachment, setAttachment] = useState<Coin | null>(null)
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const statusTimer = useRef<number | null>(null)
  const voiceTimer = useRef<number | null>(null)
  const voiceIndex = useRef(0)

  const canSend = text.trim().length > 0 && !disabled

  // Keep the transient status line + timers tidy on unmount.
  useEffect(() => {
    return () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current)
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
    }
  }, [])

  function flashStatus(message: string) {
    setStatus(message)
    if (statusTimer.current) window.clearTimeout(statusTimer.current)
    statusTimer.current = window.setTimeout(() => setStatus(''), 1800)
  }

  function submit() {
    if (!canSend) return
    onSend(text, attachment ?? undefined)
    setText('')
    setAttachment(null)
    const el = textareaRef.current
    if (el) el.style.height = 'auto'
    textareaRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  /** Toggle a sparkline chart of the active coin onto the message. */
  function toggleAttach() {
    setAttachment((prev) => (prev ? null : activeCoin))
  }

  /** Mock voice — a short capture window, then a contextual transcription. */
  function toggleVoice() {
    if (listening) {
      // Cancel the capture mid-way.
      if (voiceTimer.current) window.clearTimeout(voiceTimer.current)
      setListening(false)
      setStatus('')
      return
    }
    setListening(true)
    setStatus('Listening…')
    voiceTimer.current = window.setTimeout(() => {
      const phrases = voicePhrases(activeCoin)
      const phrase = phrases[voiceIndex.current % phrases.length]
      voiceIndex.current += 1
      setText(phrase)
      setListening(false)
      flashStatus('Transcribed')
      textareaRef.current?.focus()
    }, VOICE_CAPTURE_MS)
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Controls — mode on the left, context + history on the right. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          size="sm"
          options={[
            { value: 'trader', label: 'Trader' },
            { value: 'teacher', label: 'Teacher' },
          ]}
          value={mode}
          onChange={onModeChange}
          aria-label="Oracle mode"
        />
        <div className="flex items-center gap-1.5">
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              aria-label={`Open Oracle history${historyCount > 0 ? ` (${historyCount} saved)` : ''}`}
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground"
            >
              <History size={12} strokeWidth={1.75} />
              History
              {historyCount > 0 && (
                <span className="rounded-full bg-tint/[0.08] px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-muted">
                  {historyCount}
                </span>
              )}
            </button>
          )}
          {onOpenContext && (
            <button
              type="button"
              onClick={onOpenContext}
              aria-label="Open market context"
              className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground"
            >
              <SlidersHorizontal size={12} strokeWidth={1.75} />
              Market context
            </button>
          )}
        </div>
      </div>

      <div className="glass rounded-hero p-1.5 shadow-float transition-colors duration-300 focus-within:border-border-strong">
        {/* Attached chart — a live sparkline pinned to the message. */}
        {attachment && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-1.5 flex items-center gap-2 rounded-full border border-border bg-tint/[0.04] px-2.5 py-1.5"
          >
            <AssetIcon ticker={attachment.ticker} color={attachment.color} size="sm" className="size-5 text-[9px]" />
            <span className="text-[11px] font-medium text-foreground">{attachment.name}</span>
            <Sparkline
              data={attachment.spark}
              width={56}
              height={20}
              tone={toneOf(attachment)}
              animated={false}
            />
            <span className="text-[10px] text-faint">chart attached</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attached chart"
              title="Remove chart"
              className="flex size-5 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground active:scale-90"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </motion.div>
        )}

        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={toggleAttach}
            aria-label={attachment ? 'Remove attached chart' : 'Attach chart'}
            title={attachment ? 'Remove chart' : 'Attach chart'}
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-tint/[0.06] active:scale-95',
              attachment ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            <CandlestickChart size={16} strokeWidth={1.75} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              autoGrow()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={listening ? 'Listening…' : 'just oracle it'}
            aria-label="Message Oracle"
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
          />

          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? 'Stop listening' : 'Voice input'}
            title={listening ? 'Stop listening' : 'Voice'}
            className={cn(
              'relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-tint/[0.06] active:scale-95',
              listening ? 'text-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {listening && (
              <motion.span
                aria-hidden
                initial={false}
                animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border border-foreground/30"
              />
            )}
            <Mic size={16} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full text-background transition-all duration-200',
              'bg-foreground hover:bg-foreground/85 active:scale-95',
              'disabled:pointer-events-none disabled:opacity-35',
            )}
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Transient status (Listening… / Transcribed) — rendered only while it
          has content so the idle composer hugs the bottom edge instead of
          reserving a permanent empty line. */}
      {status && (
        <p aria-live="polite" className="mt-2 text-center text-[11px] text-faint">
          {status}
        </p>
      )}
    </div>
  )
}
