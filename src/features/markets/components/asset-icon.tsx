import { useEffect, useMemo, useRef, useState } from 'react'

import { useCoins, useMarketData } from '@/store/market-data'
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

/** How many times a failed logo load is retried with backoff before waiting
 * for the next market-data refresh to re-arm. */
const RETRY_ATTEMPTS = 3
const RETRY_BASE_MS = 1200

/**
 * Forge's single asset-visual primitive. Renders the asset's real logo —
 * resolved from the canonical market-data store by ticker, or from an
 * explicit `logoUrl` — inside the standard brand tile, and degrades to the
 * coin's monogram whenever the logo is missing or fails to load. Never
 * blank, never broken: the letter layer sits underneath and only fades out
 * once the logo has actually decoded.
 *
 * Transient failures are self-healing: a logo that fails to load is retried
 * with short backoff, and once the retry budget is spent it re-arms on the
 * next real market-data refresh (the app's normal poll — no extra requests).
 * A one-off network hiccup can never permanently pin an asset to its
 * fallback initial.
 */
export function AssetIcon({ ticker, color, size = 'md', className, logoUrl }: AssetIconProps) {
  const coins = useCoins()
  const { lastUpdated } = useMarketData()
  const resolved = useMemo(() => coins.find((coin) => coin.ticker === ticker), [coins, ticker])
  const logo = logoUrl ?? resolved?.logoUrl ?? null

  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // A new logo reference (asset change, or the feed first supplying a logo)
  // starts a fresh load cycle — stale failure/loaded state never carries
  // over to a different asset.
  useEffect(() => {
    setLoaded(false)
    setFailed(false)
    setAttempt(0)
  }, [logo])

  // Retry a transiently failed load with backoff: 1.2s, 2.4s, 4.8s.
  useEffect(() => {
    if (!failed || attempt >= RETRY_ATTEMPTS) return
    const timer = window.setTimeout(
      () => setFailed(false),
      RETRY_BASE_MS * 2 ** Math.max(attempt - 1, 0),
    )
    return () => window.clearTimeout(timer)
  }, [failed, attempt])

  // Once the retry budget is spent, re-arm on the next real market-data
  // emission (the store's normal refresh cadence). If the network has
  // recovered by then the logo loads; if not, the next refresh tries again.
  const previousLastUpdated = useRef(lastUpdated)
  useEffect(() => {
    if (previousLastUpdated.current === lastUpdated) return
    previousLastUpdated.current = lastUpdated
    if (failed) {
      setFailed(false)
      setAttempt(0)
    }
  }, [lastUpdated, failed])

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
          // attempt is part of the key so each retry remounts the element and
          // issues a fresh request (a src change alone would not).
          key={`${logo}:${attempt}`}
          src={logo}
          alt=""
          // Eager loading makes the load/failure lifecycle deterministic —
          // lazy images that scroll out of view can have their fetch aborted,
          // which looked like a real failure and pinned the fallback initial.
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true)
            setAttempt((previous) => previous + 1)
          }}
          className={cn(
            'absolute inset-0 size-full rounded-full object-cover transition-opacity duration-200 motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  )
}
