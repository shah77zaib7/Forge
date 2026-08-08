import { motion } from 'framer-motion'
import { Search, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { SelectControl } from '@/components/ui/select-control'
import { ease } from '@/design/motion'
import { coins } from '@/features/markets/data'
import { useFavorites } from '@/store/favorites'

import { CoinRow } from './components/coin-row'

type SortKey = 'name' | 'price' | 'change' | 'marketCap' | 'volume'
type ChangeFilter = 'all' | 'gainers' | 'losers'

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'change', label: '24h change' },
  { value: 'marketCap', label: 'Market cap' },
  { value: 'volume', label: 'Volume' },
]

/**
 * Watchlist — the user's starred markets, fed by the single shared
 * favorites store. Starring or unstarring anywhere (Markets, Coin
 * Workspace, Dashboard) reflects here instantly, and the list persists
 * locally.
 */
export function WatchlistPage() {
  const navigate = useNavigate()
  const { favorites, toggleFavorite } = useFavorites()

  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('marketCap')
  const [filter, setFilter] = useState<ChangeFilter>('all')

  const watchCoins = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const list = coins.filter((coin) => {
      if (!favorites.has(coin.id)) return false
      if (filter === 'gainers' && coin.change24h <= 0) return false
      if (filter === 'losers' && coin.change24h >= 0) return false
      if (normalized && !`${coin.name} ${coin.ticker}`.toLowerCase().includes(normalized)) return false
      return true
    })
    const sorted = [...list]
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price':
        sorted.sort((a, b) => b.price - a.price)
        break
      case 'change':
        sorted.sort((a, b) => b.change24h - a.change24h)
        break
      case 'volume':
        sorted.sort((a, b) => b.volume24h - a.volume24h)
        break
      case 'marketCap':
        sorted.sort((a, b) => b.marketCap - a.marketCap)
        break
    }
    return sorted
  }, [favorites, query, sort, filter])

  const isEmpty = favorites.size === 0
  const hasNoMatches = !isEmpty && watchCoins.length === 0

  return (
    <div className="mx-auto max-w-6xl pb-16">
      <header className="pb-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">Workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Watchlist</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Your curated set of instruments, synced across every surface.
        </p>
      </header>

      {isEmpty ? (
        <GlassCard padding="lg" className="flex flex-col items-center justify-center py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
            <Star size={22} strokeWidth={1.5} className="text-muted" />
          </span>
          <h2 className="mt-5 text-lg font-medium tracking-tight text-foreground">Your watchlist is empty</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Star any market to keep it here — from Markets, the Coin Workspace or anywhere else in
            Forge.
          </p>
          <Button variant="secondary" className="mt-6" onClick={() => navigate('/markets')}>
            Explore Markets
          </Button>
        </GlassCard>
      ) : (
        <>
          {/* Controls */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
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
                placeholder="Search watchlist"
                aria-label="Search watchlist"
                className="h-9 w-full rounded-control border border-border bg-tint/[0.04] pl-9 pr-3 text-xs text-foreground outline-none transition-colors duration-200 placeholder:text-faint hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30"
              />
            </div>
            <SelectControl
              value={sort}
              onChange={(value) => setSort(value as SortKey)}
              options={sortOptions}
              aria-label="Sort watchlist"
              className="w-40"
            />
            <SegmentedControl
              size="sm"
              options={[
                { value: 'all', label: 'All' },
                { value: 'gainers', label: 'Gainers' },
                { value: 'losers', label: 'Losers' },
              ]}
              value={filter}
              onChange={setFilter}
              aria-label="Filter watchlist"
            />
          </div>

          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            {watchCoins.length} {watchCoins.length === 1 ? 'asset' : 'assets'}
            {query.trim() && ' · filtered'}
          </p>

          {hasNoMatches ? (
            <GlassCard padding="lg" className="py-12 text-center">
              <p className="text-sm font-medium text-foreground">No matches</p>
              <p className="mt-1 text-xs text-faint">Try a different search or filter.</p>
            </GlassCard>
          ) : (
            <div className="space-y-1">
              {watchCoins.map((coin, index) => (
                <motion.div
                  key={coin.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4), ease: ease.smooth }}
                >
                  <CoinRow coin={coin} favorited onToggleFavorite={toggleFavorite} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
