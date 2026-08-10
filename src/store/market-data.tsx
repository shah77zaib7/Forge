import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'

import { ASSET_REGISTRY } from '@/features/markets/data'
import {
  fetchCoinGeckoGlobal,
  fetchCoinGeckoQuotes,
  type CoinGeckoQuote,
} from '@/features/markets/services/coingecko'
import { fetchMetalQuotes, type MetalQuote } from '@/features/markets/services/metals'
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

// Only assets with a configured live feed are fetched. Registry-only assets
// (dataSource 'none') are never requested and never shown with fabricated
// values. Crypto and spot metals come from separate providers and get their
// own request sets, each merged onto the same registry identities.
const CRYPTO_IDS = ASSET_REGISTRY.filter((asset) => asset.dataSource === 'coingecko').map(
  (asset) => asset.marketSymbol ?? asset.id,
)
const METAL_SYMBOLS = ASSET_REGISTRY.filter((asset) => asset.dataSource === 'goldapi').map(
  (asset) => (asset.marketSymbol ?? asset.id).toUpperCase(),
)

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

/**
 * Subscribe to every market-data emission (each completed refresh). Used by
 * non-React consumers — the price-alert engine evaluates on these emissions
 * instead of running its own polling loop.
 */
export function subscribeMarketData(listener: () => void): () => void {
  return subscribe(listener)
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
  // Match quotes to the registry by provider symbol; keep the stable internal id.
  const identityByMarketSymbol = new Map<string, { identity: CoinIdentity; internalId: string }>()
  for (const identity of ASSET_REGISTRY) {
    identityByMarketSymbol.set(identity.marketSymbol ?? identity.id, {
      identity,
      internalId: identity.id,
    })
  }
  const merged = new Map<string, Coin>()
  for (const coin of previous) merged.set(coin.id, coin)

  for (const quote of quotes) {
    const entry = identityByMarketSymbol.get(quote.id)
    if (!entry) continue
    const { identity, internalId } = entry
    const lastKnown = merged.get(internalId)
    merged.set(internalId, {
      id: internalId,
      name: quote.name || identity.name,
      ticker: quote.symbol || identity.ticker,
      price: quote.priceUsd,
      change24h: quote.change24hPct ?? lastKnown?.change24h ?? null,
      marketCap: quote.marketCapUsd ?? lastKnown?.marketCap ?? null,
      volume24h: quote.volume24hUsd ?? lastKnown?.volume24h ?? null,
      supply: quote.supply ?? identity.supply ?? lastKnown?.supply ?? null,
      high24h: quote.high24hUsd ?? lastKnown?.high24h ?? null,
      low24h: quote.low24hUsd ?? lastKnown?.low24h ?? null,
      categories: identity.categories,
      trending: identity.trending,
      color: identity.color,
      spark: quote.spark,
      blurb: identity.blurb,
      logoUrl: quote.logoUrl ?? lastKnown?.logoUrl,
      assetClass: identity.assetClass,
      quoteCurrency: identity.quoteCurrency,
      decimals: identity.decimals,
      dataSource: identity.dataSource,
      tvSymbol: identity.tvSymbol,
    })
  }

  // Live market-cap order first (the feed arrives cap-descending), then any
  // last-known stragglers in registry order.
  const ordered: Coin[] = []
  for (const quote of quotes) {
    const entry = identityByMarketSymbol.get(quote.id)
    if (entry) {
      const coin = merged.get(entry.internalId)
      if (coin) {
        ordered.push(coin)
        merged.delete(entry.internalId)
      }
    }
  }
  for (const identity of ASSET_REGISTRY) {
    const coin = merged.get(identity.id)
    if (coin) {
      ordered.push(coin)
      merged.delete(identity.id)
    }
  }
  return ordered
}

/**
 * Overlay spot-metal quotes (gold-api.com, price only) onto the merged
 * universe. Metals appear only once a real quote has arrived; on later
 * refreshes they keep their last-known price when the feed hiccups. The
 * fields gold-api doesn't supply stay null — surfaces render an honest
 * dash instead of a fabricated figure.
 */
function mergeMetals(coins: Coin[], metals: MetalQuote[]): Coin[] {
  const identityBySymbol = new Map<string, CoinIdentity>()
  for (const identity of ASSET_REGISTRY) {
    if (identity.dataSource !== 'goldapi') continue
    identityBySymbol.set(identity.marketSymbol ?? identity.id, identity)
  }

  const result = [...coins]
  for (const metal of metals) {
    const identity = identityBySymbol.get(metal.id)
    if (!identity) continue
    const next: Coin = {
      id: identity.id,
      name: identity.name,
      ticker: identity.ticker,
      price: metal.priceUsd,
      change24h: null,
      marketCap: null,
      volume24h: null,
      supply: null,
      high24h: null,
      low24h: null,
      categories: identity.categories,
      trending: identity.trending,
      color: identity.color,
      spark: [],
      blurb: identity.blurb,
      logoUrl: identity.logoUrl,
      assetClass: identity.assetClass,
      quoteCurrency: identity.quoteCurrency,
      decimals: identity.decimals,
      dataSource: identity.dataSource,
      tvSymbol: identity.tvSymbol,
    }
    const existing = result.findIndex((coin) => coin.id === identity.id)
    if (existing >= 0) result[existing] = next
    else result.push(next)
  }
  return result
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
        // The global snapshot and the spot-metals feed are nice-to-haves
        // (dominance degrades to a dash; metals keep last-known or stay
        // out) — either failing must not discard fresh crypto quotes.
        const [quotes, global, metals] = await Promise.all([
          fetchCoinGeckoQuotes(CRYPTO_IDS, current.signal),
          fetchCoinGeckoGlobal(current.signal).catch(() => null),
          fetchMetalQuotes(METAL_SYMBOLS, current.signal).catch(() => null),
        ])
        if (disposed || controller !== current) return
        const coins = mergeQuotes(snapshot.coins, quotes)
        emit({
          coins: metals ? mergeMetals(coins, metals) : coins,
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
