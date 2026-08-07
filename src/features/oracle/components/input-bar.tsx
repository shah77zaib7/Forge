import { ArrowUp, CandlestickChart, Mic, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '@/lib/cn'

interface InputBarProps {
  onSend: (text: string) => void
  disabled?: boolean
  /** Mobile only — opens the market-context bottom sheet. */
  onOpenContext?: () => void
}

/** "Coming soon" micro-toast shown for the decorative actions. */
function useSoonHint() {
  const [hint, setHint] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const show = (message: string) => {
    setHint(message)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHint(null), 1700)
  }

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  return { hint, show }
}

/**
 * The floating glass composer — pinned to the bottom of the conversation.
 * Attach-chart and voice are decorative placeholders for now; send is the
 * live path. Enter submits, Shift+Enter makes a new line.
 */
export function InputBar({ onSend, disabled = false, onOpenContext }: InputBarProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { hint, show } = useSoonHint()

  const canSend = text.trim().length > 0 && !disabled

  function submit() {
    if (!canSend) return
    onSend(text)
    setText('')
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      {onOpenContext && (
        <div className="mb-2 flex justify-end lg:hidden">
          <button
            type="button"
            onClick={onOpenContext}
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground"
          >
            <SlidersHorizontal size={12} strokeWidth={1.75} />
            Market context
          </button>
        </div>
      )}

      <div className="glass rounded-hero p-1.5 shadow-float transition-colors duration-300 focus-within:border-border-strong">
        <div className="flex items-end gap-1">
          <button
            type="button"
            onClick={() => show('Chart attach arrives with live charts')}
            aria-label="Attach chart (coming soon)"
            title="Attach chart"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
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
            placeholder="Ask Oracle anything about the market..."
            aria-label="Ask Oracle anything about the market"
            className="max-h-28 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
          />

          <button
            type="button"
            onClick={() => show('Voice input lands with the live Oracle')}
            aria-label="Voice input (coming soon)"
            title="Voice"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
          >
            <Mic size={16} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full text-background transition-all duration-200',
              'bg-foreground hover:bg-foreground/85',
              'disabled:pointer-events-none disabled:opacity-35',
            )}
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <p aria-live="polite" className="mt-2 h-4 text-center text-[11px] text-faint">
        {hint ?? ''}
      </p>
    </div>
  )
}
