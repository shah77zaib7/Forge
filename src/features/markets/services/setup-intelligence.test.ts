import { describe, expect, it } from 'vitest'

import type { Candle } from './history'
import { analyzeTimeframe } from './market-intelligence'
import {
  assessSetupIntelligence,
  detectConfirmation,
  detectDisplacement,
  detectRetracement,
} from './setup-intelligence'
import { parseTimeSeriesPayload } from './twelvedata'

/* ------------------------------------------------------------------ */
/* Fixtures — fully deterministic candle sequences around gold prices. */
/* ------------------------------------------------------------------ */

type Row = [open: number, high: number, low: number, close: number]

function series(rows: Row[], start = 1_700_000_000_000): Candle[] {
  return rows.map(([open, high, low, close], index) => ({
    timestamp: start + index * 3_600_000,
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

/** Wicky, small-body recovery from 2396 to 2405 — no displacement. */
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

/** Trades through the 2395 level (to 2392 — well beyond the engine's
 *  ATR-scaled consolidation tolerance so the level stays distinct) and
 *  closes back above it (grab + return). */
const sweepCandle: Row = [2403.0, 2404.5, 2392.0, 2401.0]

/** Strong bullish leg — the displacement. */
const leg: Row[] = [
  [2402.0, 2410.5, 2401.5, 2410.0],
  [2410.0, 2418.5, 2409.5, 2418.0],
  [2418.0, 2424.5, 2417.5, 2424.0],
]

/** Two-candle pullback INTO the displacement zone; body ratio < 0.55 so it
 *  never reads as a counter-displacement. */
const pullback: Row[] = [
  [2424.0, 2424.5, 2416.0, 2419.5],
  [2419.5, 2419.8, 2411.0, 2415.0],
]

/** Bullish engulfing of the pullback — the confirmation candle. */
const engulf: Row = [2414.0, 2423.0, 2412.0, 2422.0]

/* ------------------------------------------------------------------ */
/* Acceptance cases A–E                                                */
/* ------------------------------------------------------------------ */

describe('A — no liquidity sweep', () => {
  it('reads no setup when nothing was swept and no displacement exists', () => {
    // Quiet oscillation that ends INSIDE the prior candle's range, so no
    // level is ever traded through and the previous-period zones stay clean.
    const candles = series([
      ...Array.from({ length: 38 }, (_, i) => {
        const open = 2400 + i * 0.06
        const close = open + (i % 2 === 0 ? 0.25 : -0.15)
        return [open, Math.max(open, close) + 0.5, Math.min(open, close) - 0.3, close] as Row
      }),
      [2402.2, 2402.7, 2401.9, 2402.3],
      [2402.3, 2402.6, 2402.0, 2402.4],
    ])
    const analysis = analyze(candles)
    expect(analysis.insufficient).toBe(false)
    expect(analysis.sweeps.length).toBe(0)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.status).toBe('ready')
    expect(setup.sweep).toBeNull()
    expect(setup.displacement).toBeNull()
    expect(setup.setupQuality.family).toBe('none')
    expect(setup.setupQuality.level).toBe('none')
    expect(setup.setupQuality.score).toBe(0)
    expect(setup.read).toContain('no active setup')
  })
})

describe('B — liquidity sweep without displacement', () => {
  it('reads a liquidity-sweep setup from a real swept level', () => {
    const candles = series([
      ...prelude,
      dip,
      ...recovery,
      sweepCandle,
      [2401.0, 2402.6, 2400.3, 2401.7],
      [2401.7, 2402.9, 2400.8, 2402.1],
      [2402.1, 2403.2, 2401.5, 2402.5],
      [2402.5, 2403.6, 2401.9, 2402.9],
      [2402.9, 2404.0, 2402.3, 2403.2],
      [2403.2, 2404.1, 2402.6, 2403.4],
    ])
    const analysis = analyze(candles)
    expect(analysis.sweeps.length).toBeGreaterThanOrEqual(1)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.status).toBe('ready')
    expect(setup.sweep).not.toBeNull()
    expect(setup.sweep!.recent).toBe(true)
    expect(setup.sweep!.returned).toBe(true)
    expect(setup.sweep!.direction).toBe('long')
    expect(Math.round(setup.sweep!.levelPrice!)).toBe(2395)
    expect(setup.sweep!.levelSource).toBeTruthy()
    expect(setup.displacement).toBeNull()
    expect(setup.setupQuality.family).toBe('liquidity_sweep')
    expect(setup.setupQuality.level).toBe('moderate')
    expect(setup.confirmation).toBeNull()
    expect(setup.setupQuality.reasons.some((reason) => reason.includes('swept'))).toBe(true)
  })
})

describe('C — sweep + displacement (no retracement yet)', () => {
  it('reports the displacement as observed but not a displacement setup', () => {
    // The drift after the leg opens with a real DOWN candle (body beyond the
    // leg's pullback tolerance) so the displacement ends where the impulse
    // ends — and price stays out of the displacement zone (no retracement).
    const candles = series([
      ...prelude,
      dip,
      ...recovery,
      sweepCandle,
      ...leg,
      [2424.0, 2425.4, 2422.3, 2422.4],
      [2422.4, 2424.2, 2421.6, 2423.2],
      [2423.2, 2425.0, 2422.8, 2424.5],
      [2424.5, 2425.8, 2424.0, 2425.2],
      [2425.2, 2426.4, 2424.6, 2425.9],
    ])
    const analysis = analyze(candles)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.sweep?.recent).toBe(true)
    expect(setup.displacement).not.toBeNull()
    expect(setup.displacement!.direction).toBe('up')
    expect(setup.displacement!.strength).toBeGreaterThanOrEqual(70)
    expect(setup.displacement!.evidence.rangeExpansion).toBeGreaterThanOrEqual(1.6)
    expect(setup.displacement!.evidence.directionalConsistency).toBeGreaterThanOrEqual(0.5)
    expect(setup.retracement).not.toBeNull()
    expect(setup.retracement!.enteredZone).toBe(false)
    expect(setup.setupQuality.family).toBe('liquidity_sweep')
    expect(setup.setupQuality.level).toBe('moderate')
    expect(setup.read.toLowerCase()).toContain('displacement')
  })
})

describe('D — sweep + displacement + retracement (no confirmation)', () => {
  it('grades confluence moderate — a retracement without a confirmation candle', () => {
    const candles = series([
      ...prelude,
      dip,
      ...recovery,
      sweepCandle,
      ...leg,
      ...pullback,
      [2415.0, 2416.4, 2413.6, 2414.6],
      [2414.6, 2416.0, 2413.2, 2415.4],
      [2415.4, 2416.6, 2414.0, 2416.0],
      [2416.0, 2416.8, 2414.6, 2416.4],
    ])
    const analysis = analyze(candles)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.retracement).not.toBeNull()
    expect(setup.retracement!.enteredZone).toBe(true)
    expect(setup.retracement!.depthPercent).toBeGreaterThanOrEqual(0.382)
    expect(setup.retracement!.reaction).toBe('held')
    expect(setup.confirmation).toBeNull()
    expect(setup.setupQuality.family).toBe('confluence')
    expect(setup.setupQuality.level).toBe('moderate')
    expect(setup.setupQuality.score).toBeLessThan(75)
  })
})

describe('E — sweep + displacement + retracement + confirmation', () => {
  it('grades the completed confluence setup strong', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, ...leg, ...pullback, engulf])
    const analysis = analyze(candles)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.retracement?.enteredZone).toBe(true)
    expect(setup.retracement?.reaction).toBe('held')
    expect(setup.confirmation).not.toBeNull()
    expect(setup.confirmation!.kind).toBe('engulfing')
    expect(setup.confirmation!.direction).toBe('long')
    expect(setup.setupQuality.family).toBe('confluence')
    expect(setup.setupQuality.level).toBe('strong')
    expect(setup.setupQuality.score).toBeGreaterThanOrEqual(75)
    expect(setup.read.toLowerCase()).toContain('strong')
  })

  it('the engulfing candle is detected deterministically', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, ...leg, ...pullback, engulf])
    const atr = analyze(candles).atr
    const confirmation = detectConfirmation(candles, atr, 'long', 2413, { allowReclaim: false })
    expect(confirmation?.kind).toBe('engulfing')
    expect(confirmation?.candleIndex).toBe(candles.length - 1)
  })
})

/* ------------------------------------------------------------------ */
/* Buy-side sweep → short setup direction                              */
/* ------------------------------------------------------------------ */

describe('buy-side sweep maps to a short setup', () => {
  it('an equal-high pool swept and returned reads SHORT', () => {
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

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.sweep).not.toBeNull()
    expect(setup.sweep!.direction).toBe('short')
    expect(setup.sweep!.returned).toBe(true)
    expect(Math.round(setup.sweep!.levelPrice!)).toBe(2406)
    expect(setup.displacement).toBeNull()
    expect(setup.setupQuality.family).toBe('liquidity_sweep')
    expect(setup.setupQuality.level).toBe('moderate')
  })
})

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

describe('detectDisplacement', () => {
  it('returns null on choppy, wicky data', () => {
    const candles = series([...prelude, dip, ...recovery])
    const analysis = analyze(candles)
    expect(detectDisplacement(candles, analysis.atr)).toBeNull()
  })

  it('measures the strongest leg with real evidence on the fixture leg', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, ...leg])
    const atr = analyze(candles).atr
    const displacement = detectDisplacement(candles, atr)
    expect(displacement).not.toBeNull()
    expect(displacement!.direction).toBe('up')
    expect(displacement!.evidence.rangeExpansion).toBeGreaterThanOrEqual(1.6)
    expect(displacement!.evidence.bodyRatio).toBeGreaterThanOrEqual(0.55)
    expect(displacement!.evidence.directionalConsistency).toBeGreaterThanOrEqual(0.5)
    expect(displacement!.strength).toBeGreaterThanOrEqual(70)
  })
})

describe('detectRetracement', () => {
  it('measures the pullback into the zone on the E fixture', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, ...leg, ...pullback, engulf])
    const analysis = analyze(candles)
    const displacement = detectDisplacement(candles, analysis.atr)!
    const retracement = detectRetracement(candles, analysis.atr, displacement)
    expect(retracement).not.toBeNull()
    expect(retracement!.enteredZone).toBe(true)
    expect(retracement!.depthPercent).toBeGreaterThanOrEqual(0.382)
    expect(retracement!.depthPercent).toBeLessThanOrEqual(0.8)
    expect(retracement!.reaction).toBe('held')
  })

  it('returns null when there are no candles after the displacement', () => {
    const candles = series([...prelude, dip, ...recovery, sweepCandle, ...leg])
    const analysis = analyze(candles)
    const displacement = detectDisplacement(candles, analysis.atr)!
    expect(detectRetracement(candles, analysis.atr, displacement)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Real Twelve Data payload smoke test                                 */
/* ------------------------------------------------------------------ */

describe('real Twelve Data XAU/USD payload', () => {
  it('produces a coherent setup read end-to-end (parse → engine → intelligence)', () => {
    // Twelve Data datetime format "2026-08-01 10:00:00" (UTC). Unique
    // (day, hour) pairs so every candle has a distinct timestamp.
    const values = Array.from({ length: 60 }, (_, index) => [
      `2026-08-${String((index % 9) + 1).padStart(2, '0')} 1${index % 10}:00:00`,
      4000 + index,
      4000 + index + 5,
      4000 + index - 5,
      4000 + index + 1,
    ] as [string, number, number, number, number, number?])
    const payload = {
      meta: { symbol: 'XAU/USD', interval: '1h', type: 'Forex' },
      status: 'ok',
      values: values.map(([datetime, open, high, low, close]) => ({
        datetime,
        open: String(open),
        high: String(high),
        low: String(low),
        close: String(close),
      })),
    }
    const candles = parseTimeSeriesPayload(payload)
    expect(candles.length).toBe(60)

    const analysis = analyzeTimeframe(candles, candles[candles.length - 1].close, '1H', '1h')
    expect(analysis.insufficient).toBe(false)

    const setup = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(setup.status).toBe('ready')
    expect(['none', 'weak', 'moderate', 'strong']).toContain(setup.setupQuality.level)
    expect(setup.read.length).toBeGreaterThan(0)
    // The read is deterministic — same candles, same output.
    const again = assessSetupIntelligence(analysis, candles, 'XAU/USD')
    expect(again.setupQuality).toEqual(setup.setupQuality)
    expect(again.read).toBe(setup.read)
  })
})
