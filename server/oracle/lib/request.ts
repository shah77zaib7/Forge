import { OracleApiError } from './errors'
import type {
  OracleApiRequest,
  SuppliedCandle,
  SuppliedLiquiditySnapshot,
  SuppliedSetupContext,
  SuppliedSweep,
  SuppliedZone,
} from './types'

/**
 * Request validation/sanitization for the Oracle endpoint. This is an
 * INTERNAL module — it lives outside `api/` on purpose so Vercel never
 * treats it as a Serverless Function entry point (every file under `api/`
 * would become its own function and blow the Hobby plan limit).
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

function v2Field(value: unknown): SuppliedSetupContext['v2'] {
  if (typeof value !== 'object' || value === null) return null
  const v2 = value as Record<string, unknown>
  const contributionsRaw = (typeof v2.contributions === 'object' && v2.contributions !== null ? v2.contributions : {}) as Record<string, unknown>
  const num = (n: unknown): number => (isFiniteNumber(n) ? n : 0)
  const contextRaw = (typeof v2.context === 'object' && v2.context !== null ? v2.context : {}) as Record<string, unknown>
  const structureRaw = (typeof contextRaw.structure === 'object' && contextRaw.structure !== null ? contextRaw.structure : {}) as Record<string, unknown>
  const opposingRaw = (typeof contextRaw.opposingLiquidity === 'object' && contextRaw.opposingLiquidity !== null ? contextRaw.opposingLiquidity : {}) as Record<string, unknown>
  const volatilityRaw = (typeof contextRaw.volatility === 'object' && contextRaw.volatility !== null ? contextRaw.volatility : {}) as Record<string, unknown>
  const confluence = (typeof v2.confluenceBonus === 'object' && v2.confluenceBonus !== null ? v2.confluenceBonus : null) as Record<string, unknown> | null
  return {
    engine: strField(v2.engine, 40) ?? 'forge-v2',
    version: num(v2.version),
    contributions: {
      liquidity: num(contributionsRaw.liquidity),
      sweep: num(contributionsRaw.sweep),
      displacement: num(contributionsRaw.displacement),
      pullback: num(contributionsRaw.pullback),
      confirmation: num(contributionsRaw.confirmation),
      context: num(contributionsRaw.context),
    },
    missing: Array.isArray(v2.missing) ? v2.missing.filter((r): r is string => typeof r === 'string' && r.length > 0).slice(0, 12) : [],
    confluenceBonus: confluence ? { family: strField(confluence.family, 40) ?? 'none', points: num(confluence.points) } : null,
    cappedByNoConfirmation: Boolean(v2.cappedByNoConfirmation),
    context: {
      structure: {
        trend: strField(structureRaw.trend, 40),
        label: strField(structureRaw.label, 40),
        aligned: Boolean(structureRaw.aligned),
      },
      opposingLiquidity: {
        side: opposingRaw.side === 'buy' || opposingRaw.side === 'sell' ? opposingRaw.side : null,
        price: isFiniteNumber(opposingRaw.price) ? opposingRaw.price : null,
        distancePercent: isFiniteNumber(opposingRaw.distancePercent) ? opposingRaw.distancePercent : null,
      },
      volatility: {
        atrPercent: isFiniteNumber(volatilityRaw.atrPercent) ? volatilityRaw.atrPercent : null,
        elevated: Boolean(volatilityRaw.elevated),
      },
    },
    invalidation: strField(v2.invalidation, 240),
    setupRead: strField(v2.setupRead, 1000) ?? '',
    configVersion: num(v2.configVersion),
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
          timeframe: strField(confirmation.timeframe, 8) ?? '1m',
        }
      : null,
    reasons: Array.isArray(setup.reasons) ? setup.reasons.filter((r): r is string => typeof r === 'string' && r.length > 0).slice(0, 12) : [],
    v2: v2Field(setup.v2),
  }
}

/** Validate + sanitize the raw body into the typed request. Throws 400. */
export function sanitizeRequest(body: unknown): OracleApiRequest {
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
