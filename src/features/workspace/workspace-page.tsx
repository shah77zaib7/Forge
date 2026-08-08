import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { useFavorites } from '@/store/favorites'

import { coins } from '@/features/markets/data'

import { HeroChart } from './components/hero-chart'
import { LiquiditySnapshot } from './components/liquidity-snapshot'
import { MarketStatus } from './components/market-status'
import { MarketStats } from './components/market-stats'
import { NewsList } from './components/news-list'
import { NotesCard } from './components/notes-card'
import { OracleSummary } from './components/oracle-summary'
import { QuickActions } from './components/quick-actions'
import { RelatedMarkets } from './components/related-markets'
import { Reveal } from './components/reveal'
import { WorkspaceHeader } from './components/workspace-header'
import { DEFAULT_LIQUIDITY_TIMEFRAME, liquidityTimeframes, type LiquidityTimeframeId } from './data'

/**
 * The Coin Workspace — Forge's heart. A calm, luxurious single-market
 * terminal: identity and price up top, a pulse read of the window, then
 * a two-column read on desktop (chart / oracle / news / notes left,
 * fundamentals / depth / related right) that stacks into the section
 * order below on mobile. Sections gently fade in as they scroll into
 * view. The liquidity timeframe is shared state here, so Market Status,
 * Oracle and the Depth book all update as one.
 */
export function WorkspacePage() {
  const { coinId } = useParams<{ coinId: string }>()
  const coin = coins.find((market) => market.id === coinId)
  const { favorites, toggleFavorite } = useFavorites()

  const [timeframeId, setTimeframeId] = useState<LiquidityTimeframeId>(DEFAULT_LIQUIDITY_TIMEFRAME)
  const timeframe = useMemo(
    () =>
      liquidityTimeframes.find((tf) => tf.id === timeframeId) ??
      liquidityTimeframes.find((tf) => tf.id === DEFAULT_LIQUIDITY_TIMEFRAME)!,
    [timeframeId],
  )

  if (!coin) return <Navigate to="/markets" replace />

  const favorited = favorites.has(coin.id)

  return (
    <div className="mx-auto max-w-6xl pb-28 lg:pb-0">
      <Reveal>
        <WorkspaceHeader coin={coin} favorited={favorited} onToggleFavorite={toggleFavorite} />
      </Reveal>

      <Reveal>
        <MarketStatus coin={coin} timeframe={timeframe} />
      </Reveal>

      {/* Explicit minmax(0,1fr) tracks at every breakpoint so the
          related-markets rail's wide content can never blow out the
          single-column grid on mobile (auto tracks size to max-content). */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Left column — the market read */}
        <Reveal className="lg:col-start-1 lg:row-start-1">
          <HeroChart coin={coin} />
        </Reveal>
        <Reveal className="lg:col-start-1 lg:row-start-2">
          <OracleSummary coin={coin} timeframe={timeframe} />
        </Reveal>
        <Reveal className="lg:col-start-1 lg:row-start-3">
          <NewsList coin={coin} />
        </Reveal>
        <Reveal className="lg:col-start-1 lg:row-start-4">
          <NotesCard coin={coin} />
        </Reveal>

        {/* Right column — secondary insights */}
        <Reveal className="lg:col-start-2 lg:row-start-1">
          <MarketStats coin={coin} />
        </Reveal>
        <Reveal className="lg:col-start-2 lg:row-start-2">
          <LiquiditySnapshot
            coin={coin}
            timeframeId={timeframeId}
            onTimeframeChange={setTimeframeId}
          />
        </Reveal>
        <Reveal className="lg:col-start-2 lg:row-start-3">
          <RelatedMarkets coin={coin} />
        </Reveal>
      </div>

      <QuickActions coin={coin} favorited={favorited} onToggleFavorite={() => toggleFavorite(coin.id)} />
    </div>
  )
}
