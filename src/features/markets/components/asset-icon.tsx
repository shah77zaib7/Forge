import { useEffect, useMemo, useState } from 'react'

import { useCoins } from '@/store/market-data'
import { cn } from '@/lib/cn'

const sizes = {
  sm: 'size-8 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-16 text-2xl',
  xl: 'size-20 text-3xl',
} as const

export type AssetIconSize = keyof typeof sizes

export interface AssetIconProps {
  /** Asset ticker — the stable identity key (e.g. "BTC"). */
  ticker: string
  /** Brand hue used by the letter-fallback tile (identification, not decoration). */
  color: string
  size?: AssetIconSize
  className?: string
  /**
   * Explicit logo reference — overrides the canonical-store lookup.
   * Future asset classes (metals, forex, stocks, indices) supply their own
   * reference here or on the asset identity without touching this component.
   */
  logoUrl?: string
}

/**
 * Forge's single asset-visual primitive. Renders the asset's real logo —
 * resolved from the canonical market-data store by ticker, or from an
 * explicit `logoUrl` — inside the standard brand tile, and degrades to the
 * coin's monogram whenever the logo is missing or fails to load. Never
 * blank, never broken: the letter layer sits underneath and only fades out
 * once the logo has actually decoded.
 */
export function AssetIcon({ ticker, color, size = 'md', className, logoUrl }: AssetIconProps) {
  const coins = useCoins()
  const resolved = useMemo(() => coins.find((coin) => coin.ticker === ticker), [coins, ticker])
  const logo = logoUrl ?? resolved?.logoUrl ?? null

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  // A new logo reference resets the load state so the fallback never lingers.
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [logo])

  const showLogo = logo !== null && !failed

  // Fallback monogram: crypto uses the ticker initial ("B" for BTC); other
  // asset classes use the name initial ("G" for Gold, "S" for Silver) so
  // nearby tickers like XAU/XAG never read as identical marks.
  const letter =
    resolved && resolved.assetClass !== 'crypto' ? resolved.name.slice(0, 1) : ticker.slice(0, 1)

  return (
    <div
      aria-hidden
      className={cn(
        'relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-border ring-1 ring-inset ring-tint/10',
        sizes[size],
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
      }}
    >
      {/* Letter fallback — visible until the real logo has decoded. */}
      <span
        className={cn(
          'font-semibold transition-opacity duration-200 motion-reduce:transition-none',
          showLogo && loaded && 'opacity-0',
        )}
        style={{ color: `color-mix(in oklab, ${color} 68%, var(--forge-foreground))` }}
      >
        {letter}
      </span>

      {showLogo && (
        <img
          key={logo}
          src={logo}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 size-full rounded-full object-cover transition-opacity duration-200 motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
