/**
 * Shared server-side Oracle types. These mirror the client's `ai/types.ts`
 * so the frontend payload and the normalized analysis travel the same
 * contract. Provider keys never appear here (or anywhere in this folder).
 */

/** A normalized OHLC candle as supplied by the client. */
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
  sweep: {
    direction: 'long' | 'short' | null
    levelPrice: number | null
    returned: boolean
  } | null
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

/** Everything the frontend sends to POST /api/oracle (action: 'analyze'). */
export interface OracleApiRequest {
  /** Workspace model id, e.g. 'claude-opus-5' | 'gemini' | 'local'. */
  model: string
  symbol: string
  /** Window id, e.g. '1H'. */
  timeframe: string
  /** Sampled recent candles (client caps the count). */
  candles: SuppliedCandle[]
  liquiditySnapshot: SuppliedLiquiditySnapshot
  /** Setup Intelligence from the same real candles. */
  setupContext: SuppliedSetupContext | null
  marketContext: {
    name: string
    ticker: string
    price: number
    change24h: number | null
    source: string
    freshness: string
  }
  userStrategyContext: {
    mode: 'trader' | 'teacher'
    responseDetail: string
  }
  requestedAnalysis: string
}

/** How Oracle explains the model's verdict for one setup family. */
export interface SetupVerdict {
  family: 'liquidity_sweep' | 'displacement' | 'confluence' | 'none'
  level: 'strong' | 'moderate' | 'weak' | 'none'
  direction: 'long' | 'short' | 'both' | null
  entryArea: string | null
  invalidation: string | null
}

/**
 * The normalized Oracle response — every provider returns this same shape.
 * The server STAMPS model/provider/sourceData itself from the request facts;
 * the model only fills interpretation fields, and cannot spoof the data
 * provenance.
 */
export interface OracleAnalysis {
  summary: string
  bias: 'bullish' | 'bearish' | 'neutral'
  setup: SetupVerdict
  liquidity: {
    nearestBuy: string | null
    nearestSell: string | null
    notes: string[]
  }
  displacement: {
    present: boolean
    direction: 'up' | 'down' | null
    strength: number | null
    notes: string[]
  }
  confirmation: {
    present: boolean
    kind: string | null
    description: string | null
  }
  invalidation: string | null
  /** Deterministic 0–100, NOT a win probability. */
  confidence: number
  risks: string[]
  reasoning: string[]
  /** Server-stamped provenance — never trusted from the model. */
  sourceData: {
    symbol: string
    timeframe: string
    source: string
    freshness: string
    candleCount: number
    dataComplete: boolean
    notes: string[]
  }
  /** Server-stamped — which model actually produced this read. */
  model: { id: string; provider: string; label: string }
  timestamp: number
}

/** Request/cost metadata — no keys, ever. */
export interface OracleRequestMeta {
  provider: string
  modelId: string
  latencyMs: number
  promptTokens: number | null
  completionTokens: number | null
  estimatedCostUsd: number | null
  success: boolean
}

/** The HTTP response body for a successful analyze call. */
export interface OracleApiResponse {
  ok: true
  analysis: OracleAnalysis
  meta: OracleRequestMeta
}

export type OracleApiErrorBody = {
  ok: false
  error: { code: string; message: string; detail?: string }
}
