/**
 * Real OHLC history — CoinGecko's keyless /ohlc endpoint.
 *
 * The public API publishes OHLC series at a fixed set of granularities
 * (no sub-30m candles, and daily+ is coarse):
 *
 *   days=1   → 30-minute candles (48)
 *   days=30  → 4-hour candles (180)
 *   days=365 → 4-day candles (92)
 *
 * Forge's workspace windows map onto what the provider actually publishes,
 * using the closest legitimate interval and labelling it honestly:
 *
 *   1H window ← 30m candles (days=1)      — closest supported granularity
 *   4H window ← 4h  candles (days=30)     — exact
 *   1D window ← 1d  candles aggregated from the 4h series (days=30)
 *   1W window ← 4d  candles (days=365)    — provider's coarse weekly proxy
 *
 * Windows the provider cannot supply at all (1M/5M/15M sub-30m OHLC) are
 * reported as unsupported — the engine returns insufficient_data instead of
 * inventing candles. Metals (XAU/XAG) have no CoinGecko history at all.
 *
 * Every payload is validated before use: candles with non-finite values,
 * inverted high/low, or out-of-range open/close are dropped so a malformed
 * response can never break analysis. Requests are cached per asset+days with
 * a TTL tied to the candle size (refetch when a new candle closes, not on
 * every price tick).
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

/** Drop every cached series — used by tests and manual cache busts. */
export function clearHistoryCache(): void {
  cache.clear()
}
