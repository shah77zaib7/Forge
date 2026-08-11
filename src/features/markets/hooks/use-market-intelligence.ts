import { useEffect, useMemo, useState } from 'react'

import { ASSET_REGISTRY } from '@/features/markets/data'
import type { Coin } from '@/features/markets/types'

import type { TimeframeAnalysis } from '../services/market-intelligence'
import { analyzeTimeframe } from '../services/market-intelligence'
import { fetchWindowCandles, HISTORY_WINDOW_PLANS, type Candle, type HistoryWindowPlan } from '../services/history'

/**
 * Workspace liquidity windows — mirrors the workspace selector. Windows the
 * provider cannot feed (1M/5M/15M sub-30m OHLC) are resolved to null plans
 * and surface as an honest insufficient-data state.
 */
export type IntelligenceWindowId = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'

export type IntelligenceStatus = 'idle' | 'loading' | 'ready' | 'insufficient' | 'error'

export interface IntelligenceState {
  status: IntelligenceStatus
  analysis: TimeframeAnalysis | null
  /** Human reason for the insufficient/error state. */
  message: string | null
  /** Last epoch ms a fresh series was fetched (drives "Updated Xs ago"). */
  fetchedAt: number | null
  refresh: () => void
}

/** The CoinGecko asset id for OHLC lookups — provider symbol from the registry. */
function coinGeckoId(coin: Coin): string {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === coin.id)
  return identity?.marketSymbol ?? identity?.id ?? coin.id
}

const WINDOW_LOOKUP = new Map<IntelligenceWindowId, HistoryWindowPlan | null>(
  (Object.keys(HISTORY_WINDOW_PLANS) as IntelligenceWindowId[]).map((window) => [window, HISTORY_WINDOW_PLANS[window]]),
)

/**
 * Market Intelligence hook — fetches the real candle series for the selected
 * window (cached per asset + granularity, re-fetched at most once per candle
 * close) and runs the deterministic engine over it. Distances track the live
 * quote, so price ticks recompute the cheap analysis without touching the
 * network. Unsupported windows and assets the provider can't cover return a
 * clear insufficient_data — never fabricated numbers.
 */
export function useMarketIntelligence(
  coin: Coin | undefined,
  timeframeId: IntelligenceWindowId,
): IntelligenceState {
  const plan = WINDOW_LOOKUP.get(timeframeId) ?? null
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [granularity, setGranularity] = useState('')
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
    setCandles(null)
    setGranularity('')
    setFetchedAt(null)

    if (!coin || coin.dataSource !== 'coingecko') return
    if (!plan) return
    const id = coinGeckoId(coin)

    void fetchWindowCandles(id, plan, controller.signal)
      .then((result) => {
        if (cancelled) return
        if (!result || result.candles.length === 0) {
          setError('Provider returned no history for this asset')
          return
        }
        setCandles(result.candles)
        setGranularity(result.granularity)
        setFetchedAt(Date.now())
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
  }, [coin?.id, coin?.dataSource, plan, nonce])

  // Distances re-derive from the live quote on every price tick — cheap,
  // pure recompute; the candle series and network are untouched.
  const analysis = useMemo<TimeframeAnalysis | null>(() => {
    if (!candles) return null
    const result = analyzeTimeframe(candles, coin?.price ?? 0, timeframeId, granularity)
    // Development transparency: the full engine trace (candle count, swing
    // counts, equal zones, active/swept zones, data window) is inspectable
    // from the console without a UI redesign.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __forgeLiquidity?: unknown }).__forgeLiquidity = {
        asset: coin?.id,
        timeframe: timeframeId,
        price: coin?.price,
        diagnostics: result.diagnostics,
        sweeps: result.sweeps,
        zones: [...result.liquidity.buySide, ...result.liquidity.sellSide],
      }
    }
    return result
  }, [candles, coin?.price, timeframeId, granularity])

  const noCoverage = !coin || coin.dataSource !== 'coingecko'
  const status: IntelligenceStatus = error
    ? 'error'
    : noCoverage
      ? 'insufficient'
      : !plan
        ? 'insufficient'
        : analysis
          ? analysis.insufficient
            ? 'insufficient'
            : 'ready'
          : 'loading'

  const message =
    noCoverage
      ? 'No historical feed for this asset from the configured provider.'
      : !plan
        ? 'This window is not published by the market-data provider — real analysis would require fabricated candles.'
        : error
          ? 'Historical data temporarily unavailable. Live prices are unaffected.'
          : analysis?.insufficient
            ? 'Not enough closed candles in this window for a reliable read yet.'
            : null

  return {
    status,
    analysis,
    message,
    fetchedAt,
    refresh: () => setNonce((n) => n + 1),
  }
}
