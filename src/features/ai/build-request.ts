import type { Coin } from '@/features/markets/types'
import type { TimeframeAnalysis } from '@/features/markets/services/market-intelligence'
import type { Candle } from '@/features/markets/services/history'
import { analyzeForgeV2 } from '@/features/markets/services/forge-v2/engine'
import type { V2ConfigPatch } from '@/features/markets/services/forge-v2/config'
import type { ForgeMarketState } from '@/features/markets/services/forge-v2/types'
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

/** The canonical Forge V2 state → the supplied setup context (V2 shape). */
function setupFromForgeState(state: ForgeMarketState): SuppliedSetupContext {
  const q = state.scoring
  const confirmation = state.confirmation.read
  return {
    family: q.family,
    level: q.level,
    score: q.total,
    sweep: state.sweeps.read
      ? {
          direction: state.sweeps.read.direction,
          levelPrice: state.sweeps.read.levelPrice,
          returned: state.sweeps.read.returned,
        }
      : null,
    displacement: state.displacement.read
      ? {
          direction: state.displacement.read.direction === 'up' ? 'up' : 'down',
          strength: state.displacement.read.strength,
          rangeExpansion: state.displacement.read.evidence.rangeExpansion,
          bodyRatio: state.displacement.read.evidence.bodyRatio,
          directionalConsistency: state.displacement.read.evidence.directionalConsistency,
        }
      : null,
    retracement: state.pullback.read
      ? {
          depthPercent: state.pullback.read.depthPercent,
          reaction: state.pullback.read.reaction,
        }
      : null,
    confirmation: confirmation
      ? { kind: confirmation.kind, direction: confirmation.direction, timeframe: state.confirmation.timeframe }
      : null,
    reasons: q.reasons,
    v2: {
      engine: state.engine,
      version: state.version,
      contributions: q.contributions,
      missing: q.missing,
      confluenceBonus: q.confluenceBonus,
      cappedByNoConfirmation: q.cappedByNoConfirmation,
      context: {
        structure: state.context.structure,
        opposingLiquidity: state.context.opposingLiquidity,
        volatility: state.context.volatility,
      },
      invalidation: state.setup.invalidation,
      setupRead: state.setup.read,
      configVersion: state.metadata.configVersion,
    },
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
  /** Canonical Forge V2 state — takes precedence when supplied. */
  forgeState?: ForgeMarketState | null
  /** Active V2 config — used when the canonical state must be computed here. */
  v2Config?: V2ConfigPatch | null
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
    // The canonical V2 state is the source of truth — computed from the
    // exact same candles through the SAME engine as the Workspace card, so
    // Oracle and UI can never disagree. Falls back to the V1-shape read
    // only when the V2 engine has no usable data.
    if (input.forgeState) {
      setupContext = setupFromForgeState(input.forgeState)
    } else {
      const state = analyzeForgeV2({
        asset: coin.ticker,
        timeframe: timeframeId,
        analysis,
        candles,
        config: input.v2Config ?? undefined,
      })
      setupContext = setupFromForgeState(state)
    }
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
