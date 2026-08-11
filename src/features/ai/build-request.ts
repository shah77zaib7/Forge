import type { Coin } from '@/features/markets/types'
import type { TimeframeAnalysis } from '@/features/markets/services/market-intelligence'
import type { Candle } from '@/features/markets/services/history'
import { assessSetupIntelligence, type SetupIntelligence } from '@/features/markets/services/setup-intelligence'
import type { MarketContextSnapshot } from '@/features/oracle/types'
import type { IntelligenceWindowId } from '@/features/markets/hooks/use-market-intelligence'
import type {
  OracleApiRequest,
  SuppliedLiquiditySnapshot,
  SuppliedSetupContext,
} from './types'

/**
 * Assembles the ONE normalized Oracle payload from the workspace state —
 * the same facts the Liquidity Snapshot, chart ladder and Setup card show.
 * Candles are capped defensively; Setup Intelligence is computed from the
 * real candles via the Step 10 engine when the caller did not supply it.
 */

/** Candle cap sent to the model — enough structure, small prompt. */
const MAX_CANDLES = 120

function snapshotFromMarketContext(snapshot: MarketContextSnapshot | null): SuppliedLiquiditySnapshot {
  if (!snapshot) {
    return {
      trend: null,
      structure: null,
      momentum: null,
      nearestBuy: null,
      nearestSell: null,
      support: null,
      resistance: null,
      zones: [],
      sweeps: [],
      granularity: 'unknown',
      source: 'unknown',
      unavailable: true,
      updatedAt: null,
    }
  }
  return {
    trend: snapshot.trend.toLowerCase(),
    structure: snapshot.structure.toLowerCase(),
    momentum: snapshot.momentum.toLowerCase(),
    nearestBuy: snapshot.buyLiquidity,
    nearestSell: snapshot.sellLiquidity,
    support: snapshot.support,
    resistance: snapshot.resistance,
    zones: snapshot.zones,
    sweeps: snapshot.sweeps,
    granularity: snapshot.granularity,
    source: snapshot.source,
    unavailable: snapshot.unavailable,
    updatedAt: snapshot.updatedAt,
  }
}

function setupFromEngine(setup: SetupIntelligence | null): SuppliedSetupContext | null {
  if (!setup || setup.status !== 'ready') return null
  return {
    family: setup.setupQuality.family,
    level: setup.setupQuality.level,
    score: setup.setupQuality.score,
    sweep: setup.sweep
      ? {
          direction: setup.sweep.direction,
          levelPrice: setup.sweep.levelPrice,
          returned: setup.sweep.returned,
        }
      : null,
    displacement: setup.displacement
      ? {
          direction: setup.displacement.direction,
          strength: setup.displacement.strength,
          rangeExpansion: setup.displacement.evidence.rangeExpansion,
          bodyRatio: setup.displacement.evidence.bodyRatio,
          directionalConsistency: setup.displacement.evidence.directionalConsistency,
        }
      : null,
    retracement: setup.retracement
      ? {
          depthPercent: setup.retracement.depthPercent,
          reaction: setup.retracement.reaction,
        }
      : null,
    confirmation: setup.confirmation
      ? {
          kind: setup.confirmation.kind,
          direction: setup.confirmation.direction,
        }
      : null,
    reasons: setup.setupQuality.reasons,
  }
}

export interface BuildOracleRequestInput {
  coin: Coin
  timeframeId: IntelligenceWindowId
  analysis: TimeframeAnalysis | null
  candles: Candle[] | null
  snapshot: MarketContextSnapshot | null
  /** Precomputed Setup Intelligence (from the same candles) — optional. */
  setupContext?: SuppliedSetupContext | null
  source: string
  freshness: string
  requestedAnalysis: string
  mode: 'trader' | 'teacher'
  responseDetail: string
}

export function buildOracleRequest(input: BuildOracleRequestInput): OracleApiRequest {
  const { coin, timeframeId, analysis, candles, snapshot, source, freshness } = input

  const sample = (candles ?? []).slice(-MAX_CANDLES).map((candle) => ({
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    ...(typeof candle.volume === 'number' ? { volume: candle.volume } : {}),
  }))

  let setupContext = input.setupContext ?? null
  if (!setupContext && analysis && candles && !analysis.insufficient) {
    // Compute the deterministic Step 10 read from the exact same candles —
    // one engine, one source of truth.
    const setup = assessSetupIntelligence(analysis, candles, coin.ticker, {})
    setupContext = setupFromEngine(setup)
  }

  return {
    model: 'local', // overridden by the caller with the active model id
    symbol: coin.ticker,
    timeframe: timeframeId,
    candles: sample,
    liquiditySnapshot: snapshotFromMarketContext(snapshot),
    setupContext,
    marketContext: {
      name: coin.name,
      ticker: coin.ticker,
      price: coin.price,
      change24h: coin.change24h ?? null,
      source,
      freshness,
    },
    userStrategyContext: {
      mode: input.mode,
      responseDetail: input.responseDetail,
    },
    requestedAnalysis: input.requestedAnalysis,
  }
}
