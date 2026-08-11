import type { VercelRequest, VercelResponse } from '@vercel/node'

import { OracleApiError, statusForCode } from './lib/errors'
import { routeAnalysis } from './lib/router'
import type {
  OracleApiErrorBody,
  OracleApiRequest,
  OracleApiResponse,
  SuppliedCandle,
  SuppliedLiquiditySnapshot,
  SuppliedSetupContext,
  SuppliedSweep,
  SuppliedZone,
} from './lib/types'

/**
 * POST /api/oracle/analyze — the unified Oracle interface.
 *
 * The frontend sends ONE normalized analysis payload; the router decides
 * which provider/model processes it and returns the normalized analysis.
 * Provider keys live in server env vars only and never appear in any
 * response. Every failure returns a typed { ok:false, error } body with a
 * code the UI can render honestly (unknown_model, not_configured,
 * provider_error, rate_limit, timeout, bad_model_output, bad_request).
 */

/** Server-side validation caps — the client sends far less. */
const MAX_CANDLES = 250
const MAX_TEXT = 4000
const MAX_SYMBOL = 40

/* ------------------------------------------------------------------ */
/* Field coercers — every input is defensively validated so a malformed  */
/* payload can never reach the model or crash the function.             */
/* ------------------------------------------------------------------ */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function strField(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function candleField(value: unknown): SuppliedCandle | null {
  if (typeof value !== 'object' || value === null) return null
  const candle = value as Record<string, unknown>
  if (
    !isFiniteNumber(candle.timestamp) ||
    !isFiniteNumber(candle.open) ||
    !isFiniteNumber(candle.high) ||
    !isFiniteNumber(candle.low) ||
    !isFiniteNumber(candle.close)
  ) {
    return null
  }
  return {
    timestamp: candle.timestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    ...(isFiniteNumber(candle.volume) ? { volume: candle.volume } : {}),
  }
}

function zoneField(value: unknown): SuppliedZone | null {
  if (typeof value !== 'object' || value === null) return null
  const zone = value as Record<string, unknown>
  if (
    (zone.side !== 'buy' && zone.side !== 'sell') ||
    !isFiniteNumber(zone.price) ||
    !isFiniteNumber(zone.zoneLow) ||
    !isFiniteNumber(zone.zoneHigh)
  ) {
    return null
  }
  return {
    side: zone.side,
    price: zone.price,
    zoneLow: zone.zoneLow,
    zoneHigh: zone.zoneHigh,
    source: strField(zone.source, 80) ?? 'unknown',
    rank: strField(zone.rank, 40) ?? 'unknown',
    strength: isFiniteNumber(zone.strength) ? zone.strength : 0,
    touches: isFiniteNumber(zone.touches) ? zone.touches : 0,
    swept: Boolean(zone.swept),
    distancePercent: isFiniteNumber(zone.distancePercent) ? zone.distancePercent : 0,
  }
}

function sweepField(value: unknown): SuppliedSweep | null {
  if (typeof value !== 'object' || value === null) return null
  const sweep = value as Record<string, unknown>
  if (
    (sweep.side !== 'buy' && sweep.side !== 'sell') ||
    (sweep.direction !== 'up' && sweep.direction !== 'down') ||
    !isFiniteNumber(sweep.sweepPrice)
  ) {
    return null
  }
  return { side: sweep.side, direction: sweep.direction, sweepPrice: sweep.sweepPrice, returned: Boolean(sweep.returned) }
}

function snapshotField(value: unknown): SuppliedLiquiditySnapshot {
  const snapshot = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const zones = Array.isArray(snapshot.zones) ? snapshot.zones.map(zoneField).filter((z): z is SuppliedZone => z !== null) : []
  const sweeps = Array.isArray(snapshot.sweeps)
    ? snapshot.sweeps.map(sweepField).filter((s): s is SuppliedSweep => s !== null)
    : []
  return {
    trend: strField(snapshot.trend, 80),
    structure: strField(snapshot.structure, 80),
    momentum: strField(snapshot.momentum, 80),
    nearestBuy: strField(snapshot.nearestBuy, 80),
    nearestSell: strField(snapshot.nearestSell, 80),
    support: strField(snapshot.support, 80),
    resistance: strField(snapshot.resistance, 80),
    zones,
    sweeps,
    granularity: strField(snapshot.granularity, 20) ?? 'unknown',
    source: strField(snapshot.source, 80) ?? 'unknown',
    unavailable: Boolean(snapshot.unavailable),
    updatedAt: isFiniteNumber(snapshot.updatedAt) ? snapshot.updatedAt : null,
  }
}

function setupField(value: unknown): SuppliedSetupContext | null {
  if (typeof value !== 'object' || value === null) return null
  const setup = value as Record<string, unknown>
  const family = setup.family === 'liquidity_sweep' || setup.family === 'displacement' || setup.family === 'confluence' ? setup.family : 'none'
  const level = setup.level === 'strong' || setup.level === 'moderate' || setup.level === 'weak' ? setup.level : 'none'
  const sweep = (typeof setup.sweep === 'object' && setup.sweep !== null ? setup.sweep : null) as Record<string, unknown> | null
  const displacement = (typeof setup.displacement === 'object' && setup.displacement !== null ? setup.displacement : null) as Record<string, unknown> | null
  const retracement = (typeof setup.retracement === 'object' && setup.retracement !== null ? setup.retracement : null) as Record<string, unknown> | null
  const confirmation = (typeof setup.confirmation === 'object' && setup.confirmation !== null ? setup.confirmation : null) as Record<string, unknown> | null
  return {
    family,
    level,
    score: isFiniteNumber(setup.score) ? Math.min(100, Math.max(0, setup.score)) : 0,
    sweep: sweep
      ? {
          direction: sweep.direction === 'long' || sweep.direction === 'short' ? sweep.direction : null,
          levelPrice: isFiniteNumber(sweep.levelPrice) ? sweep.levelPrice : null,
          returned: Boolean(sweep.returned),
        }
      : null,
    displacement: displacement
      ? {
          direction: displacement.direction === 'up' || displacement.direction === 'down' ? displacement.direction : null,
          strength: isFiniteNumber(displacement.strength) ? displacement.strength : 0,
          rangeExpansion: isFiniteNumber(displacement.rangeExpansion) ? displacement.rangeExpansion : 0,
          bodyRatio: isFiniteNumber(displacement.bodyRatio) ? displacement.bodyRatio : 0,
          directionalConsistency: isFiniteNumber(displacement.directionalConsistency) ? displacement.directionalConsistency : 0,
        }
      : null,
    retracement: retracement
      ? {
          depthPercent: isFiniteNumber(retracement.depthPercent) ? retracement.depthPercent : 0,
          reaction: retracement.reaction === 'held' || retracement.reaction === 'broke' ? retracement.reaction : 'none',
        }
      : null,
    confirmation: confirmation
      ? {
          kind: strField(confirmation.kind, 40) ?? 'unknown',
          direction: confirmation.direction === 'long' || confirmation.direction === 'short' ? confirmation.direction : null,
        }
      : null,
    reasons: Array.isArray(setup.reasons) ? setup.reasons.filter((r): r is string => typeof r === 'string' && r.length > 0).slice(0, 12) : [],
  }
}

/** Validate + sanitize the raw body into the typed request. Throws 400. */
function sanitizeRequest(body: unknown): OracleApiRequest {
  if (typeof body !== 'object' || body === null) {
    throw new OracleApiError('bad_request', 'Request body must be a JSON object.')
  }
  const raw = body as Record<string, unknown>

  const model = strField(raw.model, 40)
  const symbol = strField(raw.symbol, MAX_SYMBOL)
  const timeframe = strField(raw.timeframe, 8)
  const requestedAnalysis = strField(raw.requestedAnalysis)
  if (!model || !symbol || !timeframe || !requestedAnalysis) {
    throw new OracleApiError('bad_request', 'Missing required fields: model, symbol, timeframe, requestedAnalysis.')
  }

  const candles: SuppliedCandle[] = []
  if (Array.isArray(raw.candles)) {
    for (const item of raw.candles.slice(-MAX_CANDLES)) {
      const candle = candleField(item)
      if (candle) candles.push(candle)
    }
  }

  const market = (typeof raw.marketContext === 'object' && raw.marketContext !== null ? raw.marketContext : {}) as Record<string, unknown>
  const price = isFiniteNumber(market.price) ? market.price : null
  if (price === null) {
    throw new OracleApiError('bad_request', 'marketContext.price must be a finite number.')
  }

  const strategy = (typeof raw.userStrategyContext === 'object' && raw.userStrategyContext !== null ? raw.userStrategyContext : {}) as Record<string, unknown>

  return {
    model,
    symbol,
    timeframe,
    candles,
    liquiditySnapshot: snapshotField(raw.liquiditySnapshot),
    setupContext: setupField(raw.setupContext),
    marketContext: {
      name: strField(market.name, 80) ?? symbol,
      ticker: strField(market.ticker, 40) ?? symbol,
      price,
      change24h: isFiniteNumber(market.change24h) ? market.change24h : null,
      source: strField(market.source, 80) ?? 'unknown',
      freshness: strField(market.freshness, 20) ?? 'unknown',
    },
    userStrategyContext: {
      mode: strategy.mode === 'teacher' ? 'teacher' : 'trader',
      responseDetail: strField(strategy.responseDetail, 80) ?? 'default',
    },
    requestedAnalysis,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: { code: 'method_not_allowed', message: 'Use POST.' } } satisfies OracleApiErrorBody)
    return
  }

  let request: OracleApiRequest
  try {
    request = sanitizeRequest(req.body)
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      res.status(statusForCode(cause.code)).json({ ok: false, error: { code: cause.code, message: cause.message, detail: cause.detail } } satisfies OracleApiErrorBody)
      return
    }
    res.status(400).json({ ok: false, error: { code: 'bad_request', message: 'Could not read the request body.' } } satisfies OracleApiErrorBody)
    return
  }

  try {
    // Bounded end-to-end: the router's providers merge their own timeout
    // with the function's remaining budget signal.
    const signal = AbortSignal.timeout(55_000)
    const { analysis, meta } = await routeAnalysis(request, process.env, signal)
    res.status(200).json({ ok: true, analysis, meta } satisfies OracleApiResponse)
  } catch (cause) {
    if (cause instanceof OracleApiError) {
      res.status(statusForCode(cause.code)).json({ ok: false, error: { code: cause.code, message: cause.message, detail: cause.detail } } satisfies OracleApiErrorBody)
      return
    }
    // Unknown server-side failure — honest 500, no details that could leak.
    res.status(500).json({ ok: false, error: { code: 'service_unavailable', message: 'Oracle could not complete the analysis.' } } satisfies OracleApiErrorBody)
  }
}
