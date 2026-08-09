import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'

import { COIN_REGISTRY } from '@/features/markets/data'
import {
  fetchCoinGeckoGlobal,
  fetchCoinGeckoQuotes,
  type CoinGeckoQuote,
} from '@/features/markets/services/coingecko'
import type { Coin, CoinIdentity } from '@/features/markets/types'

export interface MarketDataSnapshot {
  /**
   * The live-merged universe — registry identity overlaid with real
   * CoinGecko quotes, ordered by market cap (descending). Contains no
   * fabricated values: coins only appear once a real quote exists.
   */
  coins: Coin[]
  /** BTC's share of total crypto market cap — null when the global feed is unavailable. */
  btcDominance: number | null
  /** True while the first load is in flight and nothing is available yet. */
  loading: boolean
  /** True when the most recent refresh failed — visible values are stale. */
  stale: boolean
  /** Last error message, or null when the last attempt succeeded. */
  error: string | null
  /** Epoch ms of the last successful fetch. */
  lastUpdated: number | null
}

const REFRESH_INTERVAL_MS = 60_000

const ALL_COIN_IDS = COIN_REGISTRY.map((coin) => coin.apiId ?? coin.id)

/* ------------------------------------------------------------------ */
/* Module store — Forge's single source of truth for market data.      */
/* React surfaces subscribe via useSyncExternalStore; non-React        */
/* services read the current snapshot with getCoins(). The             */
/* MarketDataProvider below owns the one polling loop for the app.     */
/* ------------------------------------------------------------------ */

let snapshot: MarketDataSnapshot = {
  coins: [],
  btcDominance: null,
  loading: true,
  stale: false,
  error: null,
  lastUpdated: null,
}

const listeners = new Set<() => void>()

function emit(next: MarketDataSnapshot): void {
  snapshot = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): MarketDataSnapshot {
  return snapshot
}

/** Current market universe snapshot — for services outside React. */
export function getCoins(): Coin[] {
  return snapshot.coins
}

export type MarketData = MarketDataSnapshot & { refresh: () => void }

export function useMarketData(): MarketData {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  return useMemo(() => ({ ...state, refresh: refreshMarketData }), [state])
}

/** The live-merged coin universe for components. */
export function useCoins(): Coin[] {
  return useMarketData().coins
}

let refreshHandler: (() => void) | null = null

/** Trigger an immediate refresh — used by manual retry surfaces. */
export function refreshMarketData(): void {
  refreshHandler?.()
}

/* ------------------------------------------------------------------ */
/* Merge — overlay real quotes on the identity registry. Coins missing */
/* from a response keep their last-known values (stale data beats      */
/* nothing), and coins with no value ever stay out of the list.        */
/* ------------------------------------------------------------------ */

function mergeQuotes(previous: Coin[], quotes: CoinGeckoQuote[]): Coin[] {
  // Match quotes to the registry by CoinGecko id; keep the stable internal id.
  const identityByApiId = new Map<string, { identity: CoinIdentity; internalId: string }>()
  for (const identity of COIN_REGISTRY) {
    identityByApiId.set(identity.apiId ?? identity.id, { identity, internalId: identity.id })
  }
  const merged = new Map<string, Coin>()
  for (const coin of previous) merged.set(coin.id, coin)

  for (const quote of quotes) {
    const entry = identityByApiId.get(quote.id)
    if (!entry) continue
    const { identity, internalId } = entry
    const lastKnown = merged.get(internalId)
    merged.set(internalId, {
      id: internalId,
      name: quote.name || identity.name,
      ticker: quote.symbol || identity.ticker,
      price: quote.priceUsd,
      change24h: quote.change24hPct,
      marketCap: quote.marketCapUsd,
      volume24h: quote.volume24hUsd ?? lastKnown?.volume24h ?? 0,
      supply: quote.supply ?? identity.supply,
      categories: identity.categories,
      trending: identity.trending,
      color: identity.color,
      spark: quote.spark,
      blurb: identity.blurb,
    })
  }

  // Live market-cap order first (the feed arrives cap-descending), then any
  // last-known stragglers in registry order.
  const ordered: Coin[] = []
  for (const quote of quotes) {
    const entry = identityByApiId.get(quote.id)
    if (entry) {
      const coin = merged.get(entry.internalId)
      if (coin) {
        ordered.push(coin)
        merged.delete(entry.internalId)
      }
    }
  }
  for (const identity of COIN_REGISTRY) {
    const coin = merged.get(identity.id)
    if (coin) {
      ordered.push(coin)
      merged.delete(identity.id)
    }
  }
  return ordered
}

/**
 * Owns the single market-data polling loop for the whole app. Mounted once
 * at the root; every surface reads the same store. Loads immediately,
 * refreshes on a fixed interval, pauses while the tab is hidden, and aborts
 * cleanly on unmount or superseding requests.
 */
export function MarketDataProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let disposed = false
    let controller: AbortController | null = null

    const load = async () => {
      // Supersede any request still in flight — only the newest may win.
      controller?.abort()
      const current = new AbortController()
      controller = current

      try {
        // The global snapshot is a nice-to-have (dominance degrades to a
        // dash) — its failure must not discard fresh quotes.
        const [quotes, global] = await Promise.all([
          fetchCoinGeckoQuotes(ALL_COIN_IDS, current.signal),
          fetchCoinGeckoGlobal(current.signal).catch(() => null),
        ])
        if (disposed || controller !== current) return
        emit({
          coins: mergeQuotes(snapshot.coins, quotes),
          btcDominance: global?.btcDominance ?? null,
          loading: false,
          stale: false,
          error: null,
          lastUpdated: Date.now(),
        })
      } catch (cause) {
        if (disposed || controller !== current) return
        // Keep any last-known values visible, but flag them as stale.
        emit({
          ...snapshot,
          loading: false,
          stale: true,
          error: cause instanceof Error ? cause.message : 'Market data unavailable',
        })
      }
    }

    refreshHandler = () => {
      void load()
    }
    void load()

    let interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)

    const onVisibility = () => {
      window.clearInterval(interval)
      if (document.visibilityState === 'visible') {
        // Returning to the tab should surface fresh data, not last cycle's.
        void load()
        interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      refreshHandler = null
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return children
}
