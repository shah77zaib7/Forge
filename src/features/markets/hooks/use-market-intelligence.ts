import { useEffect, useMemo, useState } from 'react'

import { ASSET_REGISTRY } from '@/features/markets/data'
import type { Coin } from '@/features/markets/types'

import type { TimeframeAnalysis } from '../services/market-intelligence'
import { analyzeTimeframe } from '../services/market-intelligence'
import { providerForWindow, type Candle, type HistoryProvider } from '../services/history'

/**
 * Workspace liquidity windows. Each window resolves to whichever history
 * provider can genuinely supply it: CoinGecko serves 1H/4H/1D/1W, the
 * exchange klines provider serves 1M/5M/15M. Assets without a tradable
 * pair for the window (stablecoins/metals on sub-30m) surface an honest
 * insufficient-data state instead of fabricated candles.
 */
export type IntelligenceWindowId = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'

export type IntelligenceStatus = 'idle' | 'loading' | 'ready' | 'insufficient' | 'error'

export interface IntelligenceState {
  status: IntelligenceStatus
  analysis: TimeframeAnalysis | null
  /** The raw validated candle series behind the analysis (for window-return reads). */
  candles: Candle[] | null
  /** Human reason for the insufficient/error state. */
  message: string | null
  /** Last epoch ms a fresh series was fetched (drives "Updated Xs ago"). */
  fetchedAt: number | null
  refresh: () => void
}

/**
 * The symbol the resolved provider fetches for this coin: CoinGecko's asset
 * id (registry `marketSymbol` or the stable internal id) for the CoinGecko
 * provider, or the exchange klines pair (`exchangeSymbol`, e.g. "BTCUSDT")
 * for the exchange provider. Null means the provider has no pair for this
 * asset — reported as honest-unavailable, never fabricated.
 */
function providerSymbol(coin: Coin, provider: HistoryProvider): string | null {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === coin.id)
  if (!identity) return null
  // CoinGecko history only exists for assets whose live feed is CoinGecko
  // (metals come from the spot-metals provider, which has no OHLC at all);
  // exchange klines need a tradable pair.
  if (provider.id === 'exchange') return identity.exchangeSymbol ?? null
  return identity.dataSource === 'coingecko' ? identity.marketSymbol ?? identity.id : null
}

/**
 * Market Intelligence hook — resolves the window's real history provider,
 * fetches its candle series (cached per asset + window, re-fetched at most
 * once per candle close) and runs the deterministic engine over it.
 * Distances track the live quote, so price ticks recompute the cheap
 * analysis without touching the network. Unsupported windows and assets the
 * provider can't cover return a clear insufficient_data — never fabricated
 * numbers.
 */
export function useMarketIntelligence(
  coin: Coin | undefined,
  timeframeId: IntelligenceWindowId,
): IntelligenceState {
  const provider = providerForWindow(timeframeId) ?? null
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

    if (!coin || !provider) return
    const symbol = providerSymbol(coin, provider)
    if (!symbol) return

    void provider
      .fetchWindowCandles(symbol, timeframeId, controller.signal)
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
  }, [coin?.id, provider, nonce])

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

  const identity = coin ? ASSET_REGISTRY.find((asset) => asset.id === coin.id) : undefined
  const symbol = coin && provider ? providerSymbol(coin, provider) : null

  const noPair = !identity || (provider ? !symbol : false)
  const status: IntelligenceStatus = error
    ? 'error'
    : !provider
      ? 'insufficient'
      : noPair
        ? 'insufficient'
        : analysis
          ? analysis.insufficient
            ? 'insufficient'
            : 'ready'
          : 'loading'

  const message =
    !provider
      ? 'This window is not published by the market-data provider — real analysis would require fabricated candles.'
      : noPair
        ? `No ${timeframeId} historical feed for ${coin?.name ?? 'this asset'} — the configured market-data providers have no candle history for it.`
        : error
          ? 'Historical data temporarily unavailable. Live prices are unaffected.'
          : analysis?.insufficient
            ? 'Not enough closed candles in this window for a reliable read yet.'
            : null

  return {
    status,
    analysis,
    candles,
    message,
    fetchedAt,
    refresh: () => setNonce((n) => n + 1),
  }
}
