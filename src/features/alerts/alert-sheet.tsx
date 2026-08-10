import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { cn } from '@/lib/cn'
import { lockBodyScroll } from '@/lib/scroll-lock'
import { useCoins } from '@/store/market-data'
import { useAlerts, type AlertCondition } from '@/store/alerts'

interface AlertSheetProps {
  open: boolean
  onClose: () => void
  /** Pre-filled asset — the workspace opens the sheet for its own coin. */
  initialAssetId?: string
}

/**
 * Create-a-price-alert sheet. When opened from a coin workspace the asset
 * is fixed; when opened from the Alerts page the user picks from the live
 * universe. The target is validated against the asset's real current price,
 * which is shown live so the level always has context.
 */
export function AlertSheet({ open, onClose, initialAssetId }: AlertSheetProps) {
  const coins = useCoins()
  const { createAlert } = useAlerts()

  const [query, setQuery] = useState('')
  const [assetId, setAssetId] = useState<string | null>(initialAssetId ?? null)
  const [condition, setCondition] = useState<AlertCondition>('above')
  const [target, setTarget] = useState('')
  const [created, setCreated] = useState(false)

  // Reset whenever the sheet opens — fresh state for a fresh alert.
  useEffect(() => {
    if (open) {
      setQuery('')
      setAssetId(initialAssetId ?? null)
      setCondition('above')
      setTarget('')
      setCreated(false)
    }
  }, [open, initialAssetId])

  // The live coin backing the current selection — updates with the store.
  const coin = useMemo(
    () => coins.find((market) => market.id === assetId) ?? null,
    [coins, assetId],
  )

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = coins.filter(
      (market) =>
        !normalized ||
        `${market.name} ${market.ticker}`.toLowerCase().includes(normalized),
    )
    return list.slice(0, 8)
  }, [coins, query])

  const targetValue = target.trim() === '' ? NaN : Number(target)
  const valid = coin !== null && Number.isFinite(targetValue) && targetValue > 0
  const isAbove = condition === 'above'
  const alreadyTriggered =
    coin !== null && valid && (isAbove ? coin.price >= targetValue : coin.price <= targetValue)

  function handleSubmit() {
    if (!valid || !assetId) return
    if (createAlert({ assetId, targetPrice: targetValue, condition })) {
      setCreated(true)
      window.setTimeout(onClose, 450)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && valid) handleSubmit()
  }

  // Scroll lock while open; Escape closes.
  useEffect(() => {
    if (!open) return
    const unlock = lockBodyScroll()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlock()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Create price alert"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
            className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-hero border border-border bg-background/95 shadow-float backdrop-blur-2xl sm:max-w-md sm:rounded-panel"
          >
            {/* Handle for the bottom-sheet feel */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-tint/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-3 sm:pt-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Alerts</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
                  New price alert
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
              >
                <X size={17} strokeWidth={1.75} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {!initialAssetId && (
                <div className="mb-4">
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                    Asset
                  </label>
                  <div className="relative">
                    <Search
                      size={14}
                      strokeWidth={1.75}
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
                    />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search markets"
                      aria-label="Search markets"
                      className="h-10 w-full rounded-control border border-border bg-tint/[0.04] pl-9 pr-3 text-sm text-foreground outline-none transition-colors duration-200 placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30"
                    />
                  </div>

                  <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
                    {matches.length === 0 && (
                      <p className="px-2 py-3 text-xs text-faint">No markets match “{query}”.</p>
                    )}
                    {matches.map((market) => (
                      <button
                        key={market.id}
                        type="button"
                        onClick={() => setAssetId(market.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors duration-150',
                          assetId === market.id
                            ? 'bg-tint/[0.08]'
                            : 'hover:bg-tint/[0.05]',
                        )}
                      >
                        <AssetIcon ticker={market.ticker} color={market.color} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">
                            {market.name}
                          </span>
                          <span className="block font-mono text-[10px] uppercase text-faint">
                            {market.ticker}
                          </span>
                        </span>
                        <span className="font-mono text-xs tabular-nums text-muted">
                          {formatMarketPrice(market.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected asset + live price context */}
              <div className="mb-4 flex items-center gap-3 rounded-control border border-border bg-tint/[0.03] px-3 py-2.5">
                {coin ? (
                  <>
                    <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {coin.name}
                      </p>
                      <p className="font-mono text-[10px] uppercase text-faint">{coin.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[13px] font-medium tabular-nums text-foreground">
                        {formatMarketPrice(coin.price)}
                      </p>
                      <p className="text-[10px] text-faint">live price</p>
                    </div>
                  </>
                ) : (
                  <p className="py-1 text-xs text-faint">Select an asset to continue.</p>
                )}
              </div>

              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                Condition
              </label>
              <SegmentedControl
                size="sm"
                options={[
                  { value: 'above', label: 'Price above' },
                  { value: 'below', label: 'Price below' },
                ]}
                value={condition}
                onChange={setCondition}
                aria-label="Alert condition"
                className="mb-4 w-full [&>button]:flex-1"
              />

              <label
                htmlFor="alert-target"
                className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-faint"
              >
                Target price
              </label>
              <div className="relative mb-1.5">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-faint">
                  $
                </span>
                <input
                  id="alert-target"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={coin ? formatMarketPrice(coin.price) : '0.00'}
                  aria-label="Target price"
                  className="h-11 w-full rounded-control border border-border bg-tint/[0.04] pl-8 pr-3 font-mono text-sm tabular-nums text-foreground outline-none transition-colors duration-200 placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30"
                />
              </div>

              <p className="min-h-4 text-[11px] leading-relaxed text-muted">
                {!coin && 'Choose an asset first.'}
                {coin && !valid && `Current price is ${formatMarketPrice(coin.price)}.`}
                {coin && valid && !alreadyTriggered && (
                  <>
                    Alerts when {coin.ticker} moves {isAbove ? 'above' : 'below'}{' '}
                    <span className="font-mono">${formatMarketPrice(targetValue)}</span> — from{' '}
                    <span className="font-mono">{formatMarketPrice(coin.price)}</span>.
                  </>
                )}
                {coin && valid && alreadyTriggered && (
                  <span className="text-amber-600 dark:text-amber-400">
                    That level is already{' '}
                    {isAbove ? 'below' : 'above'} the current price — this alert will fire on the
                    next price update.
                  </span>
                )}
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-border/60 px-5 py-4">
              <Button
                variant="primary"
                size="lg"
                disabled={!valid || created}
                className="w-full"
                onClick={handleSubmit}
              >
                <Bell size={15} strokeWidth={1.75} />
                {created ? 'Alert created' : 'Create alert'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
