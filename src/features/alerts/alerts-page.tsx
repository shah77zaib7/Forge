import { motion } from 'framer-motion'
import { Bell, BellOff, BellPlus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { ease } from '@/design/motion'
import { useCoins } from '@/store/market-data'
import { useAlerts, type PriceAlert } from '@/store/alerts'
import { cn } from '@/lib/cn'

import { AlertSheet } from './alert-sheet'

const sections = [
  { key: 'active', label: 'Active' },
  { key: 'triggered', label: 'Triggered' },
  { key: 'inactive', label: 'Paused' },
] as const

function relativeTime(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function AlertRow({ alert }: { alert: PriceAlert }) {
  const navigate = useNavigate()
  const { toggleAlert, deleteAlert } = useAlerts()
  const coins = useCoins()
  const coin = coins.find((market) => market.id === alert.assetId)

  const verb = alert.condition === 'above' ? 'Above' : 'Below'
  const statusLabel =
    alert.status === 'active' ? 'Active' : alert.status === 'triggered' ? 'Triggered' : 'Paused'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/markets/${alert.assetId}`)}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          navigate(`/markets/${alert.assetId}`)
        }
      }}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-panel border border-transparent px-3 py-3 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30 hover:border-border hover:bg-tint/[0.04]"
    >
      {coin ? (
        <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-tint/[0.05]">
          <Bell size={14} strokeWidth={1.75} className="text-muted" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">
          {coin ? coin.name : alert.assetId}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {verb}{' '}
          <span className="font-mono tabular-nums text-foreground">
            ${formatMarketPrice(alert.targetPrice)}
          </span>
          {alert.status === 'triggered' && alert.triggeredPrice !== undefined && (
            <span className="text-muted">
              {' '}
              · fired at{' '}
              <span className="font-mono tabular-nums">${formatMarketPrice(alert.triggeredPrice)}</span>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-faint">
          {coin ? `Now ${formatMarketPrice(coin.price)}` : 'Market offline'} ·{' '}
          {relativeTime(alert.createdAt)}
        </p>
      </div>

      <Badge
        variant={
          alert.status === 'triggered'
            ? 'positive'
            : alert.status === 'active'
              ? 'neutral'
              : 'neutral'
        }
        size="sm"
        className={cn(
          alert.status === 'active' && 'text-foreground',
          alert.status === 'inactive' && 'opacity-60',
        )}
      >
        {statusLabel}
      </Badge>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          toggleAlert(alert.id)
        }}
        aria-label={alert.status === 'active' ? 'Pause alert' : 'Resume alert'}
        title={alert.status === 'active' ? 'Pause' : 'Resume'}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-foreground"
      >
        {alert.status === 'active' ? (
          <BellOff size={15} strokeWidth={1.75} />
        ) : (
          <Bell size={15} strokeWidth={1.75} />
        )}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          deleteAlert(alert.id)
        }}
        aria-label="Delete alert"
        title="Delete"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.06] hover:text-negative"
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
    </div>
  )
}

/**
 * Price Alerts — Forge's alert cockpit. Every alert is evaluated by the
 * shared alert engine on each real market-data refresh (no extra polling);
 * fired alerts land here under Triggered and as an in-app toast. Rows link
 * into the asset's Coin Workspace, and the toggle re-arms a fired alert.
 */
export function AlertsPage() {
  const { alerts } = useAlerts()
  const [sheetOpen, setSheetOpen] = useState(false)

  const grouped = useMemo(() => {
    const byStatus = { active: [], triggered: [], inactive: [] } as Record<
      'active' | 'triggered' | 'inactive',
      PriceAlert[]
    >
    for (const alert of alerts) byStatus[alert.status].push(alert)
    // Newest first within each group.
    for (const key of Object.keys(byStatus) as Array<'active' | 'triggered' | 'inactive'>) {
      byStatus[key].sort((a, b) => b.createdAt - a.createdAt)
    }
    return byStatus
  }, [alerts])

  const total = alerts.length
  const hasAny = total > 0

  return (
    <div className="mx-auto max-w-4xl pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">
            Workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Price Alerts
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            Levels that matter, watched on the live feed. When a price crosses a target, the alert
            fires once — here, and as a notification.
          </p>
        </div>
        <Button variant="primary" onClick={() => setSheetOpen(true)}>
          <BellPlus size={15} strokeWidth={1.75} />
          New alert
        </Button>
      </header>

      {!hasAny ? (
        <GlassCard padding="lg" className="flex flex-col items-center justify-center py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
            <Bell size={22} strokeWidth={1.5} className="text-muted" />
          </span>
          <h2 className="mt-5 text-lg font-medium tracking-tight text-foreground">No alerts yet</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Set a level above or below the current price and Forge will ping you the moment it's
            crossed.
          </p>
          <Button variant="secondary" className="mt-6" onClick={() => setSheetOpen(true)}>
            Create your first alert
          </Button>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {sections.map((section, sectionIndex) => {
            const list = grouped[section.key]
            if (list.length === 0) return null
            return (
              <section key={section.key}>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
                  {section.label} · {list.length}
                </p>
                <GlassCard padding="none" className="divide-y divide-border/60 px-2 py-1">
                  {list.map((alert, index) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(sectionIndex * 0.05 + index * 0.03, 0.35),
                        ease: ease.smooth,
                      }}
                    >
                      <AlertRow alert={alert} />
                    </motion.div>
                  ))}
                </GlassCard>
              </section>
            )
          })}
        </div>
      )}

      <AlertSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
