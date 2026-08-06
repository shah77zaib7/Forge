import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

const variants = {
  neutral: 'border border-border bg-tint/[0.06] text-muted',
  positive: 'border border-positive/25 bg-positive/10 text-positive',
  negative: 'border border-negative/25 bg-negative/10 text-negative',
} as const

const sizes = {
  sm: 'h-5 gap-2 px-3 text-[11px]',
  md: 'h-6 gap-2 px-3 text-xs',
} as const

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  /** Small status dot — green/red only for market state. */
  dot?: boolean
}

export function Badge({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tracking-[0.01em]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-90" />}
      {children}
    </span>
  )
}
