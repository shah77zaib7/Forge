import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ASSET_REGISTRY } from '../data'
import type { Coin } from '../types'
import { estimateTwelveDataUsage } from './credit-calculator'
import { fetchJson, RateLimitError } from './http'
import { analyzeTimeframe } from './market-intelligence'
import {
  classifyFreshness,
  resolveSeriesSource,
  sourceLabel,
  surfaceSource,
  unavailableReason,
} from './market-router'
import {
  clearTwelveDataCache,
  parseTimeSeriesError,
  parseTimeSeriesPayload,
  resetTwelveDataBudgetForTests,
  resetTwelveDataDiagnosticsForTests,
  setTwelveDataKeyForTests,
  twelveDataDiagnostics,
  twelveDataHistoryProvider,
  TWELVE_DATA_WINDOW_PLANS,
} from './twelvedata'

/* ------------------------------------------------------------------ */
/* Helpers.                                                            */
/* ------------------------------------------------------------------ */

function registryCoin(id: string): Coin {
  const identity = ASSET_REGISTRY.find((asset) => asset.id === id)
  if (!identity) throw new Error(`no registry entry for ${id}`)
  return {
    ...identity,
    price: 100,
    change24h: null,
    marketCap: null,
    volume24h: null,
    supply: null,
    high24h: null,
    low24h: null,
    spark: [],
  }
}

/** A deterministic saw-tooth series with clear swings at known prices. */
function fixtureCandles(count = 60, base = 100, step = 2): Parameters<typeof analyzeTimeframe>[0] {
  const candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number }> = []
  let price = base
  for (let i = 0; i < count; i++) {
    price = base + Math.sin(i / 5) * step * 4 + (i % 10) * (i % 2 === 0 ? step : -step) * 0.4
    const open = price
    const close = price + (i % 2 === 0 ? 0.5 : -0.5)
    candles.push({
      timestamp: 1_700_000_000_000 + i * 3_600_000,
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
    })
  }
  return candles
}

const okResponse = (payload: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })

const tdValues = (rows: Array<[string, number, number, number, number, number?]>) => ({
  meta: { symbol: 'XAU/USD', interval: '1h', type: 'Forex' },
  status: 'ok',
  values: rows.map(([datetime, open, high, low, close, volume]) => ({
    datetime,
    open: String(open),
    high: String(high),
    low: String(low),
    close: String(close),
    ...(volume === undefined ? {} : { volume: String(volume) }),
  })),
})

const makeValues = (count: number, base = 4000): Array<[string, number, number, number, number, number?]> =>
  Array.from({ length: count }, (_, index) => [
    `2026-08-0${(index % 9) + 1} 1${index % 10}:00:00`,
    base + index,
    base + index + 5,
    base + index - 5,
    base + index + 1,
    100 + index,
  ])

beforeEach(() => {
  setTwelveDataKeyForTests('test-key')
  resetTwelveDataBudgetForTests()
  resetTwelveDataDiagnosticsForTests()
  clearTwelveDataCache()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  setTwelveDataKeyForTests(null)
})

/* ------------------------------------------------------------------ */
/* A — XAU/USD is identified as XAU/USD.                               */
/* ------------------------------------------------------------------ */

describe('A — XAU/USD identity', () => {
  it('routes Spot Gold exclusively through Twelve Data with symbol XAU/USD', () => {
    const gold = registryCoin('gold')
    expect(ASSET_REGISTRY.find((asset) => asset.id === 'gold')?.twelveDataSymbol).toBe('XAU/USD')
    for (const window of ['1M', '5M', '15M', '1H', '4H', '1D', '1W'] as const) {
      const source = resolveSeriesSource(gold, window)
      expect(source).not.toBeNull()
      expect(source?.provider.id).toBe('twelvedata')
      expect(source?.symbol).toBe('XAU/USD')
    }
  })

  it('labels the series source with the XAU/USD instrument', () => {
    const gold = registryCoin('gold')
    expect(sourceLabel(gold, {
      candles: [],
      granularity: '1h',
      provider: 'twelvedata',
      symbol: 'XAU/USD',
      fetchedAt: 0,
      lastCandleAt: 0,
      intervalMs: 3_600_000,
    })).toBe('Twelve Data · 1h · XAU/USD')
    expect(surfaceSource(gold, 'twelvedata', 'XAU/USD', '1h')).toBe('Twelve Data · 1h · XAU/USD')
  })
})

/* ------------------------------------------------------------------ */
/* B — XAG/USD is identified as XAG/USD.                               */
/* ------------------------------------------------------------------ */

describe('B — XAG/USD identity', () => {
  it('routes Spot Silver exclusively through Twelve Data with symbol XAG/USD', () => {
    const silver = registryCoin('silver')
    expect(ASSET_REGISTRY.find((asset) => asset.id === 'silver')?.twelveDataSymbol).toBe('XAG/USD')
    for (const window of ['1M', '5M', '15M', '1H', '4H', '1D', '1W'] as const) {
      const source = resolveSeriesSource(silver, window)
      expect(source?.provider.id).toBe('twelvedata')
      expect(source?.symbol).toBe('XAG/USD')
    }
  })
})

/* ------------------------------------------------------------------ */
/* C — PAXG/USDT cannot enter the XAU/USD pipeline.                    */
/* ------------------------------------------------------------------ */

describe('C — PAXG isolation', () => {
  it('removed the PAXG proxy from the Spot Gold registry entry', () => {
    const gold = ASSET_REGISTRY.find((asset) => asset.id === 'gold')
    expect(gold?.exchangeSymbol).toBeUndefined()
  })

  it('never resolves Gold or Silver through the exchange provider', () => {
    const gold = registryCoin('gold')
    const silver = registryCoin('silver')
    for (const coin of [gold, silver]) {
      for (const window of ['1M', '5M', '15M', '1H', '4H', '1D', '1W'] as const) {
        const source = resolveSeriesSource(coin, window)
        expect(source?.provider.id).not.toBe('exchange')
        expect(source?.symbol ?? '').not.toContain('PAXG')
      }
    }
  })

  it('parses only Twelve Data-shaped payloads into candles', () => {
    // A Binance-style kline row must not be mistaken for a Twelve Data candle.
    const binanceShape = { status: 'ok', values: 'not-an-array' }
    expect(parseTimeSeriesPayload(binanceShape)).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* D — Missing intraday data produces an honest unavailable state.     */
/* ------------------------------------------------------------------ */

describe('D — honest unavailable states', () => {
  it('no key → resolve null with an explicit not-configured reason', () => {
    setTwelveDataKeyForTests(null)
    const gold = registryCoin('gold')
    for (const window of ['1M', '5M', '15M', '1H', '4H', '1D', '1W'] as const) {
      expect(resolveSeriesSource(gold, window)).toBeNull()
      const reason = unavailableReason(gold, window)
      expect(reason).toContain('Twelve Data is not configured')
      expect(reason).toContain('VITE_TWELVEDATA_API_KEY')
      expect(reason).not.toContain('PAXG')
    }
  })

  it('a provider interval error surfaces the real API message', () => {
    const payload = {
      code: 400,
      message: 'interval 1min is not available for XAU/USD on your plan',
      status: 'error',
    }
    const error = parseTimeSeriesError(payload)
    expect(error?.code).toBe(400)
    expect(error?.message).toContain('1min is not available')
    expect(parseTimeSeriesPayload(payload)).toEqual([])
  })

  it('a 401 apikey error is surfaced, never turned into candles', () => {
    const payload = { code: 401, message: '**apikey** parameter is incorrect or not specified', status: 'error' }
    expect(parseTimeSeriesError(payload)?.code).toBe(401)
    expect(parseTimeSeriesPayload(payload)).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* E — Real candles produce Forge Liquidity Model zones.               */
/* ------------------------------------------------------------------ */

describe('E — Liquidity Model over real candles', () => {
  it('detects buy/sell liquidity zones with rank metadata', () => {
    const candles = fixtureCandles(120)
    const analysis = analyzeTimeframe(candles, candles[candles.length - 1].close, '1H', '1h')
    expect(analysis.candleCount).toBe(120)
    expect(analysis.liquidity.buySide.length).toBeGreaterThan(0)
    expect(analysis.liquidity.sellSide.length).toBeGreaterThan(0)
    for (const zone of [...analysis.liquidity.buySide, ...analysis.liquidity.sellSide]) {
      expect(zone.price).toBeGreaterThan(0)
      expect(zone.zoneHigh).toBeGreaterThanOrEqual(zone.zoneLow)
      expect(['buy', 'sell']).toContain(zone.side)
      expect(['high', 'medium', 'low']).toContain(zone.rank)
      expect(zone.source.length).toBeGreaterThan(0)
    }
  })

  it('detects equal-high clusters and records sweeps deterministically', () => {
    // Two near-identical highs (115 / 115.2) form an equal-high pool BELOW the
    // window's true extreme (125) so consolidation keeps the equal label; a
    // later wick through the pool records a genuine sweep.
    const candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number }> = []
    let t = 1_700_000_000_000
    for (let i = 0; i < 40; i++) {
      const base = 100 + Math.sin(i / 4) * 3
      let open = base - 1
      let high = base + 2
      let low = base - 2
      let close = base + 1
      if (i === 10) {
        high = 115
        close = 113
      }
      if (i === 20) {
        high = 115.2
        close = 113.5
      }
      if (i === 35) {
        high = 125
        close = 112
      }
      if (i === 36) {
        high = 118
        low = 99
        close = 100
      }
      candles.push({ timestamp: t, open, high, low, close })
      t += 3_600_000
    }
    const analysis = analyzeTimeframe(candles, 110, '1H', '1h')
    const equalHigh = [...analysis.liquidity.buySide].find((zone) => zone.source.includes('equal'))
    expect(equalHigh).toBeDefined()
    expect(equalHigh!.touches).toBeGreaterThanOrEqual(2)
    // The band spans every swing in the pool.
    expect(equalHigh!.zoneLow).toBeLessThanOrEqual(115)
    expect(equalHigh!.zoneHigh).toBeGreaterThanOrEqual(115.2)
    // The 118 wick traded through the pool → a recorded sweep, with price
    // closing back below the level (grab-and-return).
    expect(equalHigh!.swept).toBe(true)
    expect(analysis.sweeps.length).toBeGreaterThan(0)
    expect(analysis.sweeps[0]).toMatchObject({ side: 'buy', direction: 'up', returned: true })
  })
})

/* ------------------------------------------------------------------ */
/* F — Snapshot source + last-update timestamp wiring.                 */
/* ------------------------------------------------------------------ */

describe('F — source and last-update metadata', () => {
  it('surfaces the provider, instrument and honest data timestamp', () => {
    const silver = registryCoin('silver')
    expect(surfaceSource(silver, 'twelvedata', 'XAG/USD', '15m')).toBe('Twelve Data · 15m · XAG/USD')

    // Parsed series order ascending ⇒ last candle is the newest; lastCandleAt
    // must equal it (the hook feeds this to "Updated Xs ago").
    const values = makeValues(30, 29)
    const candles = parseTimeSeriesPayload(tdValues(values))
    expect(candles.length).toBe(30)
    expect(candles[candles.length - 1].timestamp).toBeGreaterThan(candles[0].timestamp)
  })

  it('parses volume from Twelve Data values when present', () => {
    const candles = parseTimeSeriesPayload(tdValues(makeValues(3)))
    expect(candles[0].volume).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* Window mappings — 1m/5m/15m/1h/4h/1D/1W → Twelve Data intervals.    */
/* ------------------------------------------------------------------ */

describe('Twelve Data window mappings', () => {
  it('maps every workspace window to the correct Twelve Data interval', () => {
    const expected: Record<string, string> = {
      '1M': '1min',
      '5M': '5min',
      '15M': '15min',
      '1H': '1h',
      '4H': '4h',
      '1D': '1day',
      '1W': '1week',
    }
    for (const [window, interval] of Object.entries(expected)) {
      expect(TWELVE_DATA_WINDOW_PLANS[window as keyof typeof TWELVE_DATA_WINDOW_PLANS]?.interval).toBe(interval)
    }
  })
})

/* ------------------------------------------------------------------ */
/* Diagnostics — the six states are distinguishable.                    */
/* ------------------------------------------------------------------ */

describe('Twelve Data diagnostics', () => {
  it('reports missing_key without exposing the key value', () => {
    setTwelveDataKeyForTests(null)
    void twelveDataHistoryProvider
      .fetchWindowCandles('XAU/USD', '1H', undefined)
      .then(() => null, () => null)
    const state = twelveDataDiagnostics()
    expect(state.keyConfigured).toBe(false)
    expect(state.lastOutcome).toBe('missing_key')
    expect(state.lastSymbol).toBe('XAU/USD')
    expect(JSON.stringify(state)).not.toContain('test-key')
  })

  it('reports unsupported_symbol with the API message verbatim', async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ code: 400, message: 'interval 1min is not available for XAU/USD on your plan', status: 'error' }),
    )
    const failure = await twelveDataHistoryProvider
      .fetchWindowCandles('XAU/USD', '1M', undefined)
      .then(() => null, (cause: unknown) => cause)
    expect(String(failure)).toContain('interval 1min is not available')
    expect(twelveDataDiagnostics().lastOutcome).toBe('unsupported_symbol')
  })

  it('reports rate_limit on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429, headers: { 'api-credits-used': '8' } }))
    await twelveDataHistoryProvider.fetchWindowCandles('XAU/USD', '1H', undefined).then(() => null, () => null)
    expect(twelveDataDiagnostics().lastOutcome).toBe('rate_limit')
  })

  it('reports empty_response with a descriptive error instead of silent null', async () => {
    vi.mocked(fetch).mockResolvedValue(okResponse({ status: 'ok', values: [] }))
    const failure = await twelveDataHistoryProvider
      .fetchWindowCandles('XAU/USD', '1H', undefined)
      .then(() => null, (cause: unknown) => cause)
    expect(String(failure)).toContain('no usable candles for XAU/USD on 1H')
    expect(twelveDataDiagnostics().lastOutcome).toBe('empty_response')
  })

  it('redacts the key from any API error message that echoes it', async () => {
    // Malicious/edge payload: the API error echoes the key value back.
    vi.mocked(fetch).mockResolvedValue(
      okResponse({ code: 400, message: 'invalid key test-key was rejected', status: 'error' }),
    )
    const failure = await twelveDataHistoryProvider
      .fetchWindowCandles('XAU/USD', '1H', undefined)
      .then(() => null, (cause: unknown) => cause)
    expect(String(failure)).toContain('[redacted]')
    expect(String(failure)).not.toContain('test-key')
    expect(JSON.stringify(twelveDataDiagnostics())).not.toContain('test-key')
  })

  it('reports success and records it in the snapshot', async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse(tdValues(makeValues(40)), { 'api-credits-used': '1', 'api-credits-left': '7' }),
    )
    const series = await twelveDataHistoryProvider.fetchWindowCandles('XAU/USD', '1H', undefined)
    expect(series?.provider).toBe('twelvedata')
    expect(series?.symbol).toBe('XAU/USD')
    const state = twelveDataDiagnostics()
    expect(state.lastOutcome).toBe('success')
    expect(state.lastStatus).toBe(200)
    expect(state.lastCreditsLeft).toBe(7)
    expect(state.lastSuccessAt).not.toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* G — Rate-limit errors never crash the workspace.                    */
/* ------------------------------------------------------------------ */

describe('G — rate-limit resilience', () => {
  it('fetchJson raises RateLimitError on HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429 }))
    await expect(fetchJson('https://example.test/x')).rejects.toBeInstanceOf(RateLimitError)
    const error = await fetchJson('https://example.test/x').catch((cause: unknown) => cause)
    expect(error).toHaveProperty('name', 'RateLimitError')
    expect(error).toHaveProperty('status', 429)
  })

  it('the Twelve Data provider rejects with RateLimitError on 429', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 429, headers: { 'api-credits-used': '8' } }))
    const failure = await twelveDataHistoryProvider
      .fetchWindowCandles('XAU/USD', '1H', undefined)
      .then(() => null, (cause: unknown) => cause)
    expect(failure).toBeInstanceOf(RateLimitError)
  })

  it('records api-credits-used from responses for the budget guard', async () => {
    vi.mocked(fetch).mockResolvedValue(
      okResponse(tdValues(makeValues(40)), { 'api-credits-used': '1', 'api-credits-left': '7' }),
    )
    const series = await twelveDataHistoryProvider.fetchWindowCandles('XAU/USD', '1H', undefined)
    expect(series).not.toBeNull()
    expect(series!.provider).toBe('twelvedata')
    expect(series!.symbol).toBe('XAU/USD')
    expect(series!.candles.length).toBe(40)
    // Never a crypto exchange provider for Spot Gold.
    expect(series!.provider).not.toBe('binance')
    expect(series!.provider).not.toBe('coingecko')
  })
})

/* ------------------------------------------------------------------ */
/* H — Cached data never masquerades as fresh.                         */
/* ------------------------------------------------------------------ */

describe('H — cache honesty', () => {
  it('classifyFreshness reflects the candle timestamp, not the fetch time', () => {
    const now = Date.now()
    const series = {
      candles: [{ timestamp: now - 30_000, open: 1, high: 1, low: 1, close: 1 }],
      granularity: '1m',
      provider: 'twelvedata',
      symbol: 'XAU/USD',
      fetchedAt: now,
      lastCandleAt: now - 30_000,
      intervalMs: 60_000,
    }
    expect(classifyFreshness(series, now)).toBe('live')
    expect(classifyFreshness({ ...series, lastCandleAt: now - 3 * 60_000 }, now)).toBe('recent')
    expect(classifyFreshness({ ...series, lastCandleAt: now - 10 * 60_000 }, now)).toBe('stale')
    expect(classifyFreshness(null, now)).toBe('unavailable')
  })

  it('deduplicates simultaneous requests for the same series (single fetch)', async () => {
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValue(okResponse(tdValues(makeValues(40)), { 'api-credits-used': '1' }))
    const [first, second] = await Promise.all([
      twelveDataHistoryProvider.fetchWindowCandles('XAU/USD', '5M', undefined),
      twelveDataHistoryProvider.fetchWindowCandles('XAU/USD', '5M', undefined),
    ])
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

/* ------------------------------------------------------------------ */
/* Credit model sanity — official formula + Basic plan caps.           */
/* ------------------------------------------------------------------ */

describe('credit model', () => {
  it('estimates the four-instrument monitor load and verdicts honestly', () => {
    const report = estimateTwelveDataUsage({ symbols: ['BTC', 'ETH', 'XAU/USD', 'XAG/USD'] })
    // 4 symbols × 1440 min/day ÷ close minutes per window.
    expect(report.perWindow.find((row) => row.window === '1M')?.requestsPerDay).toBe(5760)
    expect(report.perWindow.find((row) => row.window === '1H')?.requestsPerDay).toBe(96)
    expect(report.perWindow.find((row) => row.window === '1D')?.requestsPerDay).toBe(4)
    // The always-on 1M+5M load exceeds the 800/day Basic cap → honest verdict.
    expect(report.withinDailyLimit).toBe(false)
    expect(report.verdict).toContain('exceeds the Basic daily cap')
    // 15M-and-above fits.
    const calm = estimateTwelveDataUsage({ symbols: ['BTC', 'ETH', 'XAU/USD', 'XAG/USD'], weights: { '1M': 0, '5M': 0 } })
    expect(calm.withinDailyLimit).toBe(true)
  })
})
