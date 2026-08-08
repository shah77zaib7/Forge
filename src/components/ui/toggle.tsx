import { motion } from 'framer-motion'

import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
  disabled?: boolean
  className?: string
}

/** Quiet glass switch — the standard on/off control in settings. */
export function Toggle({ checked, onChange, 'aria-label': ariaLabel, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-tint/30',
        checked ? 'border-border-strong bg-tint/[0.14]' : 'border-border bg-tint/[0.04]',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
        className="absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full border border-border bg-surface-0 shadow-ambient"
      />
    </button>
  )
}
