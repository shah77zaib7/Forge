import { Wallet } from 'lucide-react'

import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { portfolioSummary } from '../data'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/** Portfolio / exposure hero — the account read in one glance. */
export function PortfolioCard() {
  const portfolio = portfolioSummary()
  const positive = portfolio.change24h >= 0

  return (
    <GlassCard variant="strong" padding="lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Portfolio</p>
          <p className="mt-3 font-mono text-3xl font-medium tabular-nums tracking-tight text-foreground sm:text-4xl">
            ${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-2.5 flex items-center gap-2 text-sm">
            <span
              className={cn(
                'font-mono tabular-nums',
                positive ? 'text-positive' : 'text-negative',
              )}
            >
              {positive ? '+' : '−'}${Math.abs(portfolio.change24h).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={cn('font-mono text-xs tabular-nums', positive ? 'text-positive' : 'text-negative')}>
              ({formatChange(portfolio.change24hPct)})
            </span>
            <span className="text-xs text-faint">24h P&L</span>
          </p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
          <Wallet size={18} strokeWidth={1.75} className="text-muted" />
        </span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-4">
        <Stat label="Exposure" value={`${portfolio.exposurePct}%`} />
        <Stat
          label="Available"
          value={`$${portfolio.availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <Stat label="Open Positions" value={String(portfolio.openPositions)} />
        <Stat label="24h Change" value={formatChange(portfolio.change24hPct)} />
      </div>
    </GlassCard>
  )
}
