import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { ease } from '@/design/motion'
import { useMediaQuery } from '@/hooks/use-media-query'
import { isBodyScrollLocked, lockBodyScroll } from '@/lib/scroll-lock'
import { cn } from '@/lib/cn'

const CLOSE_OFFSET = 100
const CLOSE_VELOCITY = 650

interface SheetShellProps {
  open: boolean
  onClose: () => void
  /** Accessible dialog name, e.g. \"Market context\". */
  label: string
  title: ReactNode
  children: ReactNode
}

/**
 * Shared sheet chrome — a glass panel that rises from the bottom on
 * mobile and slides in from the right on desktop. Handles its own
 * focus, Escape, body scroll lock and drag-to-dismiss (mobile).
 */
export function SheetShell({ open, onClose, label, title, children }: SheetShellProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
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
        <div className="fixed inset-0 z-50">
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
            aria-label={label}
            initial={isDesktop ? { x: '100%' } : { y: '100%' }}
            animate={{ x: 0, y: 0 }}
            exit={isDesktop ? { x: '100%' } : { y: '100%' }}
            transition={{
              x: { type: 'spring', bounce: 0.15, duration: 0.5 },
              y: { type: 'spring', bounce: 0.15, duration: 0.5 },
              default: { duration: 0.2, ease: ease.smooth },
            }}
            drag={isDesktop ? false : 'y'}
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
            className={cn(
              'absolute flex flex-col overflow-hidden glass-strong shadow-float',
              isDesktop
                ? 'inset-y-0 right-0 w-[26rem] max-w-[92vw] rounded-l-hero'
                : 'inset-x-0 bottom-0 max-h-[84dvh] rounded-t-hero',
            )}
          >
            {!isDesktop && (
              <div
                onPointerDown={(event) => dragControls.start(event)}
                aria-hidden
                className="flex cursor-grab touch-none items-center justify-center px-20 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+0.6rem)] active:cursor-grabbing"
              >
                <div className="h-1.5 w-11 rounded-full bg-tint/[0.18]" />
              </div>
            )}
            <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">{title}</div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={`Close ${label}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
              >
                <X size={17} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pt-4 touch-pan-y">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
