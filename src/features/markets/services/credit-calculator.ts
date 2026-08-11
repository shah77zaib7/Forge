/**
 * Twelve Data credit model — built from the official documentation:
 *
 *   • Formula (support.twelvedata.com Credits article):
 *       Data Weight × Number of Symbols = Credits Used per Endpoint per Minute
 *   • The same article's worked example prices /time_series at 1 credit per
 *     request (AAPL+MSFT+TSLA = 1 credit × 3 symbols = 3 credits), so the
 *     baseline weight here is 1 credit per request.
 *   • Basic plan: 8 API credits/minute, 800 API credits/day, daily quota
 *     resets at midnight UTC; running out returns HTTP 429 and the quota is
 *     restored at the start of the next minute.
 *   • Every response returns `api-credits-used` / `api-credits-left` headers
 *     — the audit script (scripts/audit-twelvedata.mjs) measures the TRUE
 *     per-request weight live and prints it; pass the measured weights to
 *     `estimateTwelveDataUsage` for an exact figure instead of the default.
 *
 * The estimator models Forge's real single-user behaviour: each window is
 * refreshed at most once per candle close (the existing cache TTLs), for a
 * given set of symbols. It reports the per-window daily request/credit load
 * and whether the Basic plan can sustain it.
 */

import type { HistoryWindowId } from './history'

/** Basic (free) plan limits — documented. */
export const TWELVE_DATA_BASIC_LIMITS = {
  perMinute: 8,
  perDay: 800,
} as const

/**
 * Baseline time_series weight per the official Credits article example
 * (1 credit per request). Intraday surcharges, if the configured plan has
 * any, are measured via api-credits-used and can override this via `weights`.
 */
export const TWELVE_DATA_BASE_WEIGHT = 1

/** Minutes between candle closes per window (the natural refresh cadence). */
export const WINDOW_CLOSE_MINUTES: Record<HistoryWindowId, number> = {
  '1M': 1,
  '5M': 5,
  '15M': 15,
  '1H': 60,
  '4H': 240,
  '1D': 1440,
  '1W': 10080,
}

export const WINDOW_ORDER: HistoryWindowId[] = ['1M', '5M', '15M', '1H', '4H', '1D', '1W']

export interface TwelveDataUsageInput {
  symbols: string[]
  /** Per-window per-request credit weight — defaults to the base weight. */
  weights?: Partial<Record<HistoryWindowId, number>>
  /** Refresh interval override in minutes per window (default: candle close). */
  refreshMinutes?: Partial<Record<HistoryWindowId, number>>
  /** Whether windows are refreshed continuously (always-on monitoring). */
  alwaysOn?: boolean
}

export interface TwelveDataUsageReport {
  perWindow: Array<{
    window: HistoryWindowId
    interval: string
    weight: number
    refreshMinutes: number
    requestsPerDay: number
    creditsPerDay: number
  }>
  requestsPerDay: number
  creditsPerDay: number
  /** Sustained per-minute request rate (all windows averaged over a minute). */
  sustainedRequestsPerMinute: number
  sustainedCreditsPerMinute: number
  /** True when the estimate fits within the Basic plan's limits. */
  withinPerMinuteLimit: boolean
  withinDailyLimit: boolean
  /** Human verdict — what a single user can realistically run on Basic. */
  verdict: string
}

/**
 * Estimate Twelve Data usage for a single-user Forge monitoring a symbol
 * set across the seven workspace windows, refreshing once per candle close.
 */
export function estimateTwelveDataUsage(input: TwelveDataUsageInput): TwelveDataUsageReport {
  const symbols = input.symbols.length > 0 ? input.symbols : ['BTC', 'ETH', 'XAU/USD']
  const minutesPerDay = 1440

  const perWindow = WINDOW_ORDER.map((window) => {
    const weight = input.weights?.[window] ?? TWELVE_DATA_BASE_WEIGHT
    const refreshMinutes = input.refreshMinutes?.[window] ?? WINDOW_CLOSE_MINUTES[window]
    const requestsPerDay = Math.ceil((minutesPerDay / refreshMinutes) * symbols.length)
    return {
      window,
      interval: window,
      weight,
      refreshMinutes,
      requestsPerDay,
      creditsPerDay: requestsPerDay * weight,
    }
  })

  const requestsPerDay = perWindow.reduce((sum, row) => sum + row.requestsPerDay, 0)
  const creditsPerDay = perWindow.reduce((sum, row) => sum + row.creditsPerDay, 0)

  // Sustained steady-state rate: each window fires symbols/refreshMinutes
  // times per minute once warmed up (the fastest window dominates).
  const sustainedRequestsPerMinute = perWindow.reduce(
    (sum, row) => sum + symbols.length / Math.max(1, row.refreshMinutes),
    0,
  )
  const sustainedCreditsPerMinute = perWindow.reduce(
    (sum, row) => sum + (symbols.length / Math.max(1, row.refreshMinutes)) * row.weight,
    0,
  )

  const withinPerMinuteLimit = sustainedCreditsPerMinute <= TWELVE_DATA_BASIC_LIMITS.perMinute
  const withinDailyLimit = creditsPerDay <= TWELVE_DATA_BASIC_LIMITS.perDay

  let verdict: string
  if (!withinDailyLimit) {
    verdict =
      `${creditsPerDay.toLocaleString()} credits/day exceeds the Basic daily cap (${TWELVE_DATA_BASIC_LIMITS.perDay}). ` +
      `Continuous 1M/5M monitoring of ${symbols.length} instruments is not sustainable on the free plan. ` +
      `Viable options: monitor ${symbols.length} instruments at 15M and above (~${perWindow
        .filter((row) => ['15M', '1H', '4H', '1D', '1W'].includes(row.window))
        .reduce((sum, row) => sum + row.creditsPerDay, 0)} credits/day), or keep 1M/5M for the single focused asset with a longer refresh interval, or upgrade the plan.`
  } else if (!withinPerMinuteLimit) {
    verdict =
      `Fits the daily cap but bursts exceed ${TWELVE_DATA_BASIC_LIMITS.perMinute} credits/min — space out refreshes so the fastest window never fires all symbols in the same minute.`
  } else {
    verdict = `Fits within the Basic plan (${creditsPerDay} credits/day ≤ ${TWELVE_DATA_BASIC_LIMITS.perDay}).`
  }

  return {
    perWindow,
    requestsPerDay,
    creditsPerDay,
    sustainedRequestsPerMinute,
    sustainedCreditsPerMinute,
    withinPerMinuteLimit,
    withinDailyLimit,
    verdict,
  }
}
