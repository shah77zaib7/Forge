/**
 * Client-side Oracle AI types. These mirror the server contract in
 * `api/oracle/lib/types.ts` — the client builds the payload, the server
 * validates and stamps provenance. Provider keys never exist on the client.
 */

export type AiModelId = 'local' | 'claude-opus-5' | 'claude-opus-4-8' | 'gpt-5-6' | 'gemini' | 'agentrouter'

export interface AiModelInfo {
  id: AiModelId
  label: string
  provider: string
  providerLabel: string
  description: string
}

/** One candle sent to the server. */
export interface SuppliedCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface SuppliedZone {
  side: 'buy' | 'sell'
  price: number
  zoneLow: number
  zoneHigh: number
  source: string
  rank: string
  strength: number
  touches: number
  swept: boolean
  distancePercent: number
}

export interface SuppliedSweep {
  side: 'buy' | 'sell'
  direction: 'up' | 'down'
  sweepPrice: number
  returned: boolean
}

/** The deterministic Liquidity Model read — supplied facts, not guesses. */
export interface SuppliedLiquiditySnapshot {
  trend: string | null
  structure: string | null
  momentum: string | null
  nearestBuy: string | null
  nearestSell: string | null
  support: string | null
  resistance: string | null
  zones: SuppliedZone[]
  sweeps: SuppliedSweep[]
  granularity: string
  source: string
  unavailable: boolean
  updatedAt: number | null
}

/** The Step 10 Setup Intelligence read — also supplied facts. */
export interface SuppliedSetupContext {
  family: 'liquidity_sweep' | 'displacement' | 'confluence' | 'none'
  level: 'strong' | 'moderate' | 'weak' | 'none'
  score: number
  sweep: { direction: 'long' | 'short' | null; levelPrice: number | null; returned: boolean } | null
  displacement: {
    direction: 'up' | 'down' | null
    strength: number
    rangeExpansion: number
    bodyRatio: number
    directionalConsistency: number
  } | null
  retracement: { depthPercent: number; reaction: 'held' | 'broke' | 'none' } | null
  confirmation: { kind: string; direction: 'long' | 'short' | null } | null
  reasons: string[]
}

/** Everything sent to POST /api/oracle (action: 'analyze'). */
export interface OracleApiRequest {
  model: string
  symbol: string
  timeframe: string
  candles: SuppliedCandle[]
  liquiditySnapshot: SuppliedLiquiditySnapshot
  setupContext: SuppliedSetupContext | null
  marketContext: {
    name: string
    ticker: string
    price: number
    change24h: number | null
    source: string
    freshness: string
  }
  userStrategyContext: { mode: 'trader' | 'teacher'; responseDetail: string }
  requestedAnalysis: string
}

export interface SetupVerdict {
  family: 'liquidity_sweep' | 'displacement' | 'confluence' | 'none'
  level: 'strong' | 'moderate' | 'weak' | 'none'
  direction: 'long' | 'short' | 'both' | null
  entryArea: string | null
  invalidation: string | null
}

/** The normalized Oracle analysis — every provider returns this shape. */
export interface OracleAnalysis {
  summary: string
  bias: 'bullish' | 'bearish' | 'neutral'
  setup: SetupVerdict
  liquidity: { nearestBuy: string | null; nearestSell: string | null; notes: string[] }
  displacement: { present: boolean; direction: 'up' | 'down' | null; strength: number | null; notes: string[] }
  confirmation: { present: boolean; kind: string | null; description: string | null }
  invalidation: string | null
  confidence: number
  risks: string[]
  reasoning: string[]
  sourceData: {
    symbol: string
    timeframe: string
    source: string
    freshness: string
    candleCount: number
    dataComplete: boolean
    notes: string[]
  }
  model: { id: string; provider: string; label: string }
  timestamp: number
}

export interface OracleRequestMeta {
  provider: string
  modelId: string
  latencyMs: number
  promptTokens: number | null
  completionTokens: number | null
  estimatedCostUsd: number | null
  success: boolean
}

export interface OracleApiResponse {
  ok: true
  analysis: OracleAnalysis
  meta: OracleRequestMeta
}

export interface OracleApiErrorBody {
  ok: false
  error: { code: string; message: string; detail?: string }
}

/** The availability report from GET /api/oracle (or POST action: 'models'). */
export interface OracleModelAvailability {
  models: Array<{
    id: string
    label: string
    provider: string
    providerLabel: string
    description: string
    available: boolean
    requires: string[]
    gateway: string | null
  }>
}
