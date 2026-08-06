import { AnimatePresence } from 'framer-motion'
import { SearchX } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks/use-media-query'

import { CoinList, CoinListSkeleton } from './components/coin-list'
import { CoinPreview } from './components/coin-preview'
import { EmptyState } from './components/empty-state'
import { FilterChip } from './components/filter-chip'
import { MobilePreviewSheet } from './components/mobile-preview-sheet'
import { SearchBar } from './components/search-bar'
import { SectionTitle } from './components/section-title'
import { marketFilters } from './data'
import { useMarkets } from './hooks/use-markets'

function NoResults({
  query,
  isFavorites,
  onClear,
}: {
  query: string
  isFavorites: boolean
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border px-6 py-12 text-center">
      <SearchX size={20} strokeWidth={1.5} className="text-faint" />
      <p className="mt-3 text-sm font-medium text-foreground">
        {isFavorites ? 'Your watchlist is empty' : 'No markets found'}
      </p>
      <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted">
        {isFavorites
          ? 'Star a market to build your personal watchlist.'
          : `Nothing matches “${query}”. Try a name or ticker.`}
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        {isFavorites ? 'Show all markets' : 'Clear search'}
      </Button>
    </div>
  )
}

/**
 * The Markets workspace.
 * Desktop: search + filters + list on the left, selected coin preview
 * on the right — each pane scrolls independently within the viewport.
 * Mobile: everything flows; tapping a coin opens a full-screen sheet.
 */
export function MarketsPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const {
    query,
    setQuery,
    filter,
    setFilter,
    selected,
    select,
    favorites,
    toggleFavorite,
    filtered,
    loading,
  } = useMarkets()

  const activeFilter = marketFilters.find((option) => option.id === filter) ?? marketFilters[0]
  const title = activeFilter.id === 'all' ? 'All Markets' : activeFilter.label

  // Stable identity so the sheet's focus/scroll effects don't re-run on coin change.
  const closeSheet = useCallback(() => select(null), [select])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-6 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* Left — search, filters, list */}
        <section className="flex min-h-0 flex-col gap-4">
          <SearchBar value={query} onChange={setQuery} />

          <div className="flex flex-wrap gap-2">
            {marketFilters.map((option) => (
              <FilterChip
                key={option.id}
                label={option.label}
                active={filter === option.id}
                onClick={() => setFilter(option.id)}
              />
            ))}
          </div>

          <SectionTitle
            title={title}
            meta={loading ? '…' : `${filtered.length} markets`}
            className="px-1"
          />

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-2 pr-1">
            {loading ? (
              <CoinListSkeleton />
            ) : filtered.length > 0 ? (
              <CoinList
                coins={filtered}
                selectedId={selected?.id ?? null}
                onSelect={select}
                favorites={favorites}
                onToggleFavorite={toggleFavorite}
              />
            ) : (
              <NoResults
                query={query}
                isFavorites={filter === 'favorites'}
                onClear={() => {
                  setQuery('')
                  setFilter('all')
                }}
              />
            )}
          </div>
        </section>

        {/* Right — selected coin preview (desktop only) */}
        <section className="hidden min-h-0 lg:block">
          <div className="h-full overflow-y-auto overscroll-contain pr-1">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <CoinPreview
                  key={selected.id}
                  coin={selected}
                  favorited={favorites.has(selected.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ) : (
                <EmptyState key="empty" />
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* Mobile — full-screen workspace sheet */}
      <AnimatePresence>
        {!isDesktop && selected && (
          <MobilePreviewSheet
            coin={selected}
            favorited={favorites.has(selected.id)}
            onToggleFavorite={toggleFavorite}
            onClose={closeSheet}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
