import { WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * Shared fallback for any surface that needs market data but has none —
 * shown only when no real data has ever arrived, never with fake numbers.
 */
export function MarketDataError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-panel border border-dashed border-border px-6 py-8 text-center',
        className,
      )}
    >
      <WifiOff size={20} strokeWidth={1.5} className="text-faint" />
      <p className="mt-3 text-sm font-medium text-foreground">Market data unavailable</p>
      <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted">
        Forge couldn't reach the market feed. Prices will return once the connection is back.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

/** Calm skeleton placeholder for surfaces waiting on the first market load. */
export function MarketDataLoading({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden>
      <div className="h-2.5 w-40 animate-pulse rounded-full bg-tint/[0.07]" />
      <div className="h-28 animate-pulse rounded-panel border border-border bg-tint/[0.03]" />
      <div className="h-28 animate-pulse rounded-panel border border-border bg-tint/[0.03]" />
    </div>
  )
}
