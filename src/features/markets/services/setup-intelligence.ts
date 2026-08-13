/**
 * Forge Setup Intelligence — the deterministic interpretation layer on top
 * of the Forge Liquidity Model. It reads the engine's TimeframeAnalysis
 * (real zones, real sweeps, structure) plus the raw candles and decides, in
 * plain measurable terms, whether the trader's two setup families are
 * present on the current window:
 *
 *   LIQUIDITY SWEEP SETUP    a detected level is swept → price reclaims /
 *                            rejects it → confirmation
 *   DISPLACEMENT SETUP       an unusually strong directional leg forms →
 *                            price retraces into the displacement zone →
 *                            confirmation
 *
 * These families are INDEPENDENT. A displacement setup does NOT require a
 * prior liquidity sweep, and a sweep setup does NOT require displacement.
 * When both occur together the setup is classified 'confluence' — higher
 * confluence, never a guarantee.
 *
 * No AI, no seeded randomness, no probabilities of success. Every field is a
 * deterministic measurement of the candles fed in, and missing evidence is
 * reported as missing rather than invented. The structured output is what
 * Oracle (next phase) will consume and explain in natural language.
 *
 * Data flow:
 *   REAL OHLC + TimeframeAnalysis (market-intelligence.ts)
 *        ↓
 *   SETUP INTELLIGENCE  ← this module (pure, asset-agnostic)
 *        ↓
 *   Setup quality / evidence / read → Workspace UI → (Oracle, next phase)
 */

import type { Candle } from './history'
import { atrValue } from './market-intelligence'
import type {
  LiquidityCandidate,
  SweepRecord,
  TimeframeAnalysis,
  TrendState,
} from './market-intelligence'
import { evaluateContext, type ContextRead } from './forge-v2/context'

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type SetupDirection = 'long' | 'short'
export type SetupFamily = 'liquidity_sweep' | 'displacement' | 'confluence' | 'none'
export type SetupLevel = 'strong' | 'moderate' | 'weak' | 'none'

/** Measurable evidence behind a displacement — never an opinion. */
export interface DisplacementEvidence {
  /** Strongest candle range ÷ ATR — how much the move expanded. */
  rangeExpansion: number
  /** Strongest candle body ÷ its own range (0..1) — a real body, not wicks. */
  bodyRatio: number
  /** Net move ÷ total range of the leg (0..1) — how consistently it ran. */
  directionalConsistency: number
}

export interface Displacement {
  direction: 'up' | 'down'
  /** Deterministic 0..100 strength from the evidence. */
  strength: number
  evidence: DisplacementEvidence
  /** Candle indices of the leg in the series. */
  startIndex: number
  endIndex: number
  startPrice: number
  endPrice: number
  /** Net move as a percent of the leg's open. */
  movePercent: number
  /** Price span of the leg — the displacement zone retracements refer to. */
  zoneLow: number
  zoneHigh: number
}

export interface Retracement {
  found: boolean
  /** Fraction of the displacement move retraced (0.382+ = into the zone). */
  depthPercent: number
  /** Extreme price the retracement reached. */
  retracementPrice: number
  retracementIndex: number
  /** Retraced at least 38.2% of the displacement move. */
  enteredZone: boolean
  /** What price did after retracing: held the zone / broke it / nothing yet. */
  reaction: 'held' | 'broke' | 'none'
  /** True when the retracement exceeded the configured maximum depth. */
  overRetraced: boolean
}

export type ConfirmationKind = 'engulfing' | 'rejection' | 'continuation' | 'structure_reclaim'

export interface Confirmation {
  kind: ConfirmationKind
  direction: SetupDirection
  candleIndex: number
  /** Human-readable description of the deterministic trigger. */
  description: string
}

/** The liquidity-sweep read — derived from the engine's SweepRecords. */
export interface SweepRead {
  present: boolean
  /** Sweep happened within the recent window (an actionable setup needs it). */
  recent: boolean
  /** Setup direction implied by the sweep (buy-side swept → short, etc.). */
  direction: SetupDirection | null
  /** Price of the swept level (matched back to its Liquidity Zone). */
  levelPrice: number | null
  /** Zone source label, e.g. 'equal_low' — when the zone is still visible. */
  levelSource: string | null
  /** Zone rank (high/medium/low) when visible. */
  rank: string | null
  /** Price traded back through the level after the sweep (grab-and-return). */
  returned: boolean
  /** Epoch ms of the sweep candle. */
  sweptAt: number | null
  /** Number of distinct sweeps within the recent window. */
  sweepCount: number
  /** True when penetration beyond the level exceeded the configured maximum. */
  overExtended: boolean
}

/**
 * The six traceable score contributions. Sum of the contributions (+ any
 * confluence bonus) equals the final setup score — every point is explainable.
 */
export interface ScoreContributions {
  liquidity: number
  sweep: number
  displacement: number
  pullback: number
  confirmation: number
  context: number
}

export interface SetupQuality {
  level: SetupLevel
  /** Deterministic 0..100 evidence score — NOT a win probability. */
  score: number
  family: SetupFamily
  /** Each reason is one measurable fact (or explicitly missing evidence). */
  reasons: string[]
  /** Traceable per-group breakdown of the score. */
  contributions: ScoreContributions
  /** Explicitly missing/negative factors (no confirmation, no reclaim…). */
  missing: string[]
  /** Confluence bonus applied (family + points), or null. */
  confluenceBonus: { family: SetupFamily; points: number } | null
  /** True when the no-confirmation cap clamped the score. */
  cappedByNoConfirmation: boolean
}

export interface SetupIntelligence {
  /** Canonical asset id passed by the caller (e.g. 'gold' / 'XAU/USD'). */
  asset: string
  /** Workspace window id, e.g. '1H'. */
  timeframe: string
  currentPrice: number
  trend: TrendState | null
  sweep: SweepRead | null
  displacement: Displacement | null
  retracement: Retracement | null
  confirmation: Confirmation | null
  /** Which candle series produced the confirmation (e.g. '1m'). */
  confirmationTimeframe: string
  setupQuality: SetupQuality
  /** The context-group read (structure, opposing liquidity, volatility). */
  context: ContextRead
  /** One deterministic, human-readable read of the window. */
  read: string
  computedAt: number
  status: 'ready' | 'insufficient'
}

/* ------------------------------------------------------------------ */
/* Tunables — modular so thresholds can be refined per asset later.    */
/* ------------------------------------------------------------------ */

/** Per-kind multipliers for the confirmation score contribution. */
export interface ConfirmationKindWeights {
  engulfing: number
  rejection: number
  continuation: number
  structure_reclaim: number
}

/**
 * Configurable score weights for the seven groups. Defaults reproduce the
 * V1 point math exactly (same conditions earn the same points), organized
 * into traceable group contributions. All values are driven by the V2
 * configuration — changing them changes the score.
 */
export interface ScoreWeights {
  /** Source-based liquidity multipliers applied to the liquidity contribution. */
  liquidity: {
    equalHigh: number
    equalLow: number
    swing: number
    previousDay: number
    range: number
    max: number
  }
  /** Points for a valid recent sweep (sweep family). */
  sweepBase: number
  /** Points when price closed back through the swept level. */
  sweepReclaim: number
  /** Points when market structure aligns (context group). */
  structure: number
  /** Points when a confirmation candle is present. */
  confirmation: number
  /** Points for a qualifying displacement leg. */
  displacementBase: number
  /** Points for a pullback that entered the displacement zone. */
  pullbackBase: number
  /** Points when the pullback reaction held. */
  pullbackHeld: number
  context: {
    opposingLiquidityThreshold: number
    opposingLiquidityBonus: number
    volatilityThresholdAtpPct: number
    volatilityPenalty: number
    conflictingStructurePenalty: number
  }
  /** Bonus when both families are present. */
  confluenceBonus: number
  /** A setup without confirmation can never exceed this. */
  noConfirmationCap: number
}

export interface SetupOptions {
  /** Candles scanned for displacement legs (from the end). */
  lookback: number
  /** Minimum leg length in candles. */
  minLegCandles: number
  /** A leg must move at least this many ATRs net. */
  minNetMoveAtp: number
  /** Strongest candle range ÷ ATR. */
  minRangeExpansion: number
  /** Strongest candle body ÷ its own range. */
  minBodyRatio: number
  /** Net move ÷ total range of the leg. */
  minConsistency: number
  /** An opposite-direction body smaller than this (ATR) still extends a leg. */
  pullbackAtp: number
  /** Candles after a displacement scanned for a retracement. */
  retracementLookahead: number
  /** A retracement must cover at least this fraction of the move to count. */
  minRetracementDepth: number
  /** Beyond this fraction the pullback is over-retraced (weaker). */
  maximumRetracement: number
  /** Candles after the retracement extreme checked for a reaction. */
  reactionCandles: number
  /** Price must stay inside the displacement range for the setup. */
  pullbackStayInZone: boolean
  /** Last candles checked for candle-level confirmations. */
  confirmationCheck: number
  /** A structure-reclaim confirmation must be a FRESH crossing inside this. */
  reclaimLookback: number
  /** Minimum body (ATR) for an engulfing/continuation candle to count. */
  minBodyAtp: number
  /** Wick must exceed this multiple of the body for a rejection. */
  rejectionWickRatio: number
  /** A sweep counts as "recent" when its candle sits in the last N candles. */
  recentSweepCandles: number
  /** Sweep zone-match tolerance (ATR) — penetration beyond the level. */
  sweepPierceAtp: number
  /** Max price distance (ATR) from a sweep to its matched zone. */
  sweepMaxDistanceAtp: number
  /** Minimum penetration (ATR) for a trade-through to count. */
  sweepMinimumPenetrationAtp: number
  /** Penetration beyond this (ATR) reads as over-extended. */
  sweepMaximumPenetrationAtp: number
  /** Wick-only interaction qualifies as a sweep. */
  sweepWickOnlyQualifies: boolean
  /** Price must close back through the level for the reclaim credit. */
  sweepCloseBackThrough: boolean
  /** Label of the confirmation candle series (e.g. '1m'). */
  confirmationTimeframe: string
  /** Per-kind confirmation weights. */
  confirmationKindWeights: ConfirmationKindWeights
  /** Configurable score weights — traceable, V2-driven. */
  scoreWeights: ScoreWeights
  /** Level classification thresholds — driven by the V2 scoring config. */
  scoreThresholds: { strong: number; moderate: number; weak: number }
}

const DEFAULTS: SetupOptions = {
  lookback: 40,
  minLegCandles: 2,
  minNetMoveAtp: 1.2,
  minRangeExpansion: 1.6,
  minBodyRatio: 0.55,
  minConsistency: 0.5,
  pullbackAtp: 0.35,
  retracementLookahead: 20,
  minRetracementDepth: 0.382,
  maximumRetracement: 0.9,
  reactionCandles: 3,
  pullbackStayInZone: true,
  confirmationCheck: 4,
  reclaimLookback: 3,
  minBodyAtp: 0.5,
  rejectionWickRatio: 1.2,
  recentSweepCandles: 15,
  sweepPierceAtp: 0.15,
  sweepMaxDistanceAtp: 2,
  sweepMinimumPenetrationAtp: 0.15,
  sweepMaximumPenetrationAtp: 4,
  sweepWickOnlyQualifies: true,
  sweepCloseBackThrough: true,
  confirmationTimeframe: '1m',
  confirmationKindWeights: {
    engulfing: 1,
    rejection: 1,
    continuation: 1,
    structure_reclaim: 1,
  },
  scoreWeights: {
    liquidity: { equalHigh: 1.15, equalLow: 1.15, swing: 1, previousDay: 1.1, range: 1, max: 12 },
    sweepBase: 19,
    sweepReclaim: 20,
    structure: 10,
    confirmation: 30,
    displacementBase: 20,
    pullbackBase: 15,
    pullbackHeld: 10,
    context: {
      opposingLiquidityThreshold: 4,
      opposingLiquidityBonus: 2,
      volatilityThresholdAtpPct: 0.1,
      // Default off — preserves the V1 point math exactly.
      volatilityPenalty: 0,
      conflictingStructurePenalty: 0,
    },
    confluenceBonus: 5,
    noConfirmationCap: 60,
  },
  scoreThresholds: { strong: 75, moderate: 45, weak: 25 },
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/* ------------------------------------------------------------------ */
/* Displacement — unusually strong directional legs                    */
/* ------------------------------------------------------------------ */

interface Leg {
  candles: Candle[]
  startIndex: number
  direction: 'up' | 'down'
  netMove: number
  totalRange: number
}

/**
 * Split the lookback window into same-direction legs. A small counter candle
 * (body < pullbackAtp × ATR) stays inside the leg — it is noise, not a turn.
 * Indecisive candles (tiny body, no direction) are skipped as anchors.
 */
function splitLegs(candles: Candle[], atr: number, options: SetupOptions): Leg[] {
  const start = Math.max(0, candles.length - options.lookback)
  const legs: Leg[] = []
  let i = start
  while (i < candles.length - 1) {
    if (Math.abs(candles[i].close - candles[i].open) < atr * 0.25) {
      i += 1
      continue
    }
    const direction: 'up' | 'down' = candles[i].close >= candles[i].open ? 'up' : 'down'
    let j = i
    while (j < candles.length - 1) {
      const next = candles[j + 1]
      const nextDir: 'up' | 'down' = next.close >= next.open ? 'up' : 'down'
      if (nextDir === direction) {
        j += 1
        continue
      }
      if (Math.abs(next.close - next.open) < options.pullbackAtp * atr) {
        j += 1
        continue
      }
      break
    }
    legs.push({
      candles: candles.slice(i, j + 1),
      startIndex: i,
      direction,
      netMove: Math.abs(candles[j].close - candles[i].open),
      totalRange: candles.slice(i, j + 1).reduce((sum, candle) => sum + (candle.high - candle.low), 0),
    })
    i = j + 1
  }
  return legs
}

function evaluateLeg(leg: Leg, atr: number, options: SetupOptions): Displacement | null {
  const { candles } = leg
  if (candles.length < options.minLegCandles) return null
  const netMoveAtp = leg.netMove / atr
  if (netMoveAtp < options.minNetMoveAtp) return null

  const strongest = candles.reduce((best, candle) =>
    Math.abs(candle.close - candle.open) > Math.abs(best.close - best.open) ? candle : best,
  )
  const strongestRange = Math.max(strongest.high - strongest.low, 1e-9)
  const rangeExpansion = strongestRange / atr
  const bodyRatio = Math.abs(strongest.close - strongest.open) / strongestRange
  const directionalConsistency = leg.totalRange > 0 ? Math.min(1, leg.netMove / leg.totalRange) : 1

  if (rangeExpansion < options.minRangeExpansion) return null
  if (bodyRatio < options.minBodyRatio) return null
  if (directionalConsistency < options.minConsistency) return null

  const strength = Math.round(
    100 * (
      0.35 * clamp(netMoveAtp / 3, 0, 1) +
      0.3 * clamp((rangeExpansion - 1) / 2, 0, 1) +
      0.35 * directionalConsistency
    ),
  )
  const endIndex = leg.startIndex + candles.length - 1
  return {
    direction: leg.direction,
    strength,
    evidence: {
      rangeExpansion: Math.round(rangeExpansion * 100) / 100,
      bodyRatio: Math.round(bodyRatio * 100) / 100,
      directionalConsistency: Math.round(directionalConsistency * 100) / 100,
    },
    startIndex: leg.startIndex,
    endIndex,
    startPrice: candles[0].open,
    endPrice: candles[candles.length - 1].close,
    movePercent: Math.round((leg.netMove / candles[0].open) * 10000) / 100,
    zoneLow: Math.min(...candles.map((candle) => candle.low)),
    zoneHigh: Math.max(...candles.map((candle) => candle.high)),
  }
}

/**
 * Detect the strongest displacement leg in the recent window. A displacement
 * is a leg that moved at least `minNetMoveAtp` ATRs, whose strongest candle
 * expanded well beyond ATR with a real body, and whose net move covers most
 * of its total range (directional consistency). Returns null when the window
 * has no qualifying leg — choppy markets simply read as no displacement.
 */
export function detectDisplacement(
  candles: Candle[],
  atr: number,
  options: Partial<SetupOptions> = {},
): Displacement | null {
  const opts: SetupOptions = { ...DEFAULTS, ...options }
  if (candles.length < opts.minLegCandles + 2 || !Number.isFinite(atr) || atr <= 0) return null

  const displacements: Displacement[] = []
  for (const leg of splitLegs(candles, atr, opts)) {
    const displacement = evaluateLeg(leg, atr, opts)
    if (displacement) displacements.push(displacement)
  }
  if (displacements.length === 0) return null
  // Strongest wins; ties go to the most recent leg.
  displacements.sort((a, b) => b.strength - a.strength || b.startIndex - a.startIndex)
  return displacements[0]
}

/* ------------------------------------------------------------------ */
/* Retracement — price returns into the displacement zone              */
/* ------------------------------------------------------------------ */

/**
 * Detect a retracement into the displacement zone after the leg completed.
 * depthPercent is the fraction of the leg's move that price gave back; the
 * zone is entered from 38.2% (Fibonacci convention, deterministic). The
 * reaction is measured on the candles after the retracement extreme: a close
 * back through the midpoint = 'held', a close through the far edge of the
 * zone = 'broke' (the displacement is invalidated), otherwise 'none'.
 */
export function detectRetracement(
  candles: Candle[],
  atr: number,
  displacement: Displacement,
  options: Partial<SetupOptions> = {},
): Retracement | null {
  const opts: SetupOptions = { ...DEFAULTS, ...options }
  if (!displacement || !Number.isFinite(atr) || atr <= 0) return null
  const move = displacement.zoneHigh - displacement.zoneLow
  if (move <= 0) return null

  const after = candles.slice(displacement.endIndex + 1, displacement.endIndex + 1 + opts.retracementLookahead)
  if (after.length === 0) return null

  const up = displacement.direction === 'up'
  let extreme = up ? Infinity : -Infinity
  let extremeIndex = -1
  for (let k = 0; k < after.length; k++) {
    const value = up ? after[k].low : after[k].high
    if (up ? value < extreme : value > extreme) {
      extreme = value
      extremeIndex = displacement.endIndex + 1 + k
    }
  }
  if (extremeIndex < 0) return null

  const depthPercent =
    Math.round((up ? (displacement.zoneHigh - extreme) / move : (extreme - displacement.zoneLow) / move) * 100) / 100
  const enteredZone = depthPercent >= opts.minRetracementDepth
  // A pullback beyond the configured maximum depth is over-retraced — it is
  // no longer a clean retracement into the zone (V2 parameter).
  const overRetraced = depthPercent > opts.maximumRetracement

  const midpoint = up ? displacement.zoneHigh - move * 0.5 : displacement.zoneLow + move * 0.5
  let reaction: Retracement['reaction'] = 'none'
  const end = Math.min(candles.length, extremeIndex + 1 + opts.reactionCandles)
  for (let i = extremeIndex + 1; i < end; i++) {
    const candle = candles[i]
    if (up) {
      if (candle.close < displacement.zoneLow) {
        reaction = 'broke'
        break
      }
      if (candle.close >= midpoint) {
        reaction = 'held'
        break
      }
    } else {
      if (candle.close > displacement.zoneHigh) {
        reaction = 'broke'
        break
      }
      if (candle.close <= midpoint) {
        reaction = 'held'
        break
      }
    }
  }

  return {
    found: true,
    depthPercent,
    retracementPrice: extreme,
    retracementIndex: extremeIndex,
    enteredZone,
    reaction,
    overRetraced,
  }
}

/* ------------------------------------------------------------------ */
/* Confirmation — deterministic candle/structure triggers              */
/* ------------------------------------------------------------------ */

/**
 * Detect a confirmation candle for a setup direction, in priority order:
 * engulfing → rejection → continuation → (optional) fresh structure reclaim.
 * Only CLOSED candles are considered; the checks are recent-candle based so
 * a stale crossing from many candles ago never confirms a NEW setup.
 */
export function detectConfirmation(
  candles: Candle[],
  atr: number,
  direction: SetupDirection,
  referenceLevel: number | null,
  options: Partial<SetupOptions> & { allowReclaim?: boolean } = {},
): Confirmation | null {
  const opts: SetupOptions = { ...DEFAULTS, ...options }
  const allowReclaim = options.allowReclaim ?? true
  if (candles.length < 2 || !Number.isFinite(atr) || atr <= 0) return null

  const n = candles.length
  const long = direction === 'long'
  const last = candles[n - 1]
  const prev = candles[n - 2]
  const body = Math.abs(last.close - last.open)
  const bullish = last.close >= last.open

  // 1. Engulfing — the last candle's body fully engulfs the previous body in
  //    the setup direction. A fresh, decisive reaction candle.
  if (long === bullish) {
    const engulfs = long
      ? last.open <= prev.close && last.close >= prev.open && last.close > prev.close
      : last.open >= prev.close && last.close <= prev.open && last.close < prev.close
    if (engulfs && body >= opts.minBodyAtp * atr) {
      return {
        kind: 'engulfing',
        direction,
        candleIndex: n - 1,
        description: `${long ? 'bullish' : 'bearish'} engulfing on the last closed candle`,
      }
    }
  }

  // 2. Rejection — price probed beyond the reference/previous extreme and
  //    closed back in the setup direction with a wick that overwhelmed the
  //    body. The wick shows the rejection; the close shows the direction.
  if (body >= 0.3 * atr && long === bullish) {
    const wick = long
      ? last.low - Math.min(last.open, last.close)
      : Math.max(last.open, last.close) - last.high
    const probed = long
      ? last.low < Math.min(prev.low, referenceLevel ?? prev.low)
      : last.high > Math.max(prev.high, referenceLevel ?? prev.high)
    if (wick >= opts.rejectionWickRatio * body && probed) {
      return {
        kind: 'rejection',
        direction,
        candleIndex: n - 1,
        description: `${long ? 'bullish' : 'bearish'} rejection — wick probed beyond the level, price closed back`,
      }
    }
  }

  // 3. Continuation — the last candle closes beyond every recent close in the
  //    setup direction with a meaningful body (momentum resuming).
  const window = candles.slice(Math.max(0, n - 1 - opts.confirmationCheck), n - 1)
  const extreme = long ? Math.max(...window.map((c) => c.close)) : Math.min(...window.map((c) => c.close))
  if ((long ? last.close > extreme : last.close < extreme) && body >= opts.minBodyAtp * atr) {
    return {
      kind: 'continuation',
      direction,
      candleIndex: n - 1,
      description: `continuation candle — last close ${long ? 'above' : 'below'} the recent ${long ? 'highs' : 'lows'}`,
    }
  }

  // 4. Fresh structure reclaim — a candle in the last `reclaimLookback`
  //    closed THROUGH the reference level in the setup direction, and the
  //    previous candle was still beyond it (a fresh crossing, not an old one).
  if (allowReclaim && referenceLevel !== null) {
    for (let i = Math.max(1, n - opts.reclaimLookback); i < n; i++) {
      const candle = candles[i]
      const fresh = long
        ? candle.close > referenceLevel && candles[i - 1].close <= referenceLevel
        : candle.close < referenceLevel && candles[i - 1].close >= referenceLevel
      if (fresh) {
        return {
          kind: 'structure_reclaim',
          direction,
          candleIndex: i,
          description: `structure reclaim — price closed back ${long ? 'above' : 'below'} the ${long ? 'swept level' : 'swept level'} on the last ${i === n - 1 ? 'candle' : 'candles'}`,
        }
      }
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Sweep read — from the engine's SweepRecords                         */
/* ------------------------------------------------------------------ */

function sweepSideLabel(side: 'buy' | 'sell'): string {
  return side === 'buy' ? 'buy-side' : 'sell-side'
}

function directionLabel(direction: SetupDirection): string {
  return direction === 'long' ? 'Long' : 'Short'
}

/** Setup direction implied by a liquidity sweep (buy-side swept → short). */
function sweepDirection(side: 'buy' | 'sell'): SetupDirection {
  return side === 'buy' ? 'short' : 'long'
}

/**
 * Read the most recent sweep on the window and match it back to its Liquidity
 * Zone (same side + price) for the level's source/rank metadata. Only sweeps
 * inside the recent window count — an actionable setup needs a fresh sweep.
 */
function readSweep(analysis: TimeframeAnalysis, candles: Candle[], options: SetupOptions): SweepRead | null {
  if (analysis.sweeps.length === 0) return null
  const cutoff = candles.length > 0 ? candles[Math.max(0, candles.length - options.recentSweepCandles)].timestamp : Infinity
  const recent = analysis.sweeps.filter((sweep) => sweep.sweptAt >= cutoff)
  if (recent.length === 0) return null

  // The zone a sweep traded THROUGH is the one the level belongs to: same
  // side, already marked swept, within the configured distance of the
  // trade-through price, and PIERCED by at least the minimum penetration — a
  // candle that stops exactly at the level is a test, not a liquidity grab.
  // All tolerances are V2 parameters, not hard-coded values.
  const pierce = Math.max(analysis.atr * options.sweepPierceAtp, analysis.currentPrice * 1e-4)
  const minPenetration = analysis.atr * options.sweepMinimumPenetrationAtp
  const maxPenetration = analysis.atr * options.sweepMaximumPenetrationAtp
  const candleFor = (sweep: SweepRecord): Candle | undefined =>
    candles.find((candle) => candle.timestamp === sweep.sweptAt)

  const zoneFor = (sweep: SweepRecord): LiquidityCandidate | undefined => {
    const zones = sweep.side === 'buy' ? analysis.liquidity.buySide : analysis.liquidity.sellSide
    return zones
      .filter((candidate) => {
        if (!candidate.swept) return false
        if (Math.abs(candidate.price - sweep.sweepPrice) > options.sweepMaxDistanceAtp * analysis.atr) return false
        return sweep.side === 'buy'
          ? sweep.sweepPrice > candidate.price + pierce
          : sweep.sweepPrice < candidate.price - pierce
      })
      .sort((a, b) => Math.abs(a.price - sweep.sweepPrice) - Math.abs(b.price - sweep.sweepPrice))[0]
  }

  const qualifies = (sweep: SweepRecord): boolean => {
    const zone = zoneFor(sweep)
    if (!zone) return false
    const penetration = Math.abs(sweep.sweepPrice - zone.price)
    if (penetration < minPenetration) return false
    // When wick-only interaction is disallowed, a candle body (open or close)
    // must also trade through the level — a pure wick probe is not a sweep.
    if (!options.sweepWickOnlyQualifies) {
      const candle = candleFor(sweep)
      if (!candle) return false
      const bodyThrough =
        sweep.side === 'buy'
          ? candle.close > zone.price || candle.open > zone.price
          : candle.close < zone.price || candle.open < zone.price
      if (!bodyThrough) return false
    }
    return true
  }

  // Only meaningful (pierced) sweeps count as a setup trigger; boundary
  // touches of the previous-period extreme are noise, not liquidity taken.
  const meaningful = recent.filter(qualifies)
  if (meaningful.length === 0) return null

  // Most recent sweep wins; among simultaneous sweeps prefer the one whose
  // zone is most significant (its strength already encodes touches/recency).
  meaningful.sort((a, b) => {
    const aStrength = zoneFor(a)?.strength ?? 0
    const bStrength = zoneFor(b)?.strength ?? 0
    return b.sweptAt - a.sweptAt || bStrength - aStrength
  })
  const sweep = meaningful[0]
  const zone = zoneFor(sweep)
  const penetration = zone ? Math.abs(sweep.sweepPrice - zone.price) : 0
  return {
    present: true,
    recent: true,
    direction: sweepDirection(sweep.side),
    levelPrice: zone?.price ?? sweep.sweepPrice,
    levelSource: zone?.source ?? null,
    rank: zone?.rank ?? null,
    returned: sweep.returned && options.sweepCloseBackThrough ? sweep.returned : false,
    sweptAt: sweep.sweptAt,
    sweepCount: meaningful.length,
    overExtended: zone ? penetration > maxPenetration : false,
  }
}

/* ------------------------------------------------------------------ */
/* Setup quality — evidence-weighted, level-based, never a probability */
/* ------------------------------------------------------------------ */

function levelFromScore(score: number, thresholds: SetupOptions['scoreThresholds']): SetupLevel {
  if (score >= thresholds.strong) return 'strong'
  if (score >= thresholds.moderate) return 'moderate'
  if (score >= thresholds.weak) return 'weak'
  return 'none'
}

/** The importance multiplier for a liquidity source label. */
function sourceWeight(source: string, weights: ScoreWeights['liquidity']): number {
  if (source === 'equal_high') return weights.equalHigh
  if (source === 'equal_low') return weights.equalLow
  if (source.startsWith('previous_')) return weights.previousDay
  if (source.startsWith('range_')) return weights.range
  return weights.swing
}

/**
 * Liquidity contribution — the pool the setup is actually built on, weighted
 * by its rank and source importance (equal highs/lows classify stronger).
 * For a sweep setup that is the SWEPT pool (so equal-low/equal-high
 * importance always reaches the score); otherwise the nearest pool on the
 * setup side.
 */
function liquidityContribution(
  analysis: TimeframeAnalysis,
  direction: 'long' | 'short',
  weights: ScoreWeights['liquidity'],
  sweep?: SweepRead | null,
): number {
  const zones = direction === 'long' ? analysis.liquidity.sellSide : analysis.liquidity.buySide
  let zone = zones[0]
  if (sweep && sweep.levelPrice !== null) {
    // Prefer the exact pool the sweep took — it is the setup's liquidity.
    const swept = zones.find(
      (candidate) =>
        candidate.source === sweep.levelSource &&
        candidate.swept &&
        Math.abs(candidate.price - sweep.levelPrice!) < 1e-6,
    )
    if (swept) zone = swept
  }
  if (!zone) return 0
  const rankBase = zone.rank === 'high' ? 10 : zone.rank === 'medium' ? 8 : 6
  return Math.round(Math.min(weights.max, rankBase * sourceWeight(zone.source, weights)))
}

function confirmationKindWeight(kind: ConfirmationKind, weights: ConfirmationKindWeights): number {
  switch (kind) {
    case 'engulfing':
      return weights.engulfing
    case 'rejection':
      return weights.rejection
    case 'continuation':
      return weights.continuation
    case 'structure_reclaim':
      return weights.structure_reclaim
  }
}

interface GradeResult {
  quality: SetupQuality
  confirmation: Confirmation | null
  /** The winning family's traceable contribution breakdown. */
  contributions: ScoreContributions
  /** The context read that contributed to the score. */
  context: ContextRead
  /** Explicitly missing/negative factors. */
  missing: string[]
  /** Confluence bonus applied, when both families are active. */
  confluenceBonus: { family: SetupFamily; points: number } | null
  cappedByNoConfirmation: boolean
}

/**
 * Score each active setup family from measurable evidence and combine them.
 *
 * Every point is traceable to a group contribution (liquidity, sweep,
 * displacement, pullback, confirmation, context) whose weights come from the
 * V2 configuration — nothing is hard-coded here. Defaults reproduce V1's
 * point math exactly: a valid recent sweep earns the sweep base, reclaim
 * earns the reclaim bonus, aligned structure the context points, and a
 * confirmation the confirmation points.
 *
 * Sweep → Confirmation → Entry is a valid setup (no pullback required), and
 * displacement stands alone — the families are scored independently and
 * combined. When BOTH families are active the result is 'confluence'
 * (score = best family + confluence bonus). Without a confirmation a family
 * caps at `noConfirmationCap`, so a setup is never called strong on
 * unfinished evidence.
 */
function gradeSetup(
  analysis: TimeframeAnalysis,
  sweep: SweepRead | null,
  sweepConfirmation: Confirmation | null,
  displacement: Displacement | null,
  retracement: Retracement | null,
  dispConfirmation: Confirmation | null,
  options: SetupOptions,
): GradeResult {
  const weights = options.scoreWeights
  const reasons: string[] = []
  const missing: string[] = []

  // ---- Sweep family ----------------------------------------------------
  let sweepScore = 0
  let sweepActive = false
  let sweepLiquidity = 0
  let sweepContext: ContextRead | null = null
  let sweepConfirmContrib = 0
  if (sweep) {
    sweepActive = true
    const direction = sweep.direction ?? 'long'
    sweepLiquidity = liquidityContribution(analysis, direction, weights.liquidity, sweep)
    sweepScore += weights.sweepBase + sweepLiquidity
    reasons.push(
      `${sweepSideLabel(sweep.direction === 'long' ? 'sell' : 'buy')} liquidity at ${Math.round(sweep.levelPrice ?? 0)} swept${sweep.returned ? ' and reclaimed' : ''}`,
    )
    if (sweep.returned) {
      sweepScore += weights.sweepReclaim
      reasons.push('Price closed back through the swept level — liquidity reclaimed')
    } else {
      missing.push('No reclaim yet — price is still beyond the swept level')
    }
    if (sweep.overExtended) missing.push('Sweep over-extended — penetration beyond the configured maximum')
    sweepContext = evaluateContext(analysis, direction, { ...weights.context, structure: weights.structure })
    sweepScore += sweepContext.contribution
    reasons.push(...sweepContext.reasons)
    if (sweepConfirmation) {
      sweepConfirmContrib = Math.round(weights.confirmation * confirmationKindWeight(sweepConfirmation.kind, options.confirmationKindWeights))
      sweepScore += sweepConfirmContrib
      reasons.push(`Confirmation — ${sweepConfirmation.description}`)
    }
  }

  // ---- Displacement family ---------------------------------------------
  let dispScore = 0
  let displacementActive = false
  let dispLiquidity = 0
  let dispContext: ContextRead | null = null
  let dispConfirmContrib = 0
  if (displacement) {
    const direction: SetupDirection = displacement.direction === 'up' ? 'long' : 'short'
    reasons.push(
      `${directionLabel(direction)} displacement — ${displacement.strength}/100 strength (${displacement.evidence.rangeExpansion}× range expansion, ${Math.round(displacement.evidence.bodyRatio * 100)}% body, ${Math.round(displacement.evidence.directionalConsistency * 100)}% directional consistency)`,
    )
    const brokeZone = retracement?.reaction === 'broke' && options.pullbackStayInZone
    if (retracement && retracement.enteredZone && !brokeZone) {
      displacementActive = true
      dispLiquidity = liquidityContribution(analysis, direction, weights.liquidity)
      dispScore += weights.displacementBase + dispLiquidity
      dispScore += weights.pullbackBase
      reasons.push(`Price retraced ${Math.round(retracement.depthPercent * 100)}% of the move into the displacement zone`)
      if (retracement.overRetraced) missing.push('Pullback over-retraced — beyond the configured maximum depth')
      if (retracement.reaction === 'held') {
        dispScore += weights.pullbackHeld
        reasons.push('Reaction held at the retracement — the zone defended')
      }
      dispContext = evaluateContext(analysis, direction, { ...weights.context, structure: weights.structure })
      dispScore += dispContext.contribution
      reasons.push(...dispContext.reasons)
      if (dispConfirmation) {
        dispConfirmContrib = Math.round(weights.confirmation * confirmationKindWeight(dispConfirmation.kind, options.confirmationKindWeights))
        dispScore += dispConfirmContrib
        reasons.push(`Confirmation — ${dispConfirmation.description}`)
      }
    } else if (brokeZone) {
      reasons.push('Retracement broke through the displacement zone — the move is invalidated')
      missing.push('Pullback broke the displacement zone')
    } else {
      reasons.push(
        retracement && retracement.enteredZone
          ? 'Retracement entered the zone but has not reacted yet'
          : 'No retracement into the displacement zone yet — not a displacement setup',
      )
      missing.push('No pullback into the displacement zone — displacement alone is not an entry')
    }
  }

  // ---- Family selection + traceable contributions -----------------------
  let family: SetupFamily = 'none'
  let score = 0
  let confirmation: Confirmation | null = null
  let contributions: ScoreContributions = { liquidity: 0, sweep: 0, displacement: 0, pullback: 0, confirmation: 0, context: 0 }
  let activeContext: ContextRead | null = null
  let confluenceBonus: { family: SetupFamily; points: number } | null = null

  if (sweepActive && displacementActive) {
    family = 'confluence'
    confirmation = dispConfirmation ?? sweepConfirmation
    reasons.push('Both setup families present — higher confluence, not a guarantee')
    const sweepTotal = sweepScore
    const dispTotal = dispScore
    if (dispTotal >= sweepTotal) {
      score = dispTotal
      contributions = {
        liquidity: dispLiquidity,
        sweep: 0,
        displacement: weights.displacementBase,
        pullback: weights.pullbackBase + (retracement?.reaction === 'held' ? weights.pullbackHeld : 0),
        confirmation: dispConfirmContrib,
        context: dispContext?.contribution ?? 0,
      }
      activeContext = dispContext
    } else {
      score = sweepTotal
      contributions = {
        liquidity: sweepLiquidity,
        sweep: weights.sweepBase + (sweep!.returned ? weights.sweepReclaim : 0),
        displacement: 0,
        pullback: 0,
        confirmation: sweepConfirmContrib,
        context: sweepContext?.contribution ?? 0,
      }
      activeContext = sweepContext
    }
    score += weights.confluenceBonus
    confluenceBonus = { family, points: weights.confluenceBonus }
  } else if (sweepActive) {
    family = 'liquidity_sweep'
    score = sweepScore
    confirmation = sweepConfirmation
    contributions = {
      liquidity: sweepLiquidity,
      sweep: weights.sweepBase + (sweep!.returned ? weights.sweepReclaim : 0),
      displacement: 0,
      pullback: 0,
      confirmation: sweepConfirmContrib,
      context: sweepContext?.contribution ?? 0,
    }
    activeContext = sweepContext
  } else if (displacementActive) {
    family = 'displacement'
    score = dispScore
    confirmation = dispConfirmation
    contributions = {
      liquidity: dispLiquidity,
      sweep: 0,
      displacement: weights.displacementBase,
      pullback: weights.pullbackBase + (retracement?.reaction === 'held' ? weights.pullbackHeld : 0),
      confirmation: dispConfirmContrib,
      context: dispContext?.contribution ?? 0,
    }
    activeContext = dispContext
  } else {
    reasons.length = 0
    reasons.push(sweep ? 'Liquidity swept but no reclaim and no confirmation' : 'No recent liquidity sweep')
    reasons.push(displacement ? 'Displacement observed but no retracement into its zone yet' : 'No displacement detected on this window')
    missing.push(sweep ? 'No reclaim and no confirmation' : 'No recent liquidity sweep')
    missing.push(displacement ? 'No retracement into the displacement zone' : 'No displacement detected')
  }

  // ---- No-confirmation cap + final score --------------------------------
  let capped = false
  if (confirmation === null && family !== 'none' && score > weights.noConfirmationCap) {
    score = weights.noConfirmationCap
    capped = true
    missing.push('No confirmation — score capped')
  } else if (confirmation === null && family !== 'none') {
    // A setup without a confirmation candle is unfinished evidence — report
    // it explicitly so Oracle and the UI can say WHY it is not stronger.
    missing.push('No confirmation candle yet — setup quality reflects unfinished evidence')
  }

  return {
    quality: {
      level: levelFromScore(score, options.scoreThresholds),
      score,
      family,
      reasons,
      contributions,
      missing,
      confluenceBonus,
      cappedByNoConfirmation: capped,
    },
    confirmation,
    contributions,
    context: activeContext ?? {
      structure: { trend: analysis.structure?.trend ?? null, label: analysis.structure?.label ?? null, aligned: false },
      opposingLiquidity: { side: null, price: null, distancePercent: null },
      volatility: { atrPercent: analysis.atr > 0 ? (analysis.atr / analysis.currentPrice) * 100 : null, elevated: false },
      contribution: 0,
      reasons: [],
    },
    missing,
    confluenceBonus,
    cappedByNoConfirmation: capped,
  }
}

/* ------------------------------------------------------------------ */
/* The intelligence object                                             */
/* ------------------------------------------------------------------ */

function buildRead(
  asset: string,
  timeframe: string,
  intelligence: Pick<SetupIntelligence, 'sweep' | 'displacement' | 'retracement' | 'confirmation' | 'setupQuality' | 'trend'>,
): string {
  const { sweep, displacement, retracement, confirmation, setupQuality } = intelligence
  if (setupQuality.family === 'none') {
    return `${asset} shows no active setup on ${timeframe}. ${setupQuality.reasons.join(' ')}`
  }

  const parts: string[] = []
  if (sweep && sweep.levelPrice !== null) {
    const direction: 'sell' | 'buy' = sweep.direction === 'long' ? 'sell' : 'buy'
    parts.push(
      `${sweepSideLabel(direction)} liquidity at ${sweep.levelPrice.toFixed(2)} was swept${sweep.returned ? ' and reclaimed' : ''}.`,
    )
  }
  if (displacement) {
    parts.push(
      `${directionLabel(displacement.direction === 'up' ? 'long' : 'short')} displacement — ${displacement.strength}/100 (${displacement.evidence.rangeExpansion}× range expansion, ${Math.round(displacement.evidence.bodyRatio * 100)}% body, ${Math.round(displacement.evidence.directionalConsistency * 100)}% consistency).`,
    )
  }
  if (retracement && retracement.enteredZone) {
    parts.push(
      `Price retraced ${Math.round(retracement.depthPercent * 100)}% of the move${retracement.reaction === 'held' ? ', and the reaction held' : ''}.`,
    )
  }
  if (confirmation) {
    parts.push(`Confirmation — ${confirmation.description}.`)
  }
  parts.push(`Setup quality: ${setupQuality.level.toUpperCase()} (${setupQuality.family.replace('_', ' ')}).`)
  return parts.join(' ')
}

/**
 * A separate candle series for confirmations — the user's execution model
 * confirms on 1M even when liquidity was detected on a higher timeframe.
 */
export interface ConfirmationSeries {
  candles: Candle[]
  /** Label of the series, e.g. '1m'. */
  timeframe: string
  /** Optional precomputed ATR; computed from the series when omitted. */
  atr?: number
}

/**
 * Assess the full setup intelligence for one window. Pure and deterministic:
 * the same candles + analysis + configuration always produce the same read.
 * When the engine has insufficient data the result says so — never a
 * fabricated setup.
 *
 * `confirmationSeries` lets confirmations run on a SEPARATE candle series
 * (1M by default — the primary execution confirmation timeframe) while
 * liquidity/displacement/pullback read the analysis window. When omitted,
 * confirmations read the window's own candles.
 */
export function assessSetupIntelligence(
  analysis: TimeframeAnalysis,
  candles: Candle[],
  asset: string,
  options: Partial<SetupOptions> = {},
  confirmationSeries?: ConfirmationSeries,
): SetupIntelligence {
  const opts: SetupOptions = { ...DEFAULTS, ...options }
  const computedAt = Date.now()
  const emptyQuality: SetupQuality = {
    level: 'none',
    score: 0,
    family: 'none',
    reasons: [],
    contributions: { liquidity: 0, sweep: 0, displacement: 0, pullback: 0, confirmation: 0, context: 0 },
    missing: [],
    confluenceBonus: null,
    cappedByNoConfirmation: false,
  }

  const base: SetupIntelligence = {
    asset,
    timeframe: analysis.timeframe,
    currentPrice: analysis.currentPrice,
    trend: analysis.structure?.trend ?? null,
    sweep: null,
    displacement: null,
    retracement: null,
    confirmation: null,
    confirmationTimeframe: opts.confirmationTimeframe,
    setupQuality: emptyQuality,
    context: {
      structure: { trend: analysis.structure?.trend ?? null, label: analysis.structure?.label ?? null, aligned: false },
      opposingLiquidity: { side: null, price: null, distancePercent: null },
      volatility: {
        atrPercent: analysis.atr > 0 ? (analysis.atr / analysis.currentPrice) * 100 : null,
        elevated: false,
      },
      contribution: 0,
      reasons: [],
    },
    read: '',
    computedAt,
    status: analysis.insufficient ? 'insufficient' : 'ready',
  }

  if (analysis.insufficient || candles.length < 14 || !Number.isFinite(analysis.atr) || analysis.atr <= 0) {
    return {
      ...base,
      read: `Not enough closed candles for a setup read on ${analysis.timeframe}.`,
      setupQuality: { ...emptyQuality, reasons: ['Insufficient closed candles for a reliable setup read.'] },
    }
  }

  const sweep = readSweep(analysis, candles, opts)
  const displacement = detectDisplacement(candles, analysis.atr, opts)
  const retracement = displacement ? detectRetracement(candles, analysis.atr, displacement, opts) : null

  // Confirmations run on the configured confirmation series (1M by default)
  // when one is supplied — liquidity timeframe and confirmation timeframe are
  // independent. The series needs its own ATR.
  const confirmCandles = confirmationSeries?.candles ?? candles
  const confirmAtr = confirmationSeries?.atr ?? (confirmationSeries ? atrValue(confirmCandles, 14) : analysis.atr)
  const canConfirm = confirmCandles.length >= 2 && Number.isFinite(confirmAtr) && confirmAtr > 0

  const sweepConfirmation =
    canConfirm && sweep && sweep.direction
      ? detectConfirmation(confirmCandles, confirmAtr, sweep.direction, sweep.levelPrice, { ...opts, allowReclaim: true })
      : null

  const displacementActive = Boolean(displacement && retracement?.enteredZone && (retracement.reaction !== 'broke' || !opts.pullbackStayInZone))
  const dispDirection: SetupDirection | null = displacement
    ? displacement.direction === 'up'
      ? 'long'
      : 'short'
    : null
  const dispMidpoint =
    displacement && retracement
      ? displacement.direction === 'up'
        ? displacement.zoneHigh - (displacement.zoneHigh - displacement.zoneLow) * 0.5
        : displacement.zoneLow + (displacement.zoneHigh - displacement.zoneLow) * 0.5
      : null
  const dispConfirmation =
    canConfirm && displacementActive && dispDirection && dispMidpoint !== null
      ? detectConfirmation(confirmCandles, confirmAtr, dispDirection, dispMidpoint, { ...opts, allowReclaim: false })
      : null

  const effectiveConfirmTimeframe =
    confirmationSeries && (sweepConfirmation || dispConfirmation)
      ? confirmationSeries.timeframe
      : opts.confirmationTimeframe

  const grade = gradeSetup(analysis, sweep, sweepConfirmation, displacement, retracement, dispConfirmation, opts)
  const { quality, confirmation } = grade

  return {
    ...base,
    sweep,
    displacement,
    retracement,
    confirmation,
    confirmationTimeframe: effectiveConfirmTimeframe,
    setupQuality: quality,
    context: grade.context,
    read: buildRead(asset, analysis.timeframe, { sweep, displacement, retracement, confirmation, setupQuality: quality, trend: base.trend }),
  }
}
