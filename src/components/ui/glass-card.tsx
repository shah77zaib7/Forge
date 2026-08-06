import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const variants = {
  /** Standard liquid-glass panel. */
  default: 'glass rounded-panel',
  /** Brighter, more elevated surface. */
  strong: 'glass-strong rounded-panel',
  /** Recessed — sits visually behind sibling surfaces. */
  inset: 'rounded-panel border border-border bg-tint/[0.03] shadow-inset-top',
} as const

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
} as const

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants
  padding?: keyof typeof paddings
  /** Adds hover lift — use only for genuinely interactive surfaces. */
  interactive?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'default', padding = 'md', interactive = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variants[variant],
        paddings[padding],
        interactive &&
          'cursor-pointer transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:border-border-strong hover:bg-tint/[0.03] hover:shadow-float',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)

GlassCard.displayName = 'GlassCard'
