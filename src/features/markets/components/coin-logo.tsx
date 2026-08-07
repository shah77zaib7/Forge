import { cn } from '@/lib/cn'

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-16 text-2xl',
  xl: 'size-20 text-3xl',
} as const

interface CoinLogoProps {
  /** Coin ticker, used for the monogram. */
  ticker: string
  /** Brand hue — identification, not decoration. */
  color: string
  size?: keyof typeof sizes
  className?: string
}

/**
 * A soft, brand-tinted tile with the coin's monogram. The tint and the
 * glyph color are mixed toward the current foreground so the mark stays
 * legible in both themes without introducing loud colors.
 */
export function CoinLogo({ ticker, color, size = 'md', className }: CoinLogoProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full border border-border font-semibold ring-1 ring-inset ring-tint/10',
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
        color: `color-mix(in oklab, ${color} 68%, var(--forge-foreground))`,
      }}
    >
      {ticker.slice(0, 1)}
    </div>
  )
}
