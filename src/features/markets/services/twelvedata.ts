/**
 * Twelve Data — real OHLC for Spot Gold (XAU/USD) and Spot Silver (XAG/USD),
 * integrated through the same HistoryProvider seam as CoinGecko and the
 * exchange klines providers. The Liquidity Model consumes the normalized
 * CandleSeries output exactly like every other source.
 *
 * DATA INTEGRITY RULES:
 *   • XAU/USD → Spot Gold → Twelve Data symbol "XAU/USD"
 *   • XAG/USD → Spot Silver → Twelve Data symbol "XAG/USD"
 *   • PAXG/USDT (PAX Gold, Binance) is a SEPARATE instrument and NEVER enters
 *     this pipeline — the router resolves metals exclusively through Twelve
 *     Data when an API key is configured, and to an honest unavailable state
 *     when it is not. No proxy, no silent substitution.
 *
 * KEY / PLAN GATING:
 *   A key is required for every time_series request (401 without one — the
 *   public "demo" key is retired). Until `VITE_TWELVEDATA_API_KEY` is set,
 *   this provider resolves to an explicit not-configured state and the UI
 *   explains exactly what is missing. Whether the configured plan actually
 *   serves a symbol/timeframe is decided by the API response itself: errors
 *   (401/403/406/429/interval-unsupported) surface truthfully, never as
 *   fabricated candles.
 *
 * CREDITS:
 *   Every response carries `api-credits-used` / `api-credits-left` headers.
 *   The provider records the last observed values (for the audit tool and
 *   debug metadata) and enforces a conservative daily budget guard so a
 *   single user cannot silently burn the Basic plan's 800 credits/day.
 */

import { RateLimitError } from './http'
import {
  MIN_CANDLES,
  type Candle,
  type CandleSeries,
  type HistoryProvider,
  type HistoryWindowId,
} from './history'

/* ------------------------------------------------------------------ */
/* Key configuration — env-driven, overridable for tests.              */
/* ------------------------------------------------------------------ */

let apiKey: string | null = readEnvKey()

function readEnvKey(): string | null {
  try {
    const value = (import.meta.env?.VITE_TWELVEDATA_API_KEY as string | undefined)?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

/** The configured Twelve Data API key, or null when not configured. */
export function twelveDataKey(): string | null {
  return apiKey
}

/** Test seam — inject or clear the key without touching process env. */
export function setTwelveDataKeyForTests(key: string | null): void {
  apiKey = key
}

/* ------------------------------------------------------------------ */
/* Window plans — honest interval mapping + per-candle-close TTL.      */
/* ------------------------------------------------------------------ */

export interface TwelveDataPlan {
  window: HistoryWindowId
  /** Twelve Data interval token, e.g. '1min' | '1h' | '1day'. */
  interval: string
  /** Honest label for the candles actually analyzed. */
  granularity: string
  /** Cache TTL — one candle close, roughly. */
  ttlMs: number
  /** Candles requested (kept modest for the free plan). */
  outputsize: number
}

export const TWELVE_DATA_WINDOW_PLANS: Record<HistoryWindowId, TwelveDataPlan> = {
  '1M': { window: '1M', interval: '1min', granularity: '1m', ttlMs: 60_000, outputsize: 500 },
  '5M': { window: '5M', interval: '5min', granularity: '5m', ttlMs: 120_000, outputsize: 300 },
  '15M': { window: '15M', interval: '15min', granularity: '15m', ttlMs: 240_000, outputsize: 300 },
  '1H': { window: '1H', interval: '1h', granularity: '1h', ttlMs: 10 * 60_000, outputsize: 300 },
  '4H': { window: '4H', interval: '4h', granularity: '4h', ttlMs: 30 * 60_000, outputsize: 300 },
  '1D': { window: '1D', interval: '1day', granularity: '1d', ttlMs: 60 * 60_000, outputsize: 300 },
  '1W': { window: '1W', interval: '1week', granularity: '1w', ttlMs: 3 * 60 * 60_000, outputsize: 200 },
}

/** Median spacing between consecutive candles — the series' true interval. */
function medianIntervalMs(candles: Candle[]): number {
  if (candles.length < 2) return 0
  const gaps: number[] = []
  for (let i = 1; i < candles.length; i++) gaps.push(candles[i].timestamp - candles[i - 1].timestamp)
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)] || 0
}

/* ------------------------------------------------------------------ */
/* Payload parsing + validation.                                       */
/* ------------------------------------------------------------------ */

const toNum = (value: unknown): number =>
  typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN

/**
 * Twelve Data returns datetimes like "2026-08-11 13:00:00"; for forex and
 * crypto they are UTC (documented). Parse as UTC so candle timestamps are
 * epoch-ms and comparable across providers.
 */
function parseDatetimeUtc(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const millis = Date.parse(normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`)
  return Number.isFinite(millis) ? millis : null
}

/** A normalized OHLCV row, or null when malformed. */
interface ParsedRow {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

function parseRow(row: unknown): ParsedRow | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>
  const timestamp = parseDatetimeUtc(record.datetime)
  const open = toNum(record.open)
  const high = toNum(record.high)
  const low = toNum(record.low)
  const close = toNum(record.close)
  const volume = record.volume === undefined ? undefined : toNum(record.volume)
  if (
    timestamp === null ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0
  ) {
    return null
  }
  const slack = Math.max(high, 1) * 0.01
  if (high < low - slack) return null
  if (open < low - slack || open > high + slack) return null
  if (close < low - slack || close > high + slack) return null
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: volume !== undefined && Number.isFinite(volume) && volume > 0 ? volume : undefined,
  }
}

/** Parse + validate a time_series payload into sorted, deduped candles. */
export function parseTimeSeriesPayload(payload: unknown): Candle[] {
  if (typeof payload !== 'object' || payload === null) return []
  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.values)) return []
  const seen = new Set<number>()
  const candles: Candle[] = []
  for (const row of record.values) {
    const parsed = parseRow(row)
    if (!parsed || seen.has(parsed.timestamp)) continue
    seen.add(parsed.timestamp)
    candles.push({
      timestamp: parsed.timestamp,
      open: parsed.open,
      high: parsed.high,
      low: parsed.low,
      close: parsed.close,
      ...(parsed.volume !== undefined ? { volume: parsed.volume } : {}),
    })
  }
  candles.sort((a, b) => a.timestamp - b.timestamp)
  return candles
}

/** A structured Twelve Data API error — surfaced verbatim, never faked away. */
export interface TwelveDataApiError {
  code: number
  message: string
}

/** Extract the error object from an error payload, or null. */
export function parseTimeSeriesError(payload: unknown): TwelveDataApiError | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  if (record.status !== 'error') return null
  const code = toNum(record.code)
  const message = typeof record.message === 'string' ? record.message : 'Twelve Data returned an unknown error'
  return Number.isFinite(code) ? { code, message } : { code: 0, message }
}

/* ------------------------------------------------------------------ */
/* Daily credit budget guard — safe for a single-user personal app.    */
/* ------------------------------------------------------------------ */

export const TWELVE_DATA_DAILY_BUDGET = 800
/** Stop calling the API at 95% of the daily budget — leaves headroom. */
export const TWELVE_DATA_BUDGET_HARD_STOP = 760

interface BudgetState {
  /** Credits consumed since midnight UTC (from api-credits-used headers). */
  used: number
  /** Day key (YYYY-MM-DD UTC) the tally belongs to. */
  day: string
}

const BUDGET_KEY = 'forge:twelvedata:budget'

function readBudget(): BudgetState {
  try {
    const raw = globalThis.localStorage?.getItem(BUDGET_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetState
      if (parsed && typeof parsed.used === 'number' && typeof parsed.day === 'string') return parsed
    }
  } catch {
    /* storage unavailable — budget guard degrades to in-memory only */
  }
  return { used: 0, day: utcDayKey() }
}

function writeBudget(state: BudgetState): void {
  try {
    globalThis.localStorage?.setItem(BUDGET_KEY, JSON.stringify(state))
  } catch {
    /* non-fatal */
  }
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Credits consumed today (UTC), per the last observed api-credits-used. */
export function twelveDataCreditsUsedToday(): number {
  const state = readBudget()
  return state.day === utcDayKey() ? state.used : 0
}

/** True when the daily budget guard has stopped further requests today. */
export function twelveDataBudgetExhausted(): boolean {
  return twelveDataCreditsUsedToday() >= TWELVE_DATA_BUDGET_HARD_STOP
}

/** Test seam — clear the persisted budget tally. */
export function resetTwelveDataBudgetForTests(): void {
  try {
    globalThis.localStorage?.removeItem(BUDGET_KEY)
  } catch {
    /* non-fatal */
  }
}

/** Record observed credit usage from response headers. */
function recordCreditsUsed(headers: Headers): void {
  const raw = headers.get('api-credits-used')
  const used = raw ? Number(raw) : NaN
  if (!Number.isFinite(used) || used <= 0) return
  const state = readBudget()
  if (state.day !== utcDayKey()) state.used = 0
  state.used = Math.max(state.used, used)
  writeBudget(state)
}

/* ------------------------------------------------------------------ */
/* Fetch + cache — one in-flight promise + candle-close TTL per        */
/* symbol+window, identical to the other providers.                    */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  fetchedAt: number
  promise: Promise<CandleSeries | null>
}

const cache = new Map<string, CacheEntry>()

/* ------------------------------------------------------------------ */
/* Diagnostics — a structured snapshot of the provider's recent state,  */
/* so missing-key / request-failure / unsupported-symbol / rate-limit / */
/* empty-response / success are distinguishable at a glance. The API    */
/* key value is NEVER included.                                        */
/* ------------------------------------------------------------------ */

export interface TwelveDataDiagnostics {
  /** Whether VITE_TWELVEDATA_API_KEY was found at startup (never the value). */
  keyConfigured: boolean
  budgetUsedToday: number
  budgetExhausted: boolean
  lastStatus: number | null
  lastCreditsUsed: number | null
  lastCreditsLeft: number | null
  lastSymbol: string | null
  lastWindow: string | null
  /** Distinguishing label of the last outcome, e.g. 'success' | 'empty' | 'rate_limit'. */
  lastOutcome: string | null
  lastError: string | null
  lastErrorAt: number | null
  lastSuccessAt: number | null
}

const diagnostics: TwelveDataDiagnostics = {
  keyConfigured: false,
  budgetUsedToday: 0,
  budgetExhausted: false,
  lastStatus: null,
  lastCreditsUsed: null,
  lastCreditsLeft: null,
  lastSymbol: null,
  lastWindow: null,
  lastOutcome: null,
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
}

/** Latest provider state — safe to expose to debug metadata and the UI. */
export function twelveDataDiagnostics(): TwelveDataDiagnostics {
  return { ...diagnostics, keyConfigured: apiKey !== null, budgetUsedToday: twelveDataCreditsUsedToday(), budgetExhausted: twelveDataBudgetExhausted() }
}

/** Test seam — reset diagnostics between tests. */
export function resetTwelveDataDiagnosticsForTests(): void {
  diagnostics.lastStatus = null
  diagnostics.lastCreditsUsed = null
  diagnostics.lastCreditsLeft = null
  diagnostics.lastSymbol = null
  diagnostics.lastWindow = null
  diagnostics.lastOutcome = null
  diagnostics.lastError = null
  diagnostics.lastErrorAt = null
  diagnostics.lastSuccessAt = null
}

/**
 * Fetch one symbol+window series from Twelve Data. Requires a configured
 * key; without one it throws an explicit not-configured error. The plan's
 * TTL (one candle close) bounds refetch frequency; simultaneous requests for
 * the same series share one in-flight promise.
 */
async function fetchTwelveDataSeries(
  symbol: string,
  plan: TwelveDataPlan,
  signal?: AbortSignal,
): Promise<CandleSeries | null> {
  const key = apiKey
  diagnostics.lastSymbol = symbol
  diagnostics.lastWindow = plan.window
  if (!key) {
    diagnostics.lastOutcome = 'missing_key'
    diagnostics.lastError = 'VITE_TWELVEDATA_API_KEY not configured'
    diagnostics.lastErrorAt = Date.now()
    throw new Error(
      'Twelve Data is not configured — set VITE_TWELVEDATA_API_KEY to enable Spot Gold / Spot Silver OHLC.',
    )
  }
  if (twelveDataBudgetExhausted()) {
    diagnostics.lastOutcome = 'budget_exhausted'
    diagnostics.lastError = 'Daily credit budget reached'
    diagnostics.lastErrorAt = Date.now()
    throw new Error(
      `Twelve Data daily budget reached (${TWELVE_DATA_BUDGET_HARD_STOP}/${TWELVE_DATA_DAILY_BUDGET} credits). Analysis resumes after midnight UTC.`,
    )
  }

  const cacheKey = `${symbol}:${plan.window}`
  const entry = cache.get(cacheKey)
  if (entry && Date.now() - entry.fetchedAt < plan.ttlMs) return entry.promise

  const onAbort = () => cache.delete(cacheKey)
  signal?.addEventListener('abort', onAbort, { once: true })

  const promise = (async (): Promise<CandleSeries | null> => {
    const url =
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${plan.interval}&outputsize=${plan.outputsize}&timezone=UTC&apikey=${encodeURIComponent(key)}`
    const response = await fetch(url, { signal })
    diagnostics.lastStatus = response.status
    diagnostics.lastCreditsUsed = numberHeader(response.headers.get('api-credits-used'))
    diagnostics.lastCreditsLeft = numberHeader(response.headers.get('api-credits-left'))
    recordCreditsUsed(response.headers)
    if (!response.ok) {
      if (response.status === 429) {
        diagnostics.lastOutcome = 'rate_limit'
        diagnostics.lastError = 'HTTP 429 — credits exhausted for this minute'
        diagnostics.lastErrorAt = Date.now()
        throw new RateLimitError(429, 'Twelve Data rate limit reached — retry in a moment (credits reset each minute)')
      }
      diagnostics.lastOutcome = 'request_failure'
      diagnostics.lastError = `HTTP ${response.status}`
      diagnostics.lastErrorAt = Date.now()
      throw new Error(`Twelve Data request failed (${response.status})`)
    }
    const payload: unknown = await response.json()
    const apiError = parseTimeSeriesError(payload)
    if (apiError) {
      // 429 comes back both as an HTTP status and as a JSON error body.
      if (apiError.code === 429) {
        diagnostics.lastOutcome = 'rate_limit'
        diagnostics.lastError = apiError.message
        diagnostics.lastErrorAt = Date.now()
        throw new RateLimitError(429, 'Twelve Data rate limit reached — retry in a moment (credits reset each minute)')
      }
      diagnostics.lastOutcome = 'unsupported_symbol'
      diagnostics.lastError = apiError.message
      diagnostics.lastErrorAt = Date.now()
      throw new Error(`Twelve Data: ${apiError.message}`)
    }
    const candles = parseTimeSeriesPayload(payload)
    if (candles.length < MIN_CANDLES) {
      diagnostics.lastOutcome = 'empty_response'
      diagnostics.lastError = `no usable candles for ${symbol} on ${plan.window}`
      diagnostics.lastErrorAt = Date.now()
      throw new Error(
        `Twelve Data returned no usable candles for ${symbol} on ${plan.window} (empty response) — no analysis is possible for this window.`,
      )
    }
    diagnostics.lastOutcome = 'success'
    diagnostics.lastError = null
    diagnostics.lastErrorAt = null
    diagnostics.lastSuccessAt = Date.now()
    return {
      candles,
      granularity: plan.granularity,
      provider: 'twelvedata',
      symbol,
      fetchedAt: Date.now(),
      lastCandleAt: candles[candles.length - 1]?.timestamp ?? 0,
      intervalMs: medianIntervalMs(candles),
    }
  })()

  cache.set(cacheKey, { fetchedAt: Date.now(), promise })
  try {
    const result = await promise
    cache.set(cacheKey, { fetchedAt: Date.now(), promise })
    return result
  } catch (cause) {
    cache.delete(cacheKey)
    throw cause
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

function numberHeader(value: string | null): number | null {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Twelve Data history provider — real OHLC for Spot Gold (XAU/USD) and Spot
 * Silver (XAG/USD). Interval support on the free plan is intentionally NOT
 * assumed: the API's own response (success or typed error) is the source of
 * truth for what the configured key can actually serve. Sub-hour intraday
 * forex availability in particular must be verified per key/plan (the docs
 * restrict 1min/5min/15min/30min to US equities; the audit script confirms
 * the live behavior).
 */
export const twelveDataHistoryProvider: HistoryProvider = {
  id: 'twelvedata',
  label: 'Twelve Data',
  supportedWindows: Object.keys(TWELVE_DATA_WINDOW_PLANS) as HistoryWindowId[],
  fetchWindowCandles(assetSymbol, window, signal) {
    const plan = TWELVE_DATA_WINDOW_PLANS[window]
    if (!plan) return Promise.resolve(null)
    return fetchTwelveDataSeries(assetSymbol, plan, signal)
  },
}

/** Drop every cached series — used by tests and manual cache busts. */
export function clearTwelveDataCache(): void {
  cache.clear()
}
