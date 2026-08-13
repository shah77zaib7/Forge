/**
 * The canonical Forge Market State — Forge V2's deterministic output shape.
 *
 * ONE engine (Forge V2) produces this state from real market data. Every
 * surface — Workspace UI, Oracle, Journal, Analytics, future AI models —
 * consumes this object instead of recomputing the methodology. Each group
 * carries its own score contribution and the measurable reasons behind it,
 * so the final score is fully traceable.
 */

import type { ForgeV2Config } from './config'
import type {
  LiquidityCandidate,
  StructureResult,
  SweepRecord,
  TimeframeAnalysis,
  TrendState,
} from '../market-intelligence'
import type {
  Confirmation,
  Displacement,
  Retracement,
  SetupDirection,
  SetupFamily,
  SetupLevel,
  SweepRead,
} from '../setup-intelligence'

/** One group's score contribution + the reasons that earned it. */
export interface GroupContribution {
  contribution: number
  reasons: string[]
}

/** The six traceable score contributions — sum ≈ the final score. */
export interface ScoreContributions {
  liquidity: number
  sweep: number
  displacement: number
  pullback: number
  confirmation: number
  context: number
}

export type ContextAlignment = 'aligned' | 'neutral' | 'conflicting'

export interface ForgeContext {
  structure: {
    trend: TrendState | null
    label: StructureResult['label'] | null
    aligned: boolean
  }
  opposingLiquidity: {
    side: 'buy' | 'sell' | null
    price: number | null
    distancePercent: number | null
  }
  volatility: {
    atrPercent: number | null
    elevated: boolean
  }
  contribution: number
  reasons: string[]
}

export interface ForgeScoring {
  total: number
  level: SetupLevel
  family: SetupFamily
  /** Traceable per-group contributions. */
  contributions: ScoreContributions
  /** The active configuration snapshot — full transparency. */
  configuration: ForgeV2Config
  reasons: string[]
  /** Explicitly missing/negative factors (no confirmation, no reclaim…). */
  missing: string[]
  /** Confluence bonus applied (family + bonus points), or null. */
  confluenceBonus: { family: SetupFamily; points: number } | null
  /** True when the no-confirmation cap clamped the score. */
  cappedByNoConfirmation: boolean
}

export interface ForgeSetup {
  direction: SetupDirection | null
  /** The precise level whose loss voids the setup, when determinable. */
  invalidation: string | null
  read: string
}

/**
 * The canonical market state. `analysis` is included for surfaces that need
 * raw zone/level detail; every *interpretation* (sweep read, displacement,
 * pullback, confirmation, context, score) is already computed here.
 */
export interface ForgeMarketState {
  engine: 'forge-v2'
  version: 2
  market: {
    asset: string
    timeframe: string
    candleGranularity: string
    candleCount: number
    currentPrice: number
    atr: number
  }
  liquidity: {
    buySide: LiquidityCandidate[]
    sellSide: LiquidityCandidate[]
    contribution: number
    reasons: string[]
  }
  sweeps: {
    records: SweepRecord[]
    read: SweepRead | null
    contribution: number
    reasons: string[]
  }
  displacement: GroupContribution & { read: Displacement | null }
  pullback: GroupContribution & { read: Retracement | null }
  confirmation: GroupContribution & {
    read: Confirmation | null
    /** Which candle series produced the confirmation (e.g. '1m'). */
    timeframe: string
  }
  context: ForgeContext
  scoring: ForgeScoring
  setup: ForgeSetup
  /** The TimeframeAnalysis this state was built from (raw facts layer). */
  analysis: TimeframeAnalysis
  metadata: {
    configVersion: number
    computedAt: number
  }
}
