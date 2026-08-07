import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'forge.favorites'
const DEFAULT_FAVORITES = new Set(['bitcoin', 'ethereum', 'solana'])

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_FAVORITES)
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id): id is string => typeof id === 'string'))
    }
    return new Set(DEFAULT_FAVORITES)
  } catch {
    return new Set(DEFAULT_FAVORITES)
  }
}

/**
 * The app-wide watchlist. Persisted to localStorage so a star in Markets
 * and a star in the Coin Workspace stay in sync — and across visits.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
    } catch {
      /* storage unavailable — ignore */
    }
  }, [favorites])

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

  return { favorites, toggleFavorite }
}
