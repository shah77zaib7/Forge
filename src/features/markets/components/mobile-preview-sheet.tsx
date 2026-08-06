import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { ArrowUpRight, Orbit, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'
import { ease } from '@/design/motion'

import type { Coin } from '../types'
import { CoinPreview } from './coin-preview'

/** Pull-to-dismiss thresholds — drag past either to close. */
const CLOSE_OFFSET = 120
const CLOSE_VELOCITY = 700

interface MobilePreviewSheetProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
}

/**
 * The mobile "workspace" — a native-feeling bottom sheet that rises over
 * the list and fills ~92% of the viewport. Handles its own focus, Escape,
 * scroll lock and drag-to-dismiss from the handle.
 */
export function MobilePreviewSheet({
  coin,
  favorited,
  onToggleFavorite,
  onClose,
}: MobilePreviewSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  useEffect(() => {
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
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [onClose])

  return createPortal(
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
        aria-label={`${coin.name} workspace`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{
          y: { type: 'spring', bounce: 0.15, duration: 0.55 },
          // Snappier settle for non-y values (the drag scale).
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
        className="absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-hero glass-strong shadow-float"
      >
        {/* Drag handle — full-width touch strip with the grip pill.
            Safe-area top keeps it clear of device chrome. */}
        <div className="relative shrink-0">
          <div
            onPointerDown={(event) => dragControls.start(event)}
            aria-hidden
            className="flex cursor-grab touch-none items-center justify-center px-20 pb-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] active:cursor-grabbing"
          >
            <div className="h-1.5 w-11 rounded-full bg-tint/[0.18]" />
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close workspace"
            className="absolute right-5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
          >
            <X size={17} />
          </button>
        </div>

        {/* Scrollable content — the sheet itself never scrolls, so the
            footer can stay pinned. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-10 pt-2">
          <AnimatePresence mode="wait" initial={false}>
            <CoinPreview
              key={coin.id}
              coin={coin}
              favorited={favorited}
              onToggleFavorite={onToggleFavorite}
              variant="sheet"
            />
          </AnimatePresence>
        </div>

        {/* Sticky primary actions — always reachable, clear of the
            home indicator via the safe-area bottom padding. */}
        <div className="shrink-0 border-t border-border bg-background/50 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-4 backdrop-blur-2xl">
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" className="w-full px-4">
              Open Workspace
              <ArrowUpRight size={16} strokeWidth={2} />
            </Button>
            <Button size="lg" variant="secondary" className="w-full px-4">
              <Orbit size={16} strokeWidth={1.75} />
              Ask Oracle
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
