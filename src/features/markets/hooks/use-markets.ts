import { useMemo, useState } from 'react'

import { useCoins, useMarketData } from '@/store/market-data'
import { useFavorites } from '@/store/favorites'

import type { Coin, MarketFilter } from '../types'

export interface UseMarketsResult {
  query: string
  setQuery: (value: string) => void
  filter: MarketFilter
  setFilter: (value: MarketFilter) => void
  selectedId: string | null
  select: (id: string | null) => void
  selected: Coin | null
  favorites: Set<string>
  toggleFavorite: (id: string) => void
  filtered: Coin[]
  /** True while the first market load is in flight. */
  loading: boolean
  /** True when the most recent refresh failed — visible values are stale. */
  stale: boolean
  error: string | null
  /** True once any real quotes have arrived. */
  hasData: boolean
  refresh: () => void
}

export function useMarkets(): UseMarketsResult {
  const coins = useCoins()
  const { loading, stale, error, refresh } = useMarketData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MarketFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Shared app-wide watchlist (localStorage-backed) so Markets and the
  // Coin Workspace star the same coins.
  const { favorites, toggleFavorite } = useFavorites()

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return coins.filter((coin) => {
      if (filter === 'favorites' && !favorites.has(coin.id)) return false
      if (filter === 'trending' && !coin.trending) return false
      if (filter !== 'all' && filter !== 'favorites' && filter !== 'trending') {
        if (!coin.categories.includes(filter)) return false
      }
      if (normalized) {
        const haystack = `${coin.name} ${coin.ticker}`.toLowerCase()
        if (!haystack.includes(normalized)) return false
      }
      return true
    })
  }, [coins, query, filter, favorites])

  const selected = useMemo(
    () => coins.find((coin) => coin.id === selectedId) ?? null,
    [coins, selectedId],
  )

  const select = (id: string | null) => setSelectedId(id)

  return {
    query,
    setQuery,
    filter,
    setFilter,
    selectedId,
    select,
    selected,
    favorites,
    toggleFavorite,
    filtered,
    loading,
    stale,
    error,
    hasData: coins.length > 0,
    refresh,
  }
}
