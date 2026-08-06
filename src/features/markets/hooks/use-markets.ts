import { useCallback, useEffect, useMemo, useState } from 'react'

import { coins } from '../data'
import type { Coin, MarketFilter } from '../types'

const DEFAULT_FAVORITES = new Set(['bitcoin', 'ethereum', 'solana'])

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
  loading: boolean
}

export function useMarkets(): UseMarketsResult {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MarketFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(DEFAULT_FAVORITES))
  const [loading, setLoading] = useState(true)

  // Simulate a short initial fetch so skeletons get a moment to breathe.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 650)
    return () => window.clearTimeout(timer)
  }, [])

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
  }, [query, filter, favorites])

  const selected = useMemo(
    () => coins.find((coin) => coin.id === selectedId) ?? null,
    [selectedId],
  )

  const select = useCallback((id: string | null) => setSelectedId(id), [])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

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
  }
}
