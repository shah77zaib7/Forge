/**
 * Forge V2 — centralized configuration for the deterministic Liquidity
 * Model. ONE source of truth for every tunable across the seven groups
 * (Liquidity, Sweep, Displacement, Pullback, Confirmation, Context,
 * Scoring). Nothing is hard-coded in the engine: the detection and scoring
 * layers read their thresholds from this config, so changing a value here
 * changes Forge's actual output.
 *
 * Defaults reproduce the V1 behavior exactly (same conditions earn the same
 * points, organized into traceable group contributions). Every field is
 * consumed by the engine via the mappers below or by the V2 engine entry.
 */

/* ------------------------------------------------------------------ */
/* Group configs                                                       */
/* ------------------------------------------------------------------ */

export interface LiquidityConfig {
  /** Extra weight for equal-high pools (stronger classification than swing). */
  equalHighWeight: number
  /** Extra weight for equal-low pools. */
  equalLowWeight: number
  /** Baseline weight for ordinary swing highs/lows. */
  swingWeight: number
  /** Previous-day/period extreme weight. */
  previousDayWeight: number
  /** Full-range extreme weight. */
  rangeWeight: number
  /** Merge tolerance for equal/cluster levels, in ATR multiples. */
  toleranceAtp: number
  /** Max liquidity candidates returned per side. */
  maxCandidatesPerSide: number
  /** Ceiling for the liquidity score contribution. */
  contributionMax: number
}

export interface SweepConfig {
  /** Minimum penetration past the level (ATR) for a trade-through to count. */
  minimumPenetrationAtp: number
  /** Penetration beyond this (ATR) reads as over-extended — weaker sweep. */
  maximumPenetrationAtp: number
  /** Zone-match tolerance (ATR) when linking a sweep back to its zone. */
  toleranceAtp: number
  /** Max price distance (ATR) from a sweep to its zone. */
  maxDistanceAtp: number
  /** Wick-only interaction qualifies as a sweep. */
  wickOnlyQualifies: boolean
  /** Price must close back through the level for the reclaim credit. */
  closeBackThrough: boolean
  /** A sweep counts as recent within this many candles of the window end. */
  recentCandles: number
  /** Score points for a valid recent sweep. */
  baseContribution: number
  /** Score points when price closed back through the level (reclaim). */
  reclaimContribution: number
}

export interface DisplacementConfig {
  /** A leg must move at least this many ATRs net. */
  minNetMoveAtp: number
  /** Strongest candle range ÷ ATR. */
  minRangeExpansion: number
  /** Strongest candle body ÷ its own range. */
  minBodyRatio: number
  /** Minimum leg length in candles. */
  consecutiveCandles: number
  /** Candles scanned for displacement legs (from the end). */
  timeWindow: number
  /** Net move ÷ total range of the leg. */
  minConsistency: number
  /** An opposite-direction body smaller than this (ATR) stays inside the leg. */
  pullbackAtp: number
  /** Score points for a qualifying displacement leg. */
  contribution: number
}

export interface PullbackConfig {
  /** A retracement must cover at least this fraction of the move. */
  minimumRetracement: number
  /** Beyond this fraction the pullback is over-retraced — weakens it. */
  maximumRetracement: number
  /** Candles after the displacement scanned for a retracement. */
  maximumCandles: number
  /** Candles after the retracement extreme checked for a reaction. */
  validityWindow: number
  /** Price must remain inside the displacement range for the setup. */
  mustStayInZone: boolean
  /** Score points for a retracement that entered the zone. */
  contribution: number
  /** Score points when the reaction held the zone. */
  heldContribution: number
}

export interface ConfirmationConfig {
  /** Primary execution confirmation timeframe (1m = user's execution model). */
  confirmationTimeframe: string
  /** Multipliers per confirmation kind, applied to the confirmation points. */
  engulfingWeight: number
  rejectionWeight: number
  continuationWeight: number
  reclaimWeight: number
  /** Minimum body (ATR) for an engulfing/continuation candle to count. */
  minBodyAtp: number
  /** Wick must exceed this multiple of the body for a rejection. */
  rejectionWickRatio: number
  /** Fresh structure-reclaim crossing window (candles). */
  reclaimLookback: number
  /** Last candles checked for candle-level confirmations. */
  checkCandles: number
  /** Score points when a confirmation candle is present. */
  contribution: number
}

export interface ContextConfig {
  /** Score points when market structure aligns with the setup direction. */
  structureContribution: number
  /** Opposing liquidity beyond this distance (%) earns the room bonus. */
  opposingLiquidityThreshold: number
  /** Score points when there is room to the opposing liquidity. */
  opposingLiquidityBonus: number
  /** ATR as % of price above which volatility is elevated. */
  volatilityThresholdAtpPct: number
  /** Score penalty when volatility is elevated. */
  volatilityPenalty: number
  /** Score penalty when structure conflicts with the setup direction. */
  conflictingStructurePenalty: number
}

export interface ScoringConfig {
  strongThreshold: number
  moderateThreshold: number
  weakThreshold: number
  /** Bonus when both setup families are present. */
  confluenceBonus: number
  /** A setup without confirmation can never exceed this. */
  noConfirmationCap: number
}

export interface ForgeV2Config {
  version: number
  liquidity: LiquidityConfig
  sweep: SweepConfig
  displacement: DisplacementConfig
  pullback: PullbackConfig
  confirmation: ConfirmationConfig
  context: ContextConfig
  scoring: ScoringConfig
}

/** A deep partial of the config — patch any group or individual parameter. */
export type V2ConfigPatch = {
  version?: number
  liquidity?: Partial<LiquidityConfig>
  sweep?: Partial<SweepConfig>
  displacement?: Partial<DisplacementConfig>
  pullback?: Partial<PullbackConfig>
  confirmation?: Partial<ConfirmationConfig>
  context?: Partial<ContextConfig>
  scoring?: Partial<ScoringConfig>
}

/* ------------------------------------------------------------------ */
/* Defaults — V1-equivalent behavior, traceable contributions          */
/* ------------------------------------------------------------------ */

export const FORGE_V2_CONFIG_VERSION = 1

export const DEFAULT_V2_CONFIG: ForgeV2Config = {
  version: FORGE_V2_CONFIG_VERSION,
  liquidity: {
    equalHighWeight: 1.15,
    equalLowWeight: 1.15,
    swingWeight: 1,
    previousDayWeight: 1.1,
    rangeWeight: 1,
    toleranceAtp: 0.45,
    maxCandidatesPerSide: 4,
    contributionMax: 12,
  },
  sweep: {
    minimumPenetrationAtp: 0.15,
    maximumPenetrationAtp: 4,
    toleranceAtp: 0.15,
    maxDistanceAtp: 2,
    wickOnlyQualifies: true,
    closeBackThrough: true,
    recentCandles: 15,
    baseContribution: 15,
    reclaimContribution: 20,
  },
  displacement: {
    minNetMoveAtp: 1.2,
    minRangeExpansion: 1.6,
    minBodyRatio: 0.55,
    consecutiveCandles: 2,
    timeWindow: 40,
    minConsistency: 0.5,
    pullbackAtp: 0.35,
    contribution: 20,
  },
  pullback: {
    minimumRetracement: 0.382,
    maximumRetracement: 0.9,
    maximumCandles: 20,
    validityWindow: 3,
    mustStayInZone: true,
    contribution: 15,
    heldContribution: 10,
  },
  confirmation: {
    confirmationTimeframe: '1m',
    engulfingWeight: 1,
    rejectionWeight: 1,
    continuationWeight: 1,
    reclaimWeight: 1,
    minBodyAtp: 0.5,
    rejectionWickRatio: 1.2,
    reclaimLookback: 3,
    checkCandles: 4,
    contribution: 30,
  },
  context: {
    structureContribution: 10,
    opposingLiquidityThreshold: 4,
    opposingLiquidityBonus: 2,
    volatilityThresholdAtpPct: 0.1,
    // Default off so V1 point math is preserved exactly — elevated
    // volatility is still measured and reported; traders can enable the
    // penalty by raising this parameter.
    volatilityPenalty: 0,
    conflictingStructurePenalty: 0,
  },
  scoring: {
    strongThreshold: 75,
    moderateThreshold: 45,
    weakThreshold: 25,
    confluenceBonus: 5,
    noConfirmationCap: 60,
  },
}

/* ------------------------------------------------------------------ */
/* Merge + validation                                                  */
/* ------------------------------------------------------------------ */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function mergeGroup<T extends object>(base: T, patch: Partial<T> | undefined, bounds: Record<string, [number, number]>): T {
  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  const baseRecord = base as Record<string, unknown>
  const patchRecord = (patch ?? {}) as Record<string, unknown>
  for (const key of Object.keys(base)) {
    const value = patchRecord[key]
    if (typeof value === 'number' && typeof baseRecord[key] === 'number') {
      const [min, max] = bounds[key] ?? [-Infinity, Infinity]
      merged[key] = clamp(value, min, max)
    } else if (typeof value === 'boolean' || typeof value === 'string') {
      merged[key] = value
    }
  }
  return merged as T
}

/**
 * Merge a partial config over the defaults, clamping numeric parameters to
 * sane bounds so a stray UI value can never break the engine.
 */
export function mergeV2Config(patch: V2ConfigPatch | undefined): ForgeV2Config {
  return {
    version: FORGE_V2_CONFIG_VERSION,
    liquidity: mergeGroup(DEFAULT_V2_CONFIG.liquidity, patch?.liquidity, {
      equalHighWeight: [0.1, 3],
      equalLowWeight: [0.1, 3],
      swingWeight: [0.1, 3],
      previousDayWeight: [0.1, 3],
      rangeWeight: [0.1, 3],
      toleranceAtp: [0.05, 3],
      maxCandidatesPerSide: [1, 12],
      contributionMax: [0, 30],
    }),
    sweep: mergeGroup(DEFAULT_V2_CONFIG.sweep, patch?.sweep, {
      minimumPenetrationAtp: [0, 3],
      maximumPenetrationAtp: [0.5, 12],
      toleranceAtp: [0, 3],
      maxDistanceAtp: [0.5, 10],
      recentCandles: [1, 60],
      baseContribution: [0, 40],
      reclaimContribution: [0, 40],
    }),
    displacement: mergeGroup(DEFAULT_V2_CONFIG.displacement, patch?.displacement, {
      minNetMoveAtp: [0.2, 6],
      minRangeExpansion: [0.5, 6],
      minBodyRatio: [0.2, 0.95],
      consecutiveCandles: [1, 6],
      timeWindow: [10, 120],
      minConsistency: [0.2, 0.95],
      pullbackAtp: [0.1, 2],
      contribution: [0, 40],
    }),
    pullback: mergeGroup(DEFAULT_V2_CONFIG.pullback, patch?.pullback, {
      minimumRetracement: [0.1, 0.8],
      maximumRetracement: [0.4, 1],
      maximumCandles: [3, 60],
      validityWindow: [1, 10],
      contribution: [0, 40],
      heldContribution: [0, 30],
    }),
    confirmation: mergeGroup(DEFAULT_V2_CONFIG.confirmation, patch?.confirmation, {
      engulfingWeight: [0.1, 2],
      rejectionWeight: [0.1, 2],
      continuationWeight: [0.1, 2],
      reclaimWeight: [0.1, 2],
      minBodyAtp: [0.1, 3],
      rejectionWickRatio: [0.3, 4],
      reclaimLookback: [1, 10],
      checkCandles: [1, 12],
      contribution: [0, 50],
    }),
    context: mergeGroup(DEFAULT_V2_CONFIG.context, patch?.context, {
      structureContribution: [0, 30],
      opposingLiquidityThreshold: [0.5, 20],
      opposingLiquidityBonus: [0, 20],
      volatilityThresholdAtpPct: [0.01, 5],
      volatilityPenalty: [0, 30],
      conflictingStructurePenalty: [0, 30],
    }),
    scoring: mergeGroup(DEFAULT_V2_CONFIG.scoring, patch?.scoring, {
      strongThreshold: [50, 95],
      moderateThreshold: [30, 70],
      weakThreshold: [10, 40],
      confluenceBonus: [0, 20],
      noConfirmationCap: [30, 90],
    }),
  }
}

/* ------------------------------------------------------------------ */
/* Mappers → engine option shapes                                      */
/* ------------------------------------------------------------------ */

import type { IntelligenceOptions } from '../market-intelligence'
import type { SetupOptions } from '../setup-intelligence'

/**
 * Map the V2 config onto the low-level Liquidity Model engine options.
 * Every value below is read by the deterministic engine — changing the
 * config changes the analysis.
 */
export function v2ConfigToIntelligenceOptions(config: ForgeV2Config): Partial<IntelligenceOptions> {
  return {
    equalToleranceAtp: config.liquidity.toleranceAtp,
    maxCandidatesPerSide: config.liquidity.maxCandidatesPerSide,
    sourceWeights: {
      equalHigh: config.liquidity.equalHighWeight,
      equalLow: config.liquidity.equalLowWeight,
      swing: config.liquidity.swingWeight,
      previousDay: config.liquidity.previousDayWeight,
      range: config.liquidity.rangeWeight,
    },
  }
}

/**
 * Map the V2 config onto the Setup Intelligence layer options, including the
 * scoring weights. Changing any value here changes the setup read/score.
 */
export function v2ConfigToSetupOptions(config: ForgeV2Config): Partial<SetupOptions> {
  return {
    lookback: config.displacement.timeWindow,
    minLegCandles: config.displacement.consecutiveCandles,
    minNetMoveAtp: config.displacement.minNetMoveAtp,
    minRangeExpansion: config.displacement.minRangeExpansion,
    minBodyRatio: config.displacement.minBodyRatio,
    minConsistency: config.displacement.minConsistency,
    pullbackAtp: config.displacement.pullbackAtp,
    retracementLookahead: config.pullback.maximumCandles,
    minRetracementDepth: config.pullback.minimumRetracement,
    maximumRetracement: config.pullback.maximumRetracement,
    reactionCandles: config.pullback.validityWindow,
    pullbackStayInZone: config.pullback.mustStayInZone,
    confirmationCheck: config.confirmation.checkCandles,
    reclaimLookback: config.confirmation.reclaimLookback,
    minBodyAtp: config.confirmation.minBodyAtp,
    rejectionWickRatio: config.confirmation.rejectionWickRatio,
    recentSweepCandles: config.sweep.recentCandles,
    sweepPierceAtp: config.sweep.toleranceAtp,
    sweepMaxDistanceAtp: config.sweep.maxDistanceAtp,
    sweepMinimumPenetrationAtp: config.sweep.minimumPenetrationAtp,
    sweepMaximumPenetrationAtp: config.sweep.maximumPenetrationAtp,
    sweepWickOnlyQualifies: config.sweep.wickOnlyQualifies,
    sweepCloseBackThrough: config.sweep.closeBackThrough,
    confirmationTimeframe: config.confirmation.confirmationTimeframe,
    confirmationKindWeights: {
      engulfing: config.confirmation.engulfingWeight,
      rejection: config.confirmation.rejectionWeight,
      continuation: config.confirmation.continuationWeight,
      structure_reclaim: config.confirmation.reclaimWeight,
    },
    scoreWeights: {
      liquidity: {
        equalHigh: config.liquidity.equalHighWeight,
        equalLow: config.liquidity.equalLowWeight,
        swing: config.liquidity.swingWeight,
        previousDay: config.liquidity.previousDayWeight,
        range: config.liquidity.rangeWeight,
        max: config.liquidity.contributionMax,
      },
      sweepBase: config.sweep.baseContribution,
      sweepReclaim: config.sweep.reclaimContribution,
      structure: config.context.structureContribution,
      confirmation: config.confirmation.contribution,
      displacementBase: config.displacement.contribution,
      pullbackBase: config.pullback.contribution,
      pullbackHeld: config.pullback.heldContribution,
      context: {
        opposingLiquidityThreshold: config.context.opposingLiquidityThreshold,
        opposingLiquidityBonus: config.context.opposingLiquidityBonus,
        volatilityThresholdAtpPct: config.context.volatilityThresholdAtpPct,
        volatilityPenalty: config.context.volatilityPenalty,
        conflictingStructurePenalty: config.context.conflictingStructurePenalty,
      },
      confluenceBonus: config.scoring.confluenceBonus,
      noConfirmationCap: config.scoring.noConfirmationCap,
    },
    scoreThresholds: {
      strong: config.scoring.strongThreshold,
      moderate: config.scoring.moderateThreshold,
      weak: config.scoring.weakThreshold,
    },
  }
}
