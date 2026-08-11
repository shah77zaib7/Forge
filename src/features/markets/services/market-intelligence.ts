/**
 * Forge Market Intelligence Engine — deterministic price-action analysis
 * over real OHLC candle data. No AI, no seeded randomness, no fabricated
 * numbers: every value derives from the candles fed in, and windows with
 * too little data return an honest insufficient_data instead of a guess.
 *
 * Data flow:
 *
 *   REAL OHLC CANDLES (services/history.ts)
 *        ↓
 *   MARKET INTELLIGENCE ENGINE  ← this module (pure, asset-agnostic)
 *        ↓
 *   STRUCTURED MARKET FACTS
 *        ↓
 *   Liquidity Snapshot / Market Status / (Oracle — next phase)
 *
 * Terminology: a detected level is a "Liquidity Candidate", never a claim
 * of guaranteed liquidity. Buy-side candidates sit above price (significant
 * swing/equal/range/previous-period highs); sell-side candidates sit below
 * (the mirror image from lows). Support and resistance are a separate
 * concept derived from structural reaction levels.
 */

import type { Candle } from './history'

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type LiquiditySide = 'buy' | 'sell'
export type TrendState = 'bullish' | 'bearish' | 'sideways'

/**
 * Transparency tier — how significant a level is relative to the rest of
 * the window. Not a probability: a deterministic score bucket used to tell
 * weak noise from structural pools.
 */
export type LiquidityRank = 'high' | 'medium' | 'low'

/**
 * A Forge Liquidity Zone — a price pool where liquidity is likely to rest,
 * derived from real candle structure (swing/equal/range/previous-period
 * extremes). Buy-side zones sit above price; sell-side zones below.
 */
export interface LiquidityCandidate {
  /** Primary (extreme) price of the pool. */
  price: number
  /** 'buy' = above price (buy-side pool); 'sell' = below price. */
  side: LiquiditySide
  /** e.g. 'swing_high' | 'equal_high' | 'range_high' | 'previous_4h_high' */
  source: string
  /** Window id this level was detected on. */
  timeframe: string
  /** Deterministic 0..1 confidence — significance + touches + recency. */
  strength: number
  /** Absolute distance from the current price, in percent. */
  distancePercent: number
  /** Price has already traded through the level since it formed. */
  swept: boolean
  /** How many times the level has been tested. */
  touches: number
  /** Transparent significance tier from strength + touches + sweep state. */
  rank: LiquidityRank
  /** Zone band — every swing clustered into this pool sits within [zoneLow, zoneHigh]. */
  zoneLow: number
  zoneHigh: number
  /** Epoch ms of the candle where the zone first formed. */
  createdAt: number
  /** Epoch ms of the candle that traded through the zone (null if not swept). */
  sweptAt: number | null
  /** Price traded back through the level after the sweep (liquidity grab). */
  returned: boolean
}

/** One deterministic sweep event — price trading THROUGH a known zone. */
export interface SweepRecord {
  /** Stable zone id (side + price + timeframe). */
  zoneId: string
  side: LiquiditySide
  /** Direction of the trade-through relative to the zone. */
  direction: 'up' | 'down'
  /** Price traded through the zone. */
  sweepPrice: number
  /** Epoch ms of the candle that swept the zone. */
  sweptAt: number
  timeframe: string
  /** Price subsequently closed back through the level (grab-and-return). */
  returned: boolean
}

/** Development-friendly transparency — exactly what the engine consumed. */
export interface LiquidityDiagnostics {
  candleCount: number
  granularity: string
  firstCandleAt: number
  lastCandleAt: number
  swingHighs: number
  swingLows: number
  equalHighZones: number
  equalLowZones: number
  activeZones: number
  sweptZones: number
}

export interface LevelCandidate {
  price: number
  kind: 'support' | 'resistance'
  source: string
  strength: number
  touches: number
  distancePercent: number
}

export interface StructureResult {
  trend: TrendState
  /** Human label for the status cell, e.g. 'Higher Highs'. */
  label: 'Higher Highs' | 'Higher Lows' | 'Lower Highs' | 'Lower Lows' | 'Range Bound'
  hh: number
  hl: number
  lh: number
  ll: number
  swingCount: number
}

export interface MomentumResult {
  state: 'strong' | 'moderate' | 'weak'
  direction: 'up' | 'down' | 'flat'
  /** Linear-regression slope of recent closes, normalized by ATR. */
  score: number
}

export interface TimeframeAnalysis {
  timeframe: string
  /** Honest label of the candle series actually analyzed (e.g. '30m'). */
  candleGranularity: string
  candleCount: number
  currentPrice: number
  atr: number
  liquidity: { buySide: LiquidityCandidate[]; sellSide: LiquidityCandidate[] }
  /** Every detected sweep event across both sides of this window. */
  sweeps: SweepRecord[]
  /** Full transparency view — candle counts, swing counts, zone stats. */
  diagnostics: LiquidityDiagnostics
  support: LevelCandidate[]
  resistance: LevelCandidate[]
  structure: StructureResult | null
  momentum: MomentumResult | null
  /** Epoch ms when the analysis was computed. */
  computedAt: number
  insufficient: boolean
  reason?: 'insufficient_history' | 'invalid_data' | 'provider_unsupported' | 'unsupported_window'
}

/* ------------------------------------------------------------------ */
/* Tunables — kept modular so thresholds can be refined later.         */
/* ------------------------------------------------------------------ */

export interface IntelligenceOptions {
  /** Wilder ATR period. */
  atrPeriod: number
  /** Fractal width (candles each side) for swing detection. */
  swingStrength: number
  /** Minimum pivot deviation from its neighbors, in ATR multiples. */
  minSwingAtp: number
  /** Merge equal highs/lows within this ATR multiple. */
  equalToleranceAtp: number
  /** Fewest candles to attempt any analysis. */
  minCandles: number
  /** Max candidates returned per liquidity side. */
  maxCandidatesPerSide: number
  /** Closes used for the momentum regression. */
  momentumLookback: number
}

const DEFAULTS: IntelligenceOptions = {
  atrPeriod: 14,
  swingStrength: 2,
  minSwingAtp: 0.25,
  equalToleranceAtp: 0.45,
  minCandles: 14,
  maxCandidatesPerSide: 4,
  momentumLookback: 20,
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Wilder-smoothed Average True Range over the full series. */
export function atrValue(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0
  const trues: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]
    const p = candles[i - 1]
    trues.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)))
  }
  let average = trues.slice(0, period).reduce((sum, value) => sum + value, 0) / period
  for (let i = period; i < trues.length; i++) {
    average = (average * (period - 1) + trues[i]) / period
  }
  return average
}

interface Pivot {
  index: number
  kind: 'high' | 'low'
  price: number
  /** Deviation from surrounding candles, in ATR multiples. */
  deviationAtp: number
}

/**
 * Fractal swing detection with significance filtering: a pivot must be the
 * strict extreme of `swingStrength` candles on each side AND deviate from
 * its neighbors by at least `minSwingAtp` × ATR. Tiny noise candles are
 * never treated as liquidity.
 */
export function findPivots(candles: Candle[], atr: number, options: IntelligenceOptions): Pivot[] {
  const k = options.swingStrength
  const pivots: Pivot[] = []
  for (let i = k; i < candles.length - k; i++) {
    const high = candles[i].high
    let isHigh = true
    for (let j = 1; j <= k; j++) {
      if (high <= candles[i - j].high || high <= candles[i + j].high) {
        isHigh = false
        break
      }
    }
    if (isHigh) {
      let neighborSum = 0
      for (let j = 1; j <= k; j++) neighborSum += candles[i - j].high + candles[i + j].high
      const reference = neighborSum / (2 * k)
      const deviationAtp = (high - reference) / atr
      if (deviationAtp >= options.minSwingAtp) {
        pivots.push({ index: i, kind: 'high', price: high, deviationAtp })
      }
    }

    const low = candles[i].low
    let isLow = true
    for (let j = 1; j <= k; j++) {
      if (low >= candles[i - j].low || low >= candles[i + j].low) {
        isLow = false
        break
      }
    }
    if (isLow) {
      let neighborSum = 0
      for (let j = 1; j <= k; j++) neighborSum += candles[i - j].low + candles[i + j].low
      const reference = neighborSum / (2 * k)
      const deviationAtp = (reference - low) / atr
      if (deviationAtp >= options.minSwingAtp) {
        pivots.push({ index: i, kind: 'low', price: low, deviationAtp })
      }
    }
  }
  return pivots
}

/** Linear-regression slope of the trailing closes, normalized by ATR. */
export function momentumScore(candles: Candle[], atr: number, lookback: number): number | null {
  if (candles.length < 10 || atr <= 0) return null
  const closes = candles.slice(-lookback).map((c) => c.close)
  const n = closes.length
  const xMean = (n - 1) / 2
  const yMean = closes.reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (closes[i] - yMean)
    denominator += (i - xMean) * (i - xMean)
  }
  if (denominator === 0) return null
  return (numerator / denominator) / atr
}

/* ------------------------------------------------------------------ */
/* Structure — HH / HL / LH / LL from the pivot sequence               */
/* ------------------------------------------------------------------ */

function structureLabel(trend: TrendState, hh: number, hl: number, lh: number, ll: number): StructureResult['label'] {
  if (trend === 'bullish') return hh >= hl ? 'Higher Highs' : 'Higher Lows'
  if (trend === 'bearish') return lh >= ll ? 'Lower Highs' : 'Lower Lows'
  return 'Range Bound'
}

export function analyzeStructure(pivots: Pivot[]): StructureResult | null {
  const highs = pivots.filter((p) => p.kind === 'high').map((p) => p.price)
  const lows = pivots.filter((p) => p.kind === 'low').map((p) => p.price)
  // Need at least two comparable highs AND two comparable lows.
  if (highs.length < 2 || lows.length < 2) return null

  const tail = 4
  let hh = 0
  let lh = 0
  let hl = 0
  let ll = 0
  for (let i = Math.max(1, highs.length - tail); i < highs.length; i++) {
    if (highs[i] > highs[i - 1]) hh += 1
    else lh += 1
  }
  for (let i = Math.max(1, lows.length - tail); i < lows.length; i++) {
    if (lows[i] > lows[i - 1]) hl += 1
    else ll += 1
  }

  // Latest comparison decides ties — the freshest confirmation wins.
  const lastHighUp = highs[highs.length - 1] > highs[highs.length - 2]
  const lastLowUp = lows[lows.length - 1] > lows[lows.length - 2]
  const bullish = hh + hl > lh + ll || (hh + hl === lh + ll && (lastHighUp || lastLowUp))
  const bearish = lh + ll > hh + hl || (hh + hl === lh + ll && !lastHighUp && !lastLowUp)
  const trend: TrendState = bullish ? 'bullish' : bearish ? 'bearish' : 'sideways'

  return {
    trend,
    label: structureLabel(trend, hh, hl, lh, ll),
    hh,
    hl,
    lh,
    ll,
    swingCount: pivots.length,
  }
}

/* ------------------------------------------------------------------ */
/* Liquidity candidates                                                */
/* ------------------------------------------------------------------ */

interface RawLevel {
  price: number
  kind: 'high' | 'low'
  source: string
  /** Candle index where the level originated (sweep detection anchor). */
  origin: number
  deviationAtp: number
  touches: number
  /** Cluster band — all pooled swings sit within [zoneLow, zoneHigh]. */
  zoneLow: number
  zoneHigh: number
}

function strengthScore(deviationAtp: number, touches: number, recent: boolean, distancePercent: number): number {
  const magnitude = clamp(deviationAtp / 2.5, 0, 1) * 0.5
  const touchBonus = Math.min(Math.max(touches - 1, 0), 3) * 0.12
  const recency = recent ? 0.12 : 0.04
  const proximity = clamp(1 - distancePercent / 6, 0, 1) * 0.1
  return clamp(magnitude + touchBonus + recency + proximity, 0.05, 1)
}

/** Merge pivot extremes that sit within tolerance into equal-high/low pools. */
function mergeEqualLevels(
  pivots: Pivot[],
  atr: number,
  options: IntelligenceOptions,
  kind: 'high' | 'low',
): RawLevel[] {
  const filtered = pivots
    .filter((p) => p.kind === kind)
    .slice()
    .sort((a, b) => (kind === 'high' ? b.price - a.price : a.price - b.price))
  const levels: RawLevel[] = []
  const tolerance = options.equalToleranceAtp * atr
  for (const pivot of filtered) {
    const existing = levels.find((level) => Math.abs(level.price - pivot.price) <= tolerance)
    if (existing) {
      // A pool sits at its extreme — the highest high / lowest low — and the
      // cluster band widens to cover every swing that joined it.
      existing.price = kind === 'high' ? Math.max(existing.price, pivot.price) : Math.min(existing.price, pivot.price)
      existing.zoneHigh = Math.max(existing.zoneHigh, pivot.price)
      existing.zoneLow = Math.min(existing.zoneLow, pivot.price)
      existing.touches += 1
      existing.deviationAtp = Math.max(existing.deviationAtp, pivot.deviationAtp)
    } else {
      levels.push({
        price: pivot.price,
        kind,
        source: kind === 'high' ? 'swing_high' : 'swing_low',
        origin: pivot.index,
        deviationAtp: pivot.deviationAtp,
        touches: 1,
        zoneLow: pivot.price,
        zoneHigh: pivot.price,
      })
    }
  }
  return levels
}

/**
 * Merge levels that coincide across sources (e.g. a swing high at the same
 * price as the previous period high) so one level survives with combined
 * touches and the more descriptive source.
 */
function consolidateLevels(levels: RawLevel[], atr: number, options: IntelligenceOptions): RawLevel[] {
  const tolerance = options.equalToleranceAtp * atr
  // Most descriptive source wins when levels coincide: previous-period and
  // range extremes tell more than a generic swing/equal label.
  const sourceRank = (source: string): number =>
    source.startsWith('previous_') ? 3 : source.startsWith('range_') ? 2 : source.startsWith('equal_') ? 1 : 0
  const result: RawLevel[] = []
  for (const level of levels) {
    const existing = result.find((candidate) => Math.abs(candidate.price - level.price) <= tolerance)
    if (existing) {
      existing.touches += level.touches
      existing.deviationAtp = Math.max(existing.deviationAtp, level.deviationAtp)
      existing.origin = Math.min(existing.origin, level.origin)
      existing.zoneHigh = Math.max(existing.zoneHigh, level.zoneHigh)
      existing.zoneLow = Math.min(existing.zoneLow, level.zoneLow)
      if (sourceRank(level.source) > sourceRank(existing.source)) existing.source = level.source
    } else {
      result.push({ ...level })
    }
  }
  return result
}

/**
 * Transparent rank tier. Swept levels are spent (never rank high); among the
 * rest, strength (significance + recency + proximity) decides, with a
 * cluster of 2+ touches bumping a borderline level up a tier.
 */
function rankOf(strength: number, swept: boolean, touches: number): LiquidityRank {
  if (swept) return strength > 0.6 ? 'medium' : 'low'
  if (strength >= 0.6) return 'high'
  if (strength >= 0.3) return 'medium'
  if (touches >= 2) return 'medium'
  return 'low'
}

/**
 * Build the Liquidity Zones for one side. A zone is a price pool whose band
 * spans every swing clustered into it; sweeps are recorded when a later
 * candle trades THROUGH the zone (not merely touches it), noting whether
 * price subsequently closed back through the level (liquidity grab).
 */
function buildZones(
  candles: Candle[],
  levels: RawLevel[],
  price: number,
  side: LiquiditySide,
  timeframe: string,
  recentCutoff: number,
  max: number,
  sweeps: SweepRecord[],
): LiquidityCandidate[] {
  const zones: LiquidityCandidate[] = []
  for (const level of levels) {
    // Buy-side pools sit above price, sell-side below.
    if (side === 'buy' && level.price <= price) continue
    if (side === 'sell' && level.price >= price) continue

    const distancePercent = (Math.abs(level.price - price) / price) * 100

    // Sweep detection: a candle trades through the zone's far edge (high
    // above a buy zone, low below a sell zone). Not a mere touch.
    let swept = false
    let sweptAt: number | null = null
    let returned = false
    for (let i = level.origin + 1; i < candles.length; i++) {
      const traded = side === 'buy' ? candles[i].high >= level.zoneHigh : candles[i].low <= level.zoneLow
      if (!traded) continue
      swept = true
      sweptAt = candles[i].timestamp
      // Returned: a candle after the sweep closes back through the primary
      // level — the classic grab-and-return signature.
      for (let j = i + 1; j < candles.length; j++) {
        const back = side === 'buy' ? candles[j].close <= level.price : candles[j].close >= level.price
        if (back) {
          returned = true
          break
        }
      }
      sweeps.push({
        zoneId: `${side}_${Math.round(level.price)}_${timeframe}`,
        side,
        direction: side === 'buy' ? 'up' : 'down',
        sweepPrice: candles[i][side === 'buy' ? 'high' : 'low'],
        sweptAt: candles[i].timestamp,
        timeframe,
        returned,
      })
      break
    }

    // Equal pools only when multiple swings cluster; other sources (range,
    // previous period) keep their own honest labels.
    const source =
      level.touches > 1 && level.source.startsWith('swing_')
        ? level.source === 'swing_high'
          ? 'equal_high'
          : 'equal_low'
        : level.source
    const strength = strengthScore(level.deviationAtp, level.touches, level.origin >= recentCutoff, distancePercent)
    zones.push({
      price: level.price,
      side,
      source,
      timeframe,
      strength,
      distancePercent: Math.round(distancePercent * 100) / 100,
      swept,
      touches: level.touches,
      rank: rankOf(strength, swept, level.touches),
      zoneLow: level.zoneLow,
      zoneHigh: level.zoneHigh,
      createdAt: candles[level.origin]?.timestamp ?? 0,
      sweptAt,
      returned,
    })
  }

  // Nearest first, then strongest — the nearest pool is what price hits next.
  zones.sort((a, b) => a.distancePercent - b.distancePercent || b.strength - a.strength)
  return zones.slice(0, max)
}

/* ------------------------------------------------------------------ */
/* Support / resistance — structural reaction levels, separate from     */
/* liquidity: repeated tested lows/highs where price actually held.     */
/* ------------------------------------------------------------------ */

function buildSupportResistance(
  candles: Candle[],
  pivots: Pivot[],
  atr: number,
  price: number,
  options: IntelligenceOptions,
): { support: LevelCandidate[]; resistance: LevelCandidate[] } {
  const tolerance = options.equalToleranceAtp * atr

  const reactionLevels = (kind: 'high' | 'low') => {
    const filtered = pivots
      .filter((p) => p.kind === kind)
      .slice()
      .sort((a, b) => (kind === 'high' ? b.price - a.price : a.price - b.price))
    const merged: Array<{ price: number; origin: number; deviationAtp: number; touches: number }> = []
    for (const pivot of filtered) {
      const existing = merged.find((level) => Math.abs(level.price - pivot.price) <= tolerance)
      if (existing) {
        existing.touches += 1
        existing.deviationAtp = Math.max(existing.deviationAtp, pivot.deviationAtp)
      } else {
        merged.push({ price: pivot.price, origin: pivot.index, deviationAtp: pivot.deviationAtp, touches: 1 })
      }
    }
    return merged
  }

  const supports = reactionLevels('low')
    .filter((level) => level.price < price)
    .map((level) => {
      const distancePercent = ((price - level.price) / price) * 100
      // A broken (swept) level is weaker support — it already gave way.
      const swept = candles.slice(level.origin + 1).some((c) => c.low <= level.price)
      const magnitude = clamp(level.deviationAtp / 2.5, 0, 1) * 0.45
      const touchBonus = Math.min(Math.max(level.touches - 1, 0), 3) * 0.18
      const proximity = clamp(1 - distancePercent / 6, 0, 1) * 0.12
      const sweepPenalty = swept ? 0.15 : 0
      return {
        price: level.price,
        kind: 'support' as const,
        source: level.touches > 1 ? 'reaction_low' : 'swing_low',
        strength: clamp(magnitude + touchBonus + proximity - sweepPenalty, 0.05, 1),
        touches: level.touches,
        distancePercent: Math.round(distancePercent * 100) / 100,
      }
    })
    .sort((a, b) => b.strength - a.strength || a.distancePercent - b.distancePercent)
    .slice(0, options.maxCandidatesPerSide)

  const resistances = reactionLevels('high')
    .filter((level) => level.price > price)
    .map((level) => {
      const distancePercent = ((level.price - price) / price) * 100
      const swept = candles.slice(level.origin + 1).some((c) => c.high >= level.price)
      const magnitude = clamp(level.deviationAtp / 2.5, 0, 1) * 0.45
      const touchBonus = Math.min(Math.max(level.touches - 1, 0), 3) * 0.18
      const proximity = clamp(1 - distancePercent / 6, 0, 1) * 0.12
      const sweepPenalty = swept ? 0.15 : 0
      return {
        price: level.price,
        kind: 'resistance' as const,
        source: level.touches > 1 ? 'reaction_high' : 'swing_high',
        strength: clamp(magnitude + touchBonus + proximity - sweepPenalty, 0.05, 1),
        touches: level.touches,
        distancePercent: Math.round(distancePercent * 100) / 100,
      }
    })
    .sort((a, b) => b.strength - a.strength || a.distancePercent - b.distancePercent)
    .slice(0, options.maxCandidatesPerSide)

  return { support: supports, resistance: resistances }
}

/* ------------------------------------------------------------------ */
/* Per-timeframe analysis                                              */
/* ------------------------------------------------------------------ */

/**
 * Analyze one candle series into the full market-facts snapshot. Pure and
 * deterministic — same candles + price always produce the same result.
 */
export function analyzeTimeframe(
  candles: Candle[],
  currentPrice: number,
  timeframe: string,
  candleGranularity: string,
  options: Partial<IntelligenceOptions> = {},
): TimeframeAnalysis {
  const opts: IntelligenceOptions = { ...DEFAULTS, ...options }
  const computedAt = Date.now()

  const base: TimeframeAnalysis = {
    timeframe,
    candleGranularity,
    candleCount: candles.length,
    currentPrice,
    atr: 0,
    liquidity: { buySide: [], sellSide: [] },
    sweeps: [],
    diagnostics: {
      candleCount: candles.length,
      granularity: candleGranularity,
      firstCandleAt: candles[0]?.timestamp ?? 0,
      lastCandleAt: candles[candles.length - 1]?.timestamp ?? 0,
      swingHighs: 0,
      swingLows: 0,
      equalHighZones: 0,
      equalLowZones: 0,
      activeZones: 0,
      sweptZones: 0,
    },
    support: [],
    resistance: [],
    structure: null,
    momentum: null,
    computedAt,
    insufficient: true,
  }

  if (!candles || candles.length < opts.minCandles) {
    return { ...base, reason: 'insufficient_history' }
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { ...base, reason: 'invalid_data' }
  }

  const atr = atrValue(candles, opts.atrPeriod)
  if (!Number.isFinite(atr) || atr <= 0) {
    return { ...base, reason: 'invalid_data' }
  }

  const pivots = findPivots(candles, atr, opts)
  const recentCutoff = candles.length - Math.max(8, candles.length / 3)

  // Range and previous-period extremes feed the liquidity model too.
  let rangeHighIndex = 0
  let rangeLowIndex = 0
  let rangeHighPrice = candles[0].high
  let rangeLowPrice = candles[0].low
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].high > rangeHighPrice) {
      rangeHighPrice = candles[i].high
      rangeHighIndex = i
    }
    if (candles[i].low < rangeLowPrice) {
      rangeLowPrice = candles[i].low
      rangeLowIndex = i
    }
  }
  const rangeHigh: RawLevel = {
    price: rangeHighPrice,
    kind: 'high',
    source: 'range_high',
    origin: rangeHighIndex,
    deviationAtp: 1.5,
    touches: 1,
    zoneLow: rangeHighPrice,
    zoneHigh: rangeHighPrice,
  }
  const rangeLow: RawLevel = {
    price: rangeLowPrice,
    kind: 'low',
    source: 'range_low',
    origin: rangeLowIndex,
    deviationAtp: 1.5,
    touches: 1,
    zoneLow: rangeLowPrice,
    zoneHigh: rangeLowPrice,
  }
  // Previous fully-closed period extreme — the last completed candle.
  const previous: RawLevel | null =
    candles.length >= 2
      ? {
          price: candles[candles.length - 2].high,
          kind: 'high',
          source: `previous_${candleGranularity}_high`,
          origin: candles.length - 2,
          deviationAtp: 0.6,
          touches: 1,
          zoneLow: candles[candles.length - 2].high,
          zoneHigh: candles[candles.length - 2].high,
        }
      : null
  const previousLow: RawLevel | null =
    candles.length >= 2
      ? {
          price: candles[candles.length - 2].low,
          kind: 'low',
          source: `previous_${candleGranularity}_low`,
          origin: candles.length - 2,
          deviationAtp: 0.6,
          touches: 1,
          zoneLow: candles[candles.length - 2].low,
          zoneHigh: candles[candles.length - 2].low,
        }
      : null

  const highLevels = consolidateLevels(
    [...mergeEqualLevels(pivots, atr, opts, 'high'), rangeHigh, ...(previous ? [previous] : [])],
    atr,
    opts,
  )
  const lowLevels = consolidateLevels(
    [...mergeEqualLevels(pivots, atr, opts, 'low'), rangeLow, ...(previousLow ? [previousLow] : [])],
    atr,
    opts,
  )

  const sweeps: SweepRecord[] = []
  const buySide = buildZones(candles, highLevels, currentPrice, 'buy', timeframe, recentCutoff, opts.maxCandidatesPerSide, sweeps)
  const sellSide = buildZones(candles, lowLevels, currentPrice, 'sell', timeframe, recentCutoff, opts.maxCandidatesPerSide, sweeps)
  const liquidity = { buySide, sellSide }
  const { support, resistance } = buildSupportResistance(candles, pivots, atr, currentPrice, opts)
  const structure = analyzeStructure(pivots)
  const momentumRaw = momentumScore(candles, atr, opts.momentumLookback)
  const momentum: MomentumResult | null =
    momentumRaw === null
      ? null
      : {
          state: Math.abs(momentumRaw) > 0.3 ? 'strong' : Math.abs(momentumRaw) > 0.1 ? 'moderate' : 'weak',
          direction: momentumRaw > 0.05 ? 'up' : momentumRaw < -0.05 ? 'down' : 'flat',
          score: Math.round(momentumRaw * 100) / 100,
        }

  return {
    ...base,
    atr,
    liquidity,
    sweeps: sweeps.sort((a, b) => a.sweptAt - b.sweptAt),
    diagnostics: {
      candleCount: candles.length,
      granularity: candleGranularity,
      firstCandleAt: candles[0]?.timestamp ?? 0,
      lastCandleAt: candles[candles.length - 1]?.timestamp ?? 0,
      swingHighs: pivots.filter((p) => p.kind === 'high').length,
      swingLows: pivots.filter((p) => p.kind === 'low').length,
      equalHighZones: buySide.filter((z) => z.source === 'equal_high').length,
      equalLowZones: sellSide.filter((z) => z.source === 'equal_low').length,
      activeZones: buySide.filter((z) => !z.swept).length + sellSide.filter((z) => !z.swept).length,
      sweptZones: buySide.filter((z) => z.swept).length + sellSide.filter((z) => z.swept).length,
    },
    support,
    resistance,
    structure,
    momentum,
    insufficient: false,
  }
}

/**
 * Multi-timeframe read — analyzes each provided window independently and
 * returns one result per window. Timeframes are never merged into a single
 * trend: each window keeps its own structure read (Oracle consumes this
 * per-window in the next phase).
 */
export function analyzeWindows(
  windows: Array<{ timeframe: string; candles: Candle[]; granularity: string; price: number }>,
  options?: Partial<IntelligenceOptions>,
): Record<string, TimeframeAnalysis> {
  const results: Record<string, TimeframeAnalysis> = {}
  for (const window of windows) {
    results[window.timeframe] = analyzeTimeframe(window.candles, window.price, window.timeframe, window.granularity, options)
  }
  return results
}
