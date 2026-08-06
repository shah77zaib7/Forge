import { motion, type HTMLMotionProps } from 'framer-motion'

import { micro } from '@/design/motion'
import { cn } from '@/lib/cn'

const base =
  // touch-pan-y: let the browser own vertical panning so framer's tap
  // gesture never preventDefaults (and blocks) page scrolling on touch.
  'inline-flex touch-pan-y select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40'

const variants = {
  /** The foreground tone — the single loud action on a screen. */
  primary: 'bg-foreground text-background hover:bg-foreground/85',
  /** Liquid glass with a hairline border. */
  secondary: 'glass text-foreground hover:border-border-strong',
  /** Quiet, for tertiary actions. */
  ghost: 'text-muted hover:bg-tint/[0.05] hover:text-foreground',
  /** Hairline outline, for structured actions. */
  outline: 'border border-border text-foreground hover:border-border-strong hover:bg-tint/[0.05]',
} as const

const sizes = {
  sm: 'h-8 px-4 text-xs',
  md: 'h-10 px-6 text-sm',
  lg: 'h-12 px-8 text-[15px]',
} as const

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={micro}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}
