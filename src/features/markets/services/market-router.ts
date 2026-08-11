/**
 * Market-data router — deterministic, asset-aware provider selection.
 *
 * The router is the only place that decides WHICH provider serves a given
 * asset + window + data type. The Liquidity Model and every UI surface stay
 * provider-agnostic: they consume normalized CandleSeries. Assets without a
 * legitimate source for a window resolve to null with an honest reason —
 * never fabricated data.
 *
 * Routing rules (current providers):
 *   Crypto (CoinGecko-backed)  1H/4H/1D/1W → CoinGecko keyless OHLC
 *                              1M/5M/15M    → exchange klines (exchangeSymbol)
 *   Spot Gold / Spot Silver    ALL windows  → Twelve Data (XAU/USD, XAG/USD)
 *                                            when VITE_TWELVEDATA_API_KEY is
 *                                            configured; otherwise an explicit
 *                                            not-configured unavailable state.
 *                                            PAXG/USDT (PAX Gold, a separate
 *                                            tokenized asset) NEVER enters the
 *                                            spot-metals pipeline.
 *   Stablecoins                1H+          → CoinGecko; sub-30m → none
 */

import { ASSET_REGISTRY } from '@/features/markets/data'
import type { Coin } from '@/features/markets/types'

import {
  coingeckoHistoryProvider,
  exchangeKlinesProvider,
  type CandleSeries,
  type HistoryProvider,
  type HistoryWindowId,
} from './history'
import { twelveDataBudgetExhausted, twelveDataHistoryProvider, twelveDataKey } from './twelvedata'

export type Freshness = 'live' | 'recent' | 'stale' | 'unavailable'

export interface SeriesSource {
  provider: HistoryProvider
  symbol: string
}

/** Why a window can't be served — surfaced verbatim in the UI. */
export function unavailableReason(coin: Coin, window: HistoryWindowId): string | null {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === coin.id)
  const isMetal = coin.id === 'gold' || coin.id === 'silver'

  if (isMetal) {
    if (!identity?.twelveDataSymbol) {
      return `No ${window} historical feed for ${coin.name} — no Twelve Data instrument is mapped for it.`
    }
    if (!twelveDataKey()) {
      return `Intraday liquidity unavailable — Twelve Data is not configured. Set VITE_TWELVEDATA_API_KEY (free at twelvedata.com) to enable ${coin.name} OHLC. No proxy instrument is used.`
    }
    if (twelveDataBudgetExhausted()) {
      return 'Twelve Data daily budget reached — analysis resumes after midnight UTC. Live prices are unaffected.'
    }
    // A key IS configured: whether this window is actually served is decided
    // by the API response itself (the provider surfaces the real error).
    return null
  }

  if (identity && identity.dataSource !== 'coingecko' && !identity.exchangeSymbol) {
    return `No ${window} historical feed for ${coin.name} — the configured market-data providers have no candle history for it.`
  }
  if (window === '1M' || window === '5M' || window === '15M') {
    if (!identity?.exchangeSymbol) {
      return `No ${window} historical feed for ${coin.name} — there is no tradable keyless pair for it at this granularity.`
    }
  }
  return null
}

/**
 * Resolve the provider + provider symbol for an asset + window, or null with
 * a reason when no legitimate source exists. Deterministic — same asset +
 * window always resolve the same way.
 */
export function resolveSeriesSource(coin: Coin, window: HistoryWindowId): SeriesSource | null {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === coin.id)
  if (!identity) return null

  const sub30 = window === '1M' || window === '5M' || window === '15M'

  // Metals: Spot Gold / Spot Silver resolve EXCLUSIVELY through Twelve Data
  // (XAU/USD / XAG/USD) when an API key is configured. PAXG/USDT and any
  // tokenized proxy are separate instruments and never enter this pipeline.
  if (coin.id === 'gold' || coin.id === 'silver') {
    if (!twelveDataKey() || twelveDataBudgetExhausted()) return null
    const symbol = identity.twelveDataSymbol
    return symbol ? { provider: twelveDataHistoryProvider, symbol } : null
  }

  // Crypto: CoinGecko for 1H+, exchange klines for sub-30m.
  if (identity.dataSource === 'coingecko') {
    if (sub30) {
      const symbol = identity.exchangeSymbol
      return symbol ? { provider: exchangeKlinesProvider, symbol } : null
    }
    return { provider: coingeckoHistoryProvider, symbol: identity.marketSymbol ?? identity.id }
  }

  return null
}

/** Fetch the normalized series for an asset + window via the router. */
export async function fetchSeries(
  coin: Coin,
  window: HistoryWindowId,
  signal?: AbortSignal,
): Promise<CandleSeries | null> {
  const source = resolveSeriesSource(coin, window)
  if (!source) return null
  return source.provider.fetchWindowCandles(source.symbol, window, signal)
}

/**
 * Capability matrix for an asset — what the underlying data can genuinely
 * support. UI surfaces use this to avoid promising analysis that no provider
 * can supply.
 */
export interface AssetCapabilities {
  /** Real live price available. */
  price: boolean
  /** Real historical OHLC available for at least one window. */
  ohlc: boolean
  /** Volume present in the supplied candles. */
  volume: boolean
  /** Per-window OHLC availability. */
  timeframes: Record<HistoryWindowId, boolean>
  /** Primary source label for this asset. */
  source: string
}

export function assetCapabilities(coin: Coin): AssetCapabilities {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === coin.id)
  const windows: HistoryWindowId[] = ['1M', '5M', '15M', '1H', '4H', '1D', '1W']
  const timeframes = {} as Record<HistoryWindowId, boolean>
  let anyOhlc = false
  for (const window of windows) {
    const available = resolveSeriesSource(coin, window) !== null
    timeframes[window] = available
    if (available) anyOhlc = true
  }
  return {
    price: identity ? identity.dataSource !== 'none' : false,
    ohlc: anyOhlc,
    volume: anyOhlc && (coin.id === 'gold' || Boolean(identity?.exchangeSymbol)),
    timeframes,
    source:
      coin.id === 'gold' || coin.id === 'silver'
        ? twelveDataKey()
          ? `Twelve Data · ${identity?.twelveDataSymbol ?? coin.ticker}`
          : 'Twelve Data — not configured'
        : identity
          ? providerLabel(identity.dataSource)
          : '—',
  }
}

/** Human provider label for a series' `provider` id. */
export function providerLabel(provider: string): string {
  switch (provider) {
    case 'binance':
      return 'Binance'
    case 'bybit':
      return 'Bybit'
    case 'coingecko':
      return 'CoinGecko'
    case 'twelvedata':
      return 'Twelve Data'
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1)
  }
}

/**
 * Source line for a fetched series — e.g. "Binance · 1m" or, for Twelve Data
 * instruments, "Twelve Data · XAU/USD · 1h" — the instrument is always shown
 * so spot metals are never mistaken for anything else.
 */
export function sourceLabel(_coin: Coin, series: CandleSeries): string {
  const base = `${providerLabel(series.provider)} · ${series.granularity}`
  return series.provider === 'twelvedata' && series.symbol ? `${base} · ${series.symbol}` : base
}

/**
 * Source line for a UI surface given the hook's fields — same labeling as
 * `sourceLabel`, without requiring the whole series.
 */
export function surfaceSource(
  _coin: Coin,
  provider: string | null,
  symbol: string | null,
  granularity: string | null,
): string {
  if (!provider) return 'OHLC history'
  const base = `${providerLabel(provider)}${granularity ? ` · ${granularity}` : ''}`
  return provider === 'twelvedata' && symbol ? `${base} · ${symbol}` : base
}

/**
 * Honest freshness of the ANALYSIS — driven by the newest CLOSED candle, not
 * the fetch time. A 1D series fetched a minute ago is still "recent" if its
 * last candle closed hours ago; the UI must never claim 5-second freshness
 * for data that is actually old.
 */
export function classifyFreshness(series: CandleSeries | null, now = Date.now()): Freshness {
  if (!series || series.candles.length === 0 || !series.lastCandleAt) return 'unavailable'
  const interval = series.intervalMs || 60_000
  const age = Math.max(0, now - series.lastCandleAt)
  if (age <= interval * 1.5) return 'live'
  if (age <= interval * 4) return 'recent'
  return 'stale'
}
