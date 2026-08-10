import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'

import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'
import { playForgeInteraction } from '@/lib/ui-sound'

import { useTheme } from './theme'

interface ThemeToggleProps {
  className?: string
}

/** Switches between dark and light with a soft icon morph. */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        playForgeInteraction()
        toggleTheme()
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border border-border bg-tint/[0.04] text-muted transition-colors duration-200 hover:border-border-strong hover:bg-tint/[0.06] hover:text-foreground',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.28, ease: ease.smooth }}
          className="flex"
        >
          {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
