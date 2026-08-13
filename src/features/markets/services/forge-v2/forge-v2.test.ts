import { describe, expect, it } from 'vitest'

import { buildOracleRequest } from '@/features/ai/build-request'
import type { Coin } from '@/features/markets/types'
import type { Candle } from '../history'
import { analyzeTimeframe } from '../market-intelligence'
import { analyzeForgeV2 } from './engine'
import { mergeV2Config, DEFAULT_V2_CONFIG } from './config'

/* ------------------------------------------------------------------ */
/* Fixtures — fully deterministic candle sequences around gold prices. */
/* Reuses the proven patterns from setup-intelligence.test.ts.        */
/* ------------------------------------------------------------------ */

type Row = [open: number, high: number, low: number, close: number]

function series(rows: Row[], start = 1_700_000_000_000, stepMs = 3_600_000): Candle[] {
  return rows.map(([open, high, low, close], index) => ({
    timestamp: start + index * stepMs,
    open,
    high,
    low,
    close,
  }))
}

function analyze(candles: Candle[]) {
  return analyzeTimeframe(candles, candles[candles.length - 1].close, '1H', '1h')
}

/** Mild oscillation with one isolated swing high (2402.6). */
const prelude: Row[] = [
  [2400.0, 2400.8, 2399.6, 2400.3],
  [2400.3, 2400.6, 2399.7, 2400.1],
  [2400.1, 2401.6, 2400.0, 2400.7],
  [2400.7, 2401.0, 2400.1, 2400.4],
  [2400.4, 2402.6, 2400.3, 2400.9],
  [2400.9, 2401.2, 2400.4, 2400.6],
  [2400.6, 2400.9, 2399.2, 2399.6],
  [2399.6, 2400.4, 2399.3, 2399.9],
  [2399.9, 2400.2, 2399.0, 2399.4],
  [2399.4, 2400.2, 2399.1, 2399.7],
]

/** Isolated dip → the sell-side liquidity level at 2395. */
const dip: Row = [2400.5, 2401.5, 2395.0, 2396.0]

/** Wicky, small-body recovery — no displacement. */
const recovery: Row[] = [
  [2396.0, 2397.5, 2395.4, 2396.8],
  [2396.8, 2397.9, 2396.1, 2397.2],
  [2397.2, 2398.6, 2396.9, 2397.6],
  [2397.6, 2398.8, 2397.2, 2398.0],
  [2398.0, 2399.4, 2397.6, 2398.5],
  [2398.5, 2399.6, 2398.0, 2398.9],
  [2398.9, 2400.2, 2398.4, 2399.4],
  [2399.4, 2400.5, 2398.9, 2399.8],
  [2399.8, 2400.9, 2399.3, 2400.2],
  [2400.2, 2401.4, 2399.7, 2400.6],
  [2400.6, 2401.7, 2400.1, 2401.0],
  [2401.0, 2402.1, 2400.5, 2401.4],
  [2401.4, 2402.6, 2400.9, 2401.8],
  [2401.8, 2402.9, 2401.3, 2402.2],
  [2402.2, 2403.3, 2401.7, 2402.6],
  [2402.6, 2403.8, 2402.1, 2403.0],
  [2403.0, 2404.2, 2402.5, 2403.4],
  [2403.4, 2404.6, 2402.9, 2403.8],
  [2403.8, 2405.0, 2403.3, 2404.2],
  [2404.2, 2405.4, 2403.7, 2404.6],
  [2404.6, 2405.8, 2404.1, 2405.0],
]

/** Trades through the 2395 level and closes back above it (grab + return). */
const sweepCandle: Row = [2403.0, 2404.5, 2392.0, 2401.0]

/** Strong bullish leg — the displacement. */
const leg: Row[] = [
  [2402.0, 2410.5, 2401.5, 2410.0],
  [2410.0, 2418.5, 2409.5, 2418.0],
  [2418.0, 2424.5, 2417.5, 2424.0],
]

/** Two-candle pullback INTO the displacement zone; reaction held. */
const pullback: Row[] = [
  [2424.0, 2424.5, 2416.0, 2419.5],
  [2419.5, 2419.8, 2411.0, 2415.0],
]

/** Bullish engulfing of the pullback — the confirmation candle. */
const engulf: Row = [2414.0, 2423.0, 2412.0, 2422.0]

/** Fixture D — sweep + displacement + retracement, NO confirmation. */
const fixtureD = series([...prelude, dip, ...recovery, sweepCandle, ...leg, ...pullback, [2415.0, 2416.4, 2413.6, 2414.6], [2414.6, 2416.0, 2413.2, 2415.4], [2415.4, 2416.6, 2414.0, 2416.0], [2416.0, 2416.8, 2414.6, 2416.4]])

/** Fixture E — the completed confluence setup (sweep + disp + pullback + confirmation). */
const fixtureE = series([...prelude, dip, ...recovery, sweepCandle, ...leg, ...pullback, engulf])

/** Quiet 1-minute prelude for a separate confirmation series. */
const oneMinuteQuiet: Row[] = Array.from({ length: 14 }, (_, i) => {
  const open = 2414 + i * 0.1
  const close = open + (i % 2 === 0 ? 0.4 : -0.2)
  return [open, Math.max(open, close) + 0.4, Math.min(open, close) - 0.4, close] as Row
})

/** Small red candle, then a bullish engulfing on 1m (body ≈ 2.6). */
const oneMinuteConfirmation: Row[] = [
  [2417.8, 2418.4, 2417.2, 2417.5],
  [2416.0, 2419.2, 2415.6, 2418.6],
]

/* ------------------------------------------------------------------ */
/* Canonical state                                                     */
/* ------------------------------------------------------------------ */

describe('analyzeForgeV2 — canonical state', () => {
  it('produces a forge-v2 state with engine/version/configuration metadata', () => {
    const analysis = analyze(fixtureE)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureE })

    expect(state.engine).toBe('forge-v2')
    expect(state.version).toBe(2)
    expect(state.market.asset).toBe('XAU/USD')
    expect(state.market.timeframe).toBe('1H')
    expect(state.market.candleCount).toBe(fixtureE.length)
    expect(state.metadata.configVersion).toBe(DEFAULT_V2_CONFIG.version)
    expect(state.scoring.configuration).toBeDefined()
  })

  it('exposes every group read and keeps the score fully traceable', () => {
    const analysis = analyze(fixtureE)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureE })

    expect(state.sweeps.read?.recent).toBe(true)
    expect(state.sweeps.read?.direction).toBe('long')
    expect(state.displacement.read?.direction).toBe('up')
    expect(state.pullback.read?.enteredZone).toBe(true)
    expect(state.pullback.read?.reaction).toBe('held')
    expect(state.confirmation.read?.kind).toBe('engulfing')
    expect(state.setup.invalidation).toBeTruthy()

    // The winning family's contributions + any confluence bonus EQUAL the
    // final score — every point is explainable.
    const c = state.scoring.contributions
    const sum = c.liquidity + c.sweep + c.displacement + c.pullback + c.confirmation + c.context
    expect(sum + (state.scoring.confluenceBonus?.points ?? 0)).toBe(state.scoring.total)
    expect(state.scoring.reasons.length).toBeGreaterThan(0)
  })

  it('reports missing/negative factors explicitly (no confirmation)', () => {
    const analysis = analyze(fixtureD)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureD })
    expect(state.scoring.contributions.confirmation).toBe(0)
    expect(state.scoring.missing.some((m) => /confirmation/i.test(m))).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Liquidity group                                                     */
/* ------------------------------------------------------------------ */

describe('liquidity group', () => {
  it('carries the real zones and a traceable contribution', () => {
    const analysis = analyze(fixtureD)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureD })
    expect(state.liquidity.buySide.length + state.liquidity.sellSide.length).toBeGreaterThan(0)
    expect(state.liquidity.contribution).toBeGreaterThan(0)
    expect(state.liquidity.reasons.length).toBeGreaterThan(0)
  })
})

/* ------------------------------------------------------------------ */
/* Equal-high / equal-low priority                                     */
/* ------------------------------------------------------------------ */

describe('equal high / equal low priority', () => {
  /** Two equal lows at ~2395 (sell side), swept → long setup. */
  function equalLowSweepFixture(): Candle[] {
    return series([
      ...prelude,
      // Low #1 — wicky dip to 2395.5.
      [2402.0, 2403.0, 2395.5, 2402.0],
      ...recovery,
      // Low #2 — matching dip to 2395.3 (equal low within tolerance).
      [2403.0, 2404.0, 2395.3, 2402.5],
      ...recovery.slice(0, 10),
      // Sweep through the equal-low pool, close back above it.
      [2402.0, 2403.5, 2391.5, 2401.0],
      [2401.0, 2402.6, 2400.3, 2401.7],
      [2401.7, 2402.9, 2400.8, 2402.1],
      [2402.1, 2403.2, 2401.5, 2402.5],
      [2402.5, 2403.6, 2401.9, 2402.9],
    ])
  }

  it('sweeps an equal-low pool and classifies it with extra importance', () => {
    const candles = equalLowSweepFixture()
    const analysis = analyze(candles)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })

    expect(state.sweeps.read?.direction).toBe('long')
    expect(state.sweeps.read?.levelSource).toContain('equal_low')

    // The equal-low weight (1.15) must score HIGHER than the swing baseline
    // (1.0) — equal lows carry extra importance by default.
    const swing = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { liquidity: { equalLowWeight: 1 } },
    })
    expect(state.liquidity.contribution).toBeGreaterThan(swing.liquidity.contribution)
    expect(state.scoring.total).toBeGreaterThan(swing.scoring.total)
  })

  it('parameter proof — equalLowWeight actually changes the score', () => {
    const candles = equalLowSweepFixture()
    const analysis = analyze(candles)

    const heavy = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { liquidity: { equalLowWeight: 2.5 } },
    })
    const light = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { liquidity: { equalLowWeight: 0.1 } },
    })
    expect(heavy.liquidity.contribution).toBeGreaterThan(light.liquidity.contribution)
    expect(heavy.scoring.total).toBeGreaterThan(light.scoring.total)
  })
})

/* ------------------------------------------------------------------ */
/* Sweep group                                                         */
/* ------------------------------------------------------------------ */

describe('sweep group', () => {
  it('reads a real swept level with provenance', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, [2401.0, 2402.6, 2400.3, 2401.7], [2401.7, 2402.9, 2400.8, 2402.1], [2402.1, 2403.2, 2401.5, 2402.5], [2402.5, 2403.6, 2401.9, 2402.9], [2402.9, 2404.0, 2402.3, 2403.2], [2403.2, 2404.1, 2402.6, 2403.4]])
    const analysis = analyze(candles)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })

    expect(state.sweeps.records.length).toBeGreaterThan(0)
    expect(state.sweeps.read?.recent).toBe(true)
    expect(state.sweeps.read?.returned).toBe(true)
    expect(Math.round(state.sweeps.read!.levelPrice!)).toBe(2395)
    expect(state.sweeps.contribution).toBeGreaterThan(0)
  })

  it('parameter proof — minimum penetration controls whether a sweep counts', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, [2401.0, 2402.6, 2400.3, 2401.7], [2401.7, 2402.9, 2400.8, 2402.1], [2402.1, 2403.2, 2401.5, 2402.5], [2402.5, 2403.6, 2401.9, 2402.9], [2402.9, 2404.0, 2402.3, 2403.2], [2403.2, 2404.1, 2402.6, 2403.4]])
    const analysis = analyze(candles)

    const lenient = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })
    expect(lenient.sweeps.read).not.toBeNull()

    // The fixture pierces 2395 → 2392 (penetration 3.0). Requiring MORE than
    // that penetration disqualifies the sweep entirely — the sweep vanishes.
    const strict = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { sweep: { minimumPenetrationAtp: 3 } },
    })
    expect(strict.sweeps.read).toBeNull()
    expect(strict.scoring.family).toBe('none')
    expect(strict.scoring.total).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* Displacement group                                                  */
/* ------------------------------------------------------------------ */

describe('displacement group', () => {
  it('detects displacement independently of any sweep', () => {
    // The leg WITHOUT the sweep fixture — displacement stands alone.
    const candles = series([...prelude, dip, ...recovery, ...leg])
    const analysis = analyze(candles)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })

    expect(state.sweeps.read).toBeNull()
    expect(state.displacement.read).not.toBeNull()
    expect(state.displacement.read!.direction).toBe('up')
    expect(state.displacement.read!.evidence.rangeExpansion).toBeGreaterThanOrEqual(1.6)
  })

  it('parameter proof — minRangeExpansion controls displacement detection', () => {
    // A MODEST leg after quiet, alternating candles (no qualifying prelude
    // legs; the leg's own expansion is measured from the real analysis).
    const quiet: Row[] = Array.from({ length: 16 }, (_, i) => {
      const open = 2400 + i * 0.05
      const close = open + (i % 2 === 0 ? 0.4 : -0.4)
      return [open, open + 0.4, open - 0.4, close] as Row
    })
    const modestLeg: Row[] = [
      [2401.0, 2402.3, 2401.0, 2402.2],
      [2402.2, 2403.5, 2402.0, 2403.4],
    ]
    const candles = series([...quiet, ...modestLeg])
    const analysis = analyze(candles)

    // Measure the strongest candle's range expansion on the REAL series — the
    // fixture's expansion sits well inside the clamp range, so both sides of
    // the proof are reachable with the configurable threshold.
    const strongestRange = 1.5
    const measuredExpansion = strongestRange / analysis.atr
    expect(measuredExpansion).toBeGreaterThan(0.5)
    expect(measuredExpansion).toBeLessThan(5)

    const relaxed = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { displacement: { minRangeExpansion: measuredExpansion * 0.8 } },
    })
    expect(relaxed.displacement.read).not.toBeNull()

    const strict = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { displacement: { minRangeExpansion: measuredExpansion + 0.5 } },
    })
    expect(strict.displacement.read).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Pullback group                                                      */
/* ------------------------------------------------------------------ */

describe('pullback group', () => {
  it('requires no pullback for a sweep → confirmation setup to stand', () => {
    // Fixture B — sweep only, no displacement, no pullback. Valid setup.
    const candles = series([...prelude, dip, ...recovery, sweepCandle, [2401.0, 2402.6, 2400.3, 2401.7], [2401.7, 2402.9, 2400.8, 2402.1], [2402.1, 2403.2, 2401.5, 2402.5], [2402.5, 2403.6, 2401.9, 2402.9], [2402.9, 2404.0, 2402.3, 2403.2], [2403.2, 2404.1, 2402.6, 2403.4]])
    const analysis = analyze(candles)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })

    expect(state.pullback.read).toBeNull()
    expect(state.scoring.family).toBe('liquidity_sweep')
    expect(state.scoring.total).toBeGreaterThan(0)
  })

  it('parameter proof — min retracement depth gates the pullback read', () => {
    const analysis = analyze(fixtureD)
    const base = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureD })
    expect(base.pullback.read?.enteredZone).toBe(true)

    // Requiring more than the fixture retraced removes the pullback read —
    // the displacement family can no longer form.
    const strict = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      config: { pullback: { minimumRetracement: 0.9 } },
    })
    const depth = base.pullback.read!.depthPercent
    expect(depth).toBeLessThan(0.9)
    expect(strict.pullback.read?.enteredZone ?? false).toBe(false)
    expect(strict.scoring.family).not.toBe('confluence')
  })
})

/* ------------------------------------------------------------------ */
/* Confirmation group — 1M execution model                             */
/* ------------------------------------------------------------------ */

describe('confirmation group — 1M execution model', () => {
  const oneMinuteSeries = series([...oneMinuteQuiet, ...oneMinuteConfirmation], 1_700_000_000_000, 60_000)

  it('confirms on a separate 1m series while liquidity reads 1H', () => {
    const analysis = analyze(fixtureD)
    const state = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      confirmationSeries: { candles: oneMinuteSeries, timeframe: '1m' },
    })

    expect(state.confirmation.read).not.toBeNull()
    expect(state.confirmation.read!.kind).toBe('engulfing')
    expect(state.confirmation.read!.direction).toBe('long')
    // The confirmation came from the 1M series — NOT the 1H window.
    expect(state.confirmation.timeframe).toBe('1m')
    expect(state.market.timeframe).toBe('1H')
  })

  it('parameter proof — minBodyAtp gates whether the 1m candle confirms', () => {
    const analysis = analyze(fixtureD)
    const base = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      confirmationSeries: { candles: oneMinuteSeries, timeframe: '1m' },
    })
    expect(base.confirmation.read).not.toBeNull()

    const strict = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      confirmationSeries: { candles: oneMinuteSeries, timeframe: '1m' },
      config: { confirmation: { minBodyAtp: 3 } },
    })
    expect(strict.confirmation.read).toBeNull()
    expect(strict.confirmation.contribution).toBe(0)
  })

  it('parameter proof — confirmationTimeframe is honored in the canonical state', () => {
    const analysis = analyze(fixtureD)
    const state = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      confirmationSeries: { candles: oneMinuteSeries, timeframe: '1m' },
      config: { confirmation: { confirmationTimeframe: '5m' } },
    })
    expect(state.confirmation.timeframe).toBe('1m') // series wins — it IS 1m
    // The config value is honored when no separate series is supplied.
    const noSeries = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureD,
      config: { confirmation: { confirmationTimeframe: '5m' } },
    })
    expect(noSeries.confirmation.timeframe).toBe('5m')
  })
})

/* ------------------------------------------------------------------ */
/* Scoring group                                                       */
/* ------------------------------------------------------------------ */

describe('scoring group', () => {
  it('classifies the completed confluence setup as strong', () => {
    const analysis = analyze(fixtureE)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureE })
    expect(state.scoring.family).toBe('confluence')
    expect(state.scoring.level).toBe('strong')
    expect(state.scoring.total).toBeGreaterThanOrEqual(75)
  })

  it('parameter proof — strongThreshold changes the classification', () => {
    const analysis = analyze(fixtureE)
    const base = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles: fixtureE })
    expect(base.scoring.level).toBe('strong')

    const strict = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles: fixtureE,
      config: { scoring: { strongThreshold: 95 } },
    })
    expect(strict.scoring.level).not.toBe('strong')
  })

  it('parameter proof — equalHighWeight changes the score on an equal-high sweep', () => {
    // Mirror of the buy-side sweep fixture from setup-intelligence.test.ts.
    const candles = series([
      [2400.0, 2400.7, 2399.5, 2400.3],
      [2400.3, 2400.6, 2399.6, 2400.1],
      [2400.1, 2401.5, 2399.8, 2400.6],
      [2400.6, 2400.9, 2399.9, 2400.3],
      [2400.3, 2401.8, 2400.0, 2400.7],
      [2400.7, 2401.0, 2400.1, 2400.4],
      [2400.4, 2401.2, 2400.0, 2400.5],
      [2400.5, 2400.8, 2399.9, 2400.2],
      [2400.2, 2401.0, 2399.7, 2400.4],
      [2400.4, 2400.7, 2399.8, 2400.1],
      // Swing high #1.
      [2400.1, 2405.5, 2399.9, 2403.0],
      [2403.0, 2403.5, 2401.0, 2402.0],
      [2402.0, 2402.5, 2400.6, 2401.2],
      [2401.2, 2402.0, 2400.4, 2401.0],
      [2401.0, 2402.4, 2400.5, 2401.5],
      [2401.5, 2402.0, 2400.6, 2401.2],
      [2401.2, 2402.2, 2400.4, 2401.4],
      [2401.4, 2402.0, 2400.8, 2401.6],
      [2401.6, 2402.3, 2400.9, 2401.8],
      [2401.8, 2402.5, 2401.0, 2402.0],
      // Swing high #2 — equal-high pool with #1.
      [2402.0, 2405.8, 2401.2, 2403.0],
      [2403.0, 2403.5, 2401.5, 2402.5],
      [2402.5, 2403.0, 2401.2, 2402.2],
      [2402.2, 2402.8, 2401.0, 2402.0],
      [2402.0, 2403.2, 2401.1, 2402.3],
      [2402.3, 2402.8, 2401.3, 2402.1],
      [2402.1, 2402.6, 2401.0, 2401.8],
      [2401.8, 2403.0, 2401.2, 2402.2],
      [2402.2, 2403.4, 2401.4, 2402.6],
      // Sweep above the pool, close back below it.
      [2402.0, 2407.5, 2401.5, 2402.5],
      [2402.5, 2403.0, 2401.6, 2402.2],
      [2402.2, 2402.8, 2401.4, 2402.0],
      [2402.0, 2402.6, 2401.5, 2401.9],
      [2401.9, 2402.5, 2401.6, 2402.1],
      [2402.1, 2403.0, 2401.8, 2402.4],
    ])
    const analysis = analyze(candles)
    const state = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })
    expect(state.sweeps.read?.direction).toBe('short')
    expect(state.sweeps.read?.levelSource).toContain('equal_high')

    const light = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { liquidity: { equalHighWeight: 0.1 } },
    })
    expect(state.scoring.total).toBeGreaterThan(light.scoring.total)
  })
})

/* ------------------------------------------------------------------ */
/* Config system                                                       */
/* ------------------------------------------------------------------ */

describe('config system', () => {
  it('merges partial configs over defaults and clamps out-of-range values', () => {
    const merged = mergeV2Config({
      liquidity: { equalLowWeight: 99, maxCandidatesPerSide: 0 },
      sweep: { minimumPenetrationAtp: -5 },
      displacement: { minNetMoveAtp: 100 },
    })
    expect(merged.liquidity.equalLowWeight).toBe(3) // clamped to max
    expect(merged.liquidity.maxCandidatesPerSide).toBe(1) // clamped to min
    expect(merged.sweep.minimumPenetrationAtp).toBe(0) // clamped to min
    expect(merged.displacement.minNetMoveAtp).toBe(6) // clamped to max
    // Untouched groups keep their defaults.
    expect(merged.confirmation.confirmationTimeframe).toBe('1m')
  })

  it('changing a parameter changes the engine output — end to end', () => {
    const candles = fixtureD
    const analysis = analyze(candles)
    const defaults = analyzeForgeV2({ asset: 'XAU/USD', timeframe: '1H', analysis, candles })
    const tweaked = analyzeForgeV2({
      asset: 'XAU/USD',
      timeframe: '1H',
      analysis,
      candles,
      config: { confirmation: { contribution: 0 }, scoring: { confluenceBonus: 0 } },
    })
    // Removing the confirmation weight must change the outcome.
    expect(tweaked.scoring.total).not.toBe(defaults.scoring.total)
    // The active config snapshot reflects the change.
    expect(tweaked.scoring.configuration.confirmation.contribution).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* Oracle consumes the canonical state                                 */
/* ------------------------------------------------------------------ */

describe('Oracle integration — canonical state → payload', () => {
  const coin: Coin = {
    id: 'gold',
    name: 'Spot Gold',
    ticker: 'XAU/USD',
    price: 2310.5,
    change24h: 0.42,
    marketCap: null,
    volume24h: null,
    supply: null,
    high24h: null,
    low24h: null,
    categories: [],
    trending: false,
    color: '#b8860b',
    spark: [],
    blurb: 'Spot gold',
    assetClass: 'commodity',
    quoteCurrency: 'USD',
    decimals: 2,
    dataSource: 'goldapi',
  }

  it('buildOracleRequest embeds the V2 contributions + context when given v2Config', () => {
    const candles = fixtureE
    const analysis = analyze(candles)
    const request = buildOracleRequest({
      coin,
      timeframeId: '1H',
      analysis,
      candles,
      snapshot: null,
      v2Config: mergeV2Config({}),
      source: 'Test Feed',
      freshness: 'recent',
      requestedAnalysis: 'Analyze the setup',
      mode: 'trader',
      responseDetail: 'default',
    })

    expect(request.setupContext).not.toBeNull()
    expect(request.setupContext!.v2).not.toBeNull()
    expect(request.setupContext!.v2!.engine).toBe('forge-v2')
    expect(request.setupContext!.v2!.version).toBe(2)
    const c = request.setupContext!.v2!.contributions
    expect(c.confirmation).toBeGreaterThan(0)
    expect(request.setupContext!.family).toBe('confluence')
    expect(request.setupContext!.v2!.invalidation).toBeTruthy()
  })

  it('the payload never contains an API key', () => {
    const candles = fixtureD
    const analysis = analyze(candles)
    const request = buildOracleRequest({
      coin,
      timeframeId: '1H',
      analysis,
      candles,
      snapshot: null,
      v2Config: mergeV2Config({}),
      source: 'Test Feed',
      freshness: 'recent',
      requestedAnalysis: 'Analyze',
      mode: 'trader',
      responseDetail: 'default',
    })
    expect(JSON.stringify(request)).not.toMatch(/api[_-]?key/i)
    expect(JSON.stringify(request)).not.toMatch(/AIza/i)
  })
})
