import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { playForgeInteraction } from '@/lib/ui-sound'

interface StarButtonProps {
  favorited: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
  className?: string
}

/** Favorite toggle — monochrome star with a small pop on change. */
export function StarButton({ favorited, onToggle, size = 'sm', className }: StarButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.75 }}
      onClick={(event) => {
        // Never let the toggle bubble to a parent selectable row.
        event.stopPropagation()
        playForgeInteraction()
        onToggle()
      }}
      aria-pressed={favorited}
      aria-label={favorited ? 'Remove from watchlist' : 'Add to watchlist'}
      className={cn(
        // touch-pan-y keeps touch scrolling working when a thumb lands on
        // a row's star (framer's tap gesture would otherwise eat the pan).
        'flex touch-pan-y shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground',
        size === 'sm' ? 'size-8' : 'size-9',
        className,
      )}
    >
      <motion.span
        key={favorited ? 'on' : 'off'}
        initial={{ scale: 0.5, rotate: -40 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', bounce: 0.4, duration: 0.4 }}
        className="flex"
      >
        <Star
          size={size === 'sm' ? 15 : 17}
          strokeWidth={1.75}
          className={cn('transition-colors duration-200', favorited && 'fill-foreground text-foreground')}
        />
      </motion.span>
    </motion.button>
  )
}
