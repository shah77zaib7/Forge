import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, X } from 'lucide-react'
import { useEffect, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AssetIcon } from '@/features/markets/components/asset-icon'
import { useCoins } from '@/store/market-data'
import { useAlerts, type AlertToast } from '@/store/alerts'
import { cn } from '@/lib/cn'
import { formatMarketPrice } from '@/features/markets/lib/format'

const AUTO_DISMISS_MS = 7000

function ToastItem({ toast }: { toast: AlertToast }) {
  const navigate = useNavigate()
  const { dismissToast } = useAlerts()
  const coins = useCoins()
  const coin = coins.find((market) => market.id === toast.assetId)

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.alertId), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [toast.alertId, dismissToast])

  const verb = toast.condition === 'above' ? 'crossed above' : 'dropped below'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
      role="button"
      tabIndex={0}
      onClick={() => {
        dismissToast(toast.alertId)
        if (coin) navigate(`/markets/${coin.id}`)
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          dismissToast(toast.alertId)
          if (coin) navigate(`/markets/${coin.id}`)
        }
      }}
      className="pointer-events-auto flex w-full max-w-sm cursor-pointer items-center gap-3 rounded-panel border border-border-strong bg-background/95 p-3 shadow-float backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-tint/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint/[0.06] text-foreground">
        <BellRing size={16} strokeWidth={1.75} />
      </span>
      {coin && (
        <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" className="hidden sm:flex" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">
          {coin ? coin.ticker : 'Price alert'} {verb} ${formatMarketPrice(toast.targetPrice)}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">
          Now {coin ? formatMarketPrice(toast.triggeredPrice) : ''} · tap to open
        </span>
      </span>      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          dismissToast(toast.alertId)
        }}
        aria-label="Dismiss notification"
        className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </motion.div>
  )
}

/**
 * The in-app notification stack for fired price alerts. Rendered once at
 * the app root; each toast auto-dismisses, can be dismissed manually, and
 * opens the alert's asset workspace on tap.
 */
export function ToastViewport() {
  const { toasts } = useAlerts()

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4',
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.alertId} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
