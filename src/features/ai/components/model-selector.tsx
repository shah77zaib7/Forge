import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Orbit, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'

import { modelInfo } from '../models'
import { useAi } from '../store'
import type { AiModelId } from '../types'

/**
 * The Oracle model selector — a compact toolbar control. Shows the active
 * model, lists every server model with its key-free availability, and
 * persists the choice. Unavailable models are visibly disabled with the
 * key NAME they need (never a value). When the availability report is
 * unreachable (local dev), only the Local engine is enabled — honest.
 * `dropUp` opens the list above the trigger — used in the bottom-anchored
 * Oracle composer where a downward list would overflow the viewport.
 * `align` picks which side of the trigger the list grows from: 'right'
 * suits buttons flush with the right edge (chart toolbar); 'left' keeps
 * the list on-screen when the trigger sits mid-row (Oracle composer,
 * where a right-anchored 16rem panel would extend off the left edge).
 */
export function ModelSelector({
  className,
  dropUp = false,
  align = 'right',
}: {
  className?: string
  dropUp?: boolean
  align?: 'left' | 'right'
}) {
  const { modelId, setModelId, models, available, gatewayOf, requiresOf, fetchState, refreshAvailability } = useAi()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = modelInfo(modelId)
  const reportMissing = fetchState === 'error'

  function pick(id: AiModelId) {
    if (!available(id)) return
    setModelId(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Oracle model"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground',
          open && 'text-foreground',
        )}
      >
        <Orbit size={11} strokeWidth={1.75} className="text-faint" />
        <span className="hidden sm:inline">{active.label}</span>
        <span className="sm:hidden">{active.label.split(' ')[0]}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.75}
          className={cn('text-faint transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: dropUp ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? -4 : 4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="listbox"
            aria-label="Oracle models"
            className={cn(
              'absolute z-40 w-60 max-w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-background/95 p-1.5 shadow-float backdrop-blur-xl',
              align === 'left' ? 'left-0' : 'right-0',
              dropUp ? 'bottom-full mb-2' : 'mt-2',
            )}
          >
            <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-faint">
              Oracle model
            </p>
            {/* The list itself scrolls on very short viewports — the panel
                never runs off-screen; the header + footer stay pinned. */}
            <div className="max-h-[min(20rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain">
            {models.map((model) => {
              const isAvailable = available(model.id)
              const isActive = model.id === modelId
              const gateway = gatewayOf(model.id)
              const requires = requiresOf(model.id)
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={!isAvailable}
                  onClick={() => pick(model.id)}
                  title={
                    isAvailable
                      ? gateway
                        ? `${model.label} via ${gateway}`
                        : model.description
                      : `Not configured — requires ${requires.join(' or ')}`
                  }
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-150',
                    isAvailable && 'hover:bg-tint/[0.06]',
                    isAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-45',
                    isActive && 'bg-tint/[0.06]',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('size-1.5 shrink-0 rounded-full', isAvailable ? 'bg-positive' : 'bg-faint')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-nowrap text-xs font-medium text-foreground">{model.label}</span>
                    <span className="block truncate text-[10px] text-muted">
                      {isAvailable ? (gateway ?? model.providerLabel) : requires.join(' · ')}
                    </span>
                  </span>
                  {isActive && <Check size={13} strokeWidth={2.25} className="shrink-0 text-positive" />}
                </button>
              )
            })}
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-border px-2.5 pb-1 pt-2">
              <span className="text-[10px] text-faint">
                {reportMissing ? 'Unavailable locally' : fetchState === 'loading' ? 'Checking…' : 'Key-free status'}
              </span>
              <button
                type="button"
                onClick={refreshAvailability}
                aria-label="Refresh model availability"
                title="Refresh availability"
                className="flex size-6 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground active:scale-90"
              >
                <RefreshCw size={11} strokeWidth={1.75} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
