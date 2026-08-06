import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { Coin } from '../types'
import { CoinPreview } from './coin-preview'

interface MobilePreviewSheetProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
  onClose: () => void
}

/**
 * The mobile "workspace" — a floating glass sheet that slides up over
 * the list. Handles its own focus, Escape and scroll lock.
 */
export function MobilePreviewSheet({
  coin,
  favorited,
  onToggleFavorite,
  onClose,
}: MobilePreviewSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
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
        role="dialog"
        aria-modal="true"
        aria-label={`${coin.name} workspace`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', bounce: 0.12, duration: 0.5 }}
        className="absolute inset-x-3 bottom-3 max-h-[88dvh] overflow-y-auto overscroll-contain rounded-hero glass-strong p-6 shadow-float"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-tint/[0.15]" aria-hidden />
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close workspace"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
        >
          <X size={16} />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <CoinPreview
            key={coin.id}
            coin={coin}
            favorited={favorited}
            onToggleFavorite={onToggleFavorite}
          />
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
