/**
 * Real OHLC history for Forge's workspace windows, served by a provider
 * registry (HistoryProvider) so each window resolves to whatever source can
 * genuinely supply it:
 *
 *   CoinGecko keyless /ohlc  →  1H (30m candles), 4H (4h), 1D (aggregated), 1W (4d)
 *   Exchange klines          →  1M / 5M / 15M (real sub-30m candles)
 *
 * CoinGecko's public API publishes no sub-30m OHLC, so the sub-30m windows
 * are served by the exchange klines provider (Binance → Bybit fallback), the
 * same deterministic engine consuming either source. Windows an asset has no
 * tradable pair for (stablecoins, metals) stay honest-unavailable — never
 * fabricated.
 *
 * Every payload is validated before use: candles with non-finite values,
 * inverted high/low, or out-of-range open/close are dropped so a malformed
 * response can never break analysis. Requests are cached per asset + window
 * with a TTL tied to the candle size (refetch when a new candle closes, not
 * on every price tick).
 */

import { fetchJson } from './http'

export interface Candle {
  /** Epoch ms of the interval open. */
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

export interface HistoryWindowPlan {
  /** Workspace window this plan serves. */
  window: '1H' | '4H' | '1D' | '1W'
  /** CoinGecko days parameter. */
  days: 1 | 30 | 365
  /** Honest label for the candles actually analyzed. */
  granularity: string
  /** Cache TTL — one candle close, roughly. */
  ttlMs: number
}

/**
 * Supported workspace windows → provider fetch plan. Windows absent from
 * this map (1M/5M/15M) have no keyless OHLC source on the configured
 * provider and must render an honest insufficient-data state.
 */
export const HISTORY_WINDOW_PLANS: Record<string, HistoryWindowPlan> = {
  '1H': { window: '1H', days: 1, granularity: '30m', ttlMs: 5 * 60_000 },
  '4H': { window: '4H', days: 30, granularity: '4h', ttlMs: 15 * 60_000 },
  '1D': { window: '1D', days: 30, granularity: '1d', ttlMs: 30 * 60_000 },
  '1W': { window: '1W', days: 365, granularity: '4d', ttlMs: 2 * 60 * 60_000 },
}

/** The smallest window that still yields a useful swing/ATR read. */
export const MIN_CANDLES = 14

export type HistoryWindowId = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'

/**
 * A candle-history provider — the seam where new data sources slot in.
 *
 * CoinGecko's keyless API is Forge's current provider and can only publish
 * 30m/4h/4d OHLC (no sub-30m candles). To support 1M/5M/15M later, a new
 * provider (exchange klines, a TradingView datafeed, a licensed history
 * vendor) implements this interface and is added to `historyProviders` —
 * the rest of the stack (engine, hook, UI) is already provider-agnostic.
 * No provider is ever asked for a window it does not declare.
 */
export interface HistoryProvider {
  id: string
  label: string
  /** Windows this provider can genuinely supply — never overstated. */
  supportedWindows: ReadonlyArray<HistoryWindowId>
  fetchWindowCandles(
    assetSymbol: string,
    window: HistoryWindowId,
    signal?: AbortSignal,
  ): Promise<{ candles: Candle[]; granularity: string } | null>
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * Normalize one raw /ohlc row into a valid candle, or null. Rows with
 * inverted or wildly inconsistent OHLC are rejected rather than trusted.
 */
function parseCandle(raw: unknown): Candle | null {
  if (!Array.isArray(raw) || raw.length < 5) return null
  const [timestamp, open, high, low, close] = raw
  if (
    !isFiniteNumber(timestamp) ||
    !isFiniteNumber(open) ||
    !isFiniteNumber(high) ||
    !isFiniteNumber(low) ||
    !isFiniteNumber(close) ||
    timestamp <= 0 ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0
  ) {
    return null
  }
  // Tolerate sub-cent rounding noise, reject real inconsistencies.
  const slack = Math.max(high, 1) * 0.01
  if (high < low - slack) return null
  if (open < low - slack || open > high + slack) return null
  if (close < low - slack || close > high + slack) return null
  return { timestamp, open, high, low, close }
}

/** Validate, sort and de-duplicate a raw series. */
function normalizeCandles(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) return []
  const seen = new Set<number>()
  const candles: Candle[] = []
  for (const row of payload) {
    const candle = parseCandle(row)
    if (!candle || seen.has(candle.timestamp)) continue
    seen.add(candle.timestamp)
    candles.push(candle)
  }
  candles.sort((a, b) => a.timestamp - b.timestamp)
  return candles
}

/** Merge consecutive candles into fixed-size buckets (e.g. 4h → 1d). */
export function aggregateCandles(candles: Candle[], bucketMs: number): Candle[] {
  if (candles.length === 0) return []
  const buckets: Candle[] = []
  for (const candle of candles) {
    const bucket = Math.floor(candle.timestamp / bucketMs) * bucketMs
    const last = buckets[buckets.length - 1]
    if (last && last.timestamp === bucket) {
      last.high = Math.max(last.high, candle.high)
      last.low = Math.min(last.low, candle.low)
      last.close = candle.close
    } else {
      buckets.push({
        timestamp: bucket,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })
    }
  }
  return buckets
}

/* ------------------------------------------------------------------ */
/* Cache — one in-flight promise + bounded TTL per fetch key.          */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  fetchedAt: number
  /** In-flight fetch — dedupes concurrent requests for the same series. */
  promise: Promise<Candle[]>
}

const cache = new Map<string, CacheEntry>()

function cacheKey(id: string, days: number): string {
  return `${id}:${days}`
}

/**
 * Fetch (or reuse) a raw OHLC series, cached by asset + days. Fresh entries
 * (within `ttlMs`) and in-flight requests are served from the cache; stale
 * entries are refetched so a new candle close is picked up.
 */
export async function fetchOhlcSeries(
  coinGeckoId: string,
  days: 1 | 30 | 365,
  ttlMs: number,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const key = cacheKey(coinGeckoId, days)
  const entry = cache.get(key)
  if (entry && Date.now() - entry.fetchedAt < ttlMs) return entry.promise

  // StrictMode and rapid window switches abort in-flight requests; drop the
  // entry SYNCHRONOUSLY on abort so a subsequent mount can never be served a
  // stale rejected promise from the cache (a rejected entry left behind by a
  // microtask race would otherwise strand the next caller in eternal loading).
  const onAbort = () => cache.delete(key)
  signal?.addEventListener('abort', onAbort, { once: true })

  const promise = (async () => {
    const url = `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/ohlc?vs_currency=usd&days=${days}`
    const payload = await fetchJson(url, signal)
    return normalizeCandles(payload)
  })()

  cache.set(key, { fetchedAt: Date.now(), promise })
  try {
    const candles = await promise
    cache.set(key, { fetchedAt: Date.now(), promise })
    return candles
  } catch (cause) {
    cache.delete(key)
    throw cause
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Fetch the candle series for a workspace window, honoring the plan's TTL
 * (re-fetch at most once per candle close per window). Returns null when
 * the provider returned no usable series.
 */
export async function fetchWindowCandles(
  coinGeckoId: string,
  plan: HistoryWindowPlan,
  signal?: AbortSignal,
): Promise<{ candles: Candle[]; granularity: string } | null> {
  const raw = await fetchOhlcSeries(coinGeckoId, plan.days, plan.ttlMs, signal)
  if (raw.length === 0) return null
  // The 1D window derives daily candles from the shared 4h series.
  const candles = plan.window === '1D' ? aggregateCandles(raw, 86_400_000) : raw
  return { candles, granularity: plan.granularity }
}

/**
 * CoinGecko keyless OHLC provider — serves the 30m/4h/1d/4w windows the
 * public API publishes. Sub-30m windows are handled by the exchange provider.
 */
export const coingeckoHistoryProvider: HistoryProvider = {
  id: 'coingecko',
  label: 'CoinGecko OHLC',
  supportedWindows: ['1H', '4H', '1D', '1W'],
  fetchWindowCandles(assetSymbol, window, signal) {
    const plan = HISTORY_WINDOW_PLANS[window]
    if (!plan) return Promise.resolve(null)
    return fetchWindowCandles(assetSymbol, plan, signal)
  },
}

/* ------------------------------------------------------------------ */
/* Exchange klines — real sub-30m candles (Binance → Bybit fallback).   */
/* ------------------------------------------------------------------ */

export interface ExchangeKlinePlan {
  window: '1M' | '5M' | '15M'
  /** Exchange interval token, e.g. '1m' | '5m' | '15m'. */
  interval: string
  /** Honest label for the candles actually analyzed. */
  granularity: string
  /** Cache TTL — one candle close, roughly. */
  ttlMs: number
  /** Candles requested per fetch (Binance caps at 1000). */
  limit: number
}

export const EXCHANGE_WINDOW_PLANS: Record<string, ExchangeKlinePlan> = {
  '1M': { window: '1M', interval: '1m', granularity: '1m', ttlMs: 45_000, limit: 500 },
  '5M': { window: '5M', interval: '5m', granularity: '5m', ttlMs: 90_000, limit: 300 },
  '15M': { window: '15M', interval: '15m', granularity: '15m', ttlMs: 240_000, limit: 300 },
}

/**
 * One keyless public klines endpoint. Every row is normalized into
 * [openTimeMs, open, high, low, close] before validation — the exchange
 * provider never trusts raw payload shapes.
 */
interface KlineEndpoint {
  id: string
  url(symbol: string, interval: string, limit: number): string
  /** Normalize a payload into raw [ts, o, h, l, c] rows; [] when unusable. */
  rows(payload: unknown): Array<[number, number, number, number, number]>
}

const toNum = (value: unknown): number => (typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN)

/** Coerce an untrusted row into a 5-tuple, or null when unusable. */
function rawRow(row: unknown): [number, number, number, number, number] | null {
  if (!Array.isArray(row) || row.length < 5) return null
  const [timestamp, open, high, low, close] = row
  return [toNum(timestamp), toNum(open), toNum(high), toNum(low), toNum(close)]
}

const KLINE_ENDPOINTS: KlineEndpoint[] = [
  {
    id: 'binance',
    url: (symbol, interval, limit) =>
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    rows(payload) {
      if (!Array.isArray(payload)) return []
      return payload.flatMap((row) => {
        const parsed = rawRow(row)
        return parsed ? [parsed] : []
      })
    },
  },
  {
    id: 'bybit',
    url: (symbol, interval, limit) =>
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval.replace('m', '')}&limit=${limit}`,
    rows(payload) {
      const list = (payload as { result?: { list?: unknown[] } })?.result?.list
      if (!Array.isArray(list)) return []
      return list
        .flatMap((row) => {
          const parsed = rawRow(row)
          return parsed ? [parsed] : []
        })
        .reverse() // Bybit returns newest-first.
    },
  },
]

/** Parse one raw kline row into a validated candle, or null. */
function parseKline(raw: Array<[number, number, number, number, number]>[number]): Candle | null {
  return parseCandle(raw)
}

/** Normalize endpoint rows into sorted, validated, de-duplicated candles. */
function normalizeKlines(rows: Array<[number, number, number, number, number]>): Candle[] {
  const candles: Candle[] = []
  const seen = new Set<number>()
  for (const row of rows) {
    const candle = parseKline(row)
    if (!candle || seen.has(candle.timestamp)) continue
    seen.add(candle.timestamp)
    candles.push(candle)
  }
  candles.sort((a, b) => a.timestamp - b.timestamp)
  return candles
}

const exchangeCache = new Map<string, CacheEntry>()

/**
 * Fetch a real exchange kline series, trying each keyless endpoint in order
 * (region blocks and outages fall through to the next). Cached per symbol +
 * window with the same synchronous-on-abort eviction as the CoinGecko cache.
 */
export async function fetchExchangeKlines(
  symbol: string,
  plan: ExchangeKlinePlan,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const key = `${symbol}:${plan.window}`
  const entry = exchangeCache.get(key)
  if (entry && Date.now() - entry.fetchedAt < plan.ttlMs) return entry.promise

  const onAbort = () => exchangeCache.delete(key)
  signal?.addEventListener('abort', onAbort, { once: true })

  const promise = (async () => {
    let lastError: unknown = null
    for (const endpoint of KLINE_ENDPOINTS) {
      try {
        const payload = await fetchJson(endpoint.url(symbol, plan.interval, plan.limit), signal)
        const candles = normalizeKlines(endpoint.rows(payload))
        if (candles.length >= MIN_CANDLES) return candles
        lastError = new Error(`${endpoint.id} returned too few candles for ${symbol}`)
      } catch (cause) {
        lastError = cause
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No exchange kline source available')
  })()

  exchangeCache.set(key, { fetchedAt: Date.now(), promise })
  try {
    const candles = await promise
    exchangeCache.set(key, { fetchedAt: Date.now(), promise })
    return candles
  } catch (cause) {
    exchangeCache.delete(key)
    throw cause
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Exchange klines provider — real 1M/5M/15M candles for assets with a
 * tradable keyless pair (crypto + XAUT). Assets without a pair (stablecoins,
 * metals) are never queried; the hook reports them honest-unavailable.
 */
export const exchangeKlinesProvider: HistoryProvider = {
  id: 'exchange',
  label: 'Exchange klines',
  supportedWindows: ['1M', '5M', '15M'],
  fetchWindowCandles(assetSymbol, window, signal) {
    const plan = EXCHANGE_WINDOW_PLANS[window]
    if (!plan) return Promise.resolve(null)
    return fetchExchangeKlines(assetSymbol, plan, signal).then((candles) =>
      candles.length === 0 ? null : { candles, granularity: plan.granularity },
    )
  },
}

/** Registered history providers, in priority order. */
export const historyProviders: HistoryProvider[] = [coingeckoHistoryProvider, exchangeKlinesProvider]

/** Resolve the provider responsible for a window, or null if none can supply it. */
export function providerForWindow(window: string): HistoryProvider | null {
  const known = new Set<HistoryWindowId>([...Object.keys(HISTORY_WINDOW_PLANS), ...Object.keys(EXCHANGE_WINDOW_PLANS)] as HistoryWindowId[])
  if (!known.has(window as HistoryWindowId)) return null
  return historyProviders.find((provider) => provider.supportedWindows.includes(window as HistoryWindowId)) ?? null
}

/** Drop every cached series — used by tests and manual cache busts. */
export function clearHistoryCache(): void {
  cache.clear()
  exchangeCache.clear()
}
