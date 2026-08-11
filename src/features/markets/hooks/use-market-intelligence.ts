import { useEffect, useMemo, useState } from 'react'

import type { Coin } from '@/features/markets/types'

import type { TimeframeAnalysis } from '../services/market-intelligence'
import { analyzeTimeframe } from '../services/market-intelligence'
import type { Candle, CandleSeries } from '../services/history'
import {
  classifyFreshness,
  fetchSeries,
  resolveSeriesSource,
  unavailableReason,
  type Freshness,
} from '../services/market-router'
import { twelveDataDiagnostics } from '../services/twelvedata'

/**
 * Workspace liquidity windows. Each window resolves through the asset-aware
 * market router to whichever provider can genuinely supply it (CoinGecko for
 * crypto 1H+, exchange klines for sub-30m, Twelve Data for Spot Gold via
 * XAU/USD). Assets or windows without a legitimate source surface an honest
 * reason — never fabricated candles, never a proxy instrument.
 */
export type IntelligenceWindowId = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'

export type IntelligenceStatus = 'idle' | 'loading' | 'ready' | 'insufficient' | 'error'

export interface IntelligenceState {
  status: IntelligenceStatus
  analysis: TimeframeAnalysis | null
  /** The raw validated candle series behind the analysis (for window-return reads). */
  candles: Candle[] | null
  /** Provider that actually supplied the series (e.g. 'binance', 'coingecko'). */
  provider: string | null
  /** Provider symbol fetched (e.g. 'BTCUSDT', 'PAXGUSDT'). */
  symbol: string | null
  /** Epoch ms of the newest CLOSED candle — honest freshness, not fetch time. */
  dataAt: number | null
  /** Freshness of the analysis, from the candle data (live/recent/stale). */
  freshness: Freshness
  /** Human reason for the insufficient/error state. */
  message: string | null
  /** Last epoch ms a fresh series was fetched (drives "Updated Xs ago"). */
  fetchedAt: number | null
  refresh: () => void
}

/**
 * Market Intelligence hook — routes the window through the asset-aware
 * provider layer, fetches the normalized candle series (cached per asset +
 * window, re-fetched at most once per candle close) and runs the
 * deterministic engine over it. Distances track the live quote, so price
 * ticks recompute the cheap analysis without touching the network.
 */
export function useMarketIntelligence(
  coin: Coin | undefined,
  timeframeId: IntelligenceWindowId,
): IntelligenceState {
  const [series, setSeries] = useState<CandleSeries | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    // The request lifecycle lives entirely inside this effect: the controller
    // is aborted by this effect's own cleanup (deps change or unmount). A
    // separate "abort on unmount" effect would run its cleanup between
    // StrictMode's double-invoked setups and kill the fresh request before it
    // dispatches — leaving the hook in an eternal loading state.
    const controller = new AbortController()
    let cancelled = false
    setError(null)
    setSeries(null)
    setFetchedAt(null)

    if (!coin) return
    if (!resolveSeriesSource(coin, timeframeId)) return

    void fetchSeries(coin, timeframeId, controller.signal)
      .then((result) => {
        if (cancelled) return
        if (!result || result.candles.length === 0) {
          setError('Provider returned no history for this asset')
          return
        }
        setSeries(result)
        setFetchedAt(result.fetchedAt)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        // A caller abort (deps change / unmount) is a cancellation; provider
        // failures — including the shared layer's own timeout, which is a
        // plain Error — surface as an error state. An AbortError whose signal
        // is NOT ours to cancel (nothing in this effect aborted it) is treated
        // as a genuine failure rather than being swallowed into eternal loading.
        if (cause instanceof DOMException && cause.name === 'AbortError' && controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Historical data unavailable')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [coin?.id, timeframeId, nonce])

  const analysis = useMemo<TimeframeAnalysis | null>(() => {
    if (!series) return null
    const result = analyzeTimeframe(series.candles, coin?.price ?? 0, timeframeId, series.granularity)
    // Development transparency: the full engine trace is inspectable from
    // the console without a UI redesign.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __forgeLiquidity?: unknown }).__forgeLiquidity = {
        asset: coin?.id,
        timeframe: timeframeId,
        price: coin?.price,
        provider: series.provider,
        diagnostics: result.diagnostics,
        sweeps: result.sweeps,
        zones: [...result.liquidity.buySide, ...result.liquidity.sellSide],
        // Provider-level transparency — key presence (never the value),
        // last outcome, credits, errors. Distinguishes missing-key from
        // rate-limit / unsupported-symbol / empty-response / success.
        providerDiagnostics: twelveDataDiagnostics(),
      }
    }
    return result
  }, [series, coin?.price, timeframeId])

  const sourceAvailable = coin ? resolveSeriesSource(coin, timeframeId) !== null : false
  const status: IntelligenceStatus = error
    ? 'error'
    : !coin || !sourceAvailable
      ? 'insufficient'
      : analysis
        ? analysis.insufficient
          ? 'insufficient'
          : 'ready'
        : 'loading'

  // Transparency even when no series exists — e.g. a missing Twelve Data key
  // short-circuits the fetch, and the handle must still say so instead of
  // silently showing nothing. Safe in production: it never contains the key.
  useEffect(() => {
    ;(window as unknown as { __forgeLiquidity?: unknown }).__forgeLiquidity = {
      asset: coin?.id,
      timeframe: timeframeId,
      status,
      providerDiagnostics: twelveDataDiagnostics(),
    }
  }, [coin?.id, timeframeId, status])

  const message = error
    ? `Historical data temporarily unavailable. Live prices are unaffected. ${error}`
    : !sourceAvailable
      ? (coin ? unavailableReason(coin, timeframeId) : 'No market-data source configured for this asset.')
      : analysis?.insufficient
        ? 'Not enough closed candles in this window for a reliable read yet.'
        : null

  return {
    status,
    analysis,
    candles: series?.candles ?? null,
    provider: series?.provider ?? null,
    symbol: series?.symbol ?? null,
    dataAt: series?.lastCandleAt ?? null,
    freshness: classifyFreshness(series),
    message,
    fetchedAt,
    refresh: () => setNonce((n) => n + 1),
  }
}
