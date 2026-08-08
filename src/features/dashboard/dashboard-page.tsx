import { ActivePositions } from './components/active-positions'
import { MarketPulse } from './components/market-pulse'
import { OracleBrief } from './components/oracle-brief'
import { PortfolioCard } from './components/portfolio-card'
import { RecentActivity } from './components/recent-activity'
import { WatchlistPreview } from './components/watchlist-preview'

/**
 * Dashboard — Forge's command center. A quick read of the user's market
 * world: portfolio exposure, the lead tape, the watchlist, open positions,
 * an Oracle brief and recent activity. All figures come from the mock data
 * layer (swap-able for a real account/market API later).
 */
export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="pb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Dashboard</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          A single view of everything moving across your market world.
        </p>
      </header>

      <div className="space-y-6">
        <PortfolioCard />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MarketPulse />
          <WatchlistPreview />
        </div>

        <ActivePositions />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OracleBrief />
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
