import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { ease } from '@/design/motion'
import { isBodyScrollLocked, lockBodyScroll } from '@/lib/scroll-lock'
import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframeId } from '@/features/workspace/data'

import type { MarketHealth } from '../data'
import { ContextPanel } from './context-panel'

const CLOSE_OFFSET = 100
const CLOSE_VELOCITY = 650

interface MobileContextSheetProps {
  open: boolean
  onClose: () => void
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
  health: MarketHealth
}

/**
 * Mobile stand-in for the desktop sidebar — a glass sheet that rises over
 * the conversation with the live context. Handles its own focus, Escape,
 * scroll lock and drag-to-dismiss.
 */
export function MobileContextSheet({
  open,
  onClose,
  ...panelProps
}: MobileContextSheetProps) {
  const dragControls = useDragControls()
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      // Lightweight focus trap — Tab cycles within the sheet.
      if (event.key === 'Tab') {
        const sheet = sheetRef.current
        if (!sheet) return
        const focusables = sheet.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (event.shiftKey) {
          if (active === first || !sheet.contains(active)) {
            event.preventDefault()
            last.focus()
          }
        } else if (active === last || !sheet.contains(active)) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const unlock = lockBodyScroll()
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlock()
      if (!isBodyScrollLocked()) previouslyFocused?.focus()
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Market context"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              y: { type: 'spring', bounce: 0.15, duration: 0.5 },
              default: { duration: 0.2, ease: ease.smooth },
            }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            dragMomentum={false}
            dragSnapToOrigin
            whileDrag={{ scale: 0.97 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > CLOSE_OFFSET || info.velocity.y > CLOSE_VELOCITY) onClose()
            }}
            className="absolute inset-x-0 bottom-0 flex h-[78dvh] flex-col overflow-hidden rounded-t-hero glass-strong shadow-float"
          >
            <div className="relative shrink-0">
              <div
                onPointerDown={(event) => dragControls.start(event)}
                aria-hidden
                className="flex cursor-grab touch-none items-center justify-center px-20 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] active:cursor-grabbing"
              >
                <div className="h-1.5 w-11 rounded-full bg-tint/[0.18]" />
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close market context"
                className="absolute right-5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
              >
                <X size={17} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pt-2 touch-pan-y">
              <ContextPanel {...panelProps} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
