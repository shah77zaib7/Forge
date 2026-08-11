import { OracleApiError } from './errors'
import type { OracleAnalysis, OracleApiRequest } from './types'

/**
 * Normalization of a provider's raw output into the shared OracleAnalysis
 * shape. The model fills only interpretation fields; provenance
 * (sourceData, model, timestamp) is ALWAYS stamped server-side from the
 * request facts, so a model can never claim data it was not given.
 */

/** Strip markdown fences and extract the first balanced JSON object. */
export function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new OracleApiError('bad_model_output', 'The model did not return a JSON object.')
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch (cause) {
    throw new OracleApiError('bad_model_output', 'The model returned malformed JSON.', String(cause))
  }
}

/** Coerce an unknown value to a finite number within [min, max], else fallback. */
function clampNumber(value: unknown, fallback: number, min = 0, max = 100): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** Coerce an unknown value to a string|null (null for anything unusable). */
function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Coerce an unknown value to a non-empty string array (unknown → []). */
function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function pickBias(value: unknown): 'bullish' | 'bearish' | 'neutral' {
  return value === 'bullish' || value === 'bearish' ? value : 'neutral'
}

function pickFamily(value: unknown): 'liquidity_sweep' | 'displacement' | 'confluence' | 'none' {
  return value === 'liquidity_sweep' || value === 'displacement' || value === 'confluence' ? value : 'none'
}

function pickLevel(value: unknown): 'strong' | 'moderate' | 'weak' | 'none' {
  return value === 'strong' || value === 'moderate' || value === 'weak' ? value : 'none'
}

function pickDirection(value: unknown): 'up' | 'down' | null {
  return value === 'up' || value === 'down' ? value : null
}

function pickTradeDirection(value: unknown): 'long' | 'short' | 'both' | null {
  return value === 'long' || value === 'short' || value === 'both' ? value : null
}

function pickConfirmationKind(value: unknown): string | null {
  const kind = str(value)
  return kind && /^(engulfing|rejection|continuation|structure_reclaim)$/.test(kind) ? kind : null
}

/**
 * Normalize the raw model output. Throws OracleApiError('bad_model_output')
 * when the payload cannot be parsed; every other field is coerced
 * defensively so one bad field never 500s the request.
 */
export function normalizeAnalysis(
  rawText: string,
  request: OracleApiRequest,
  model: { id: string; provider: string; label: string },
  now = Date.now(),
): OracleAnalysis {
  const parsed = extractJson(rawText)
  if (parsed === null || typeof parsed !== 'object') {
    throw new OracleApiError('bad_model_output', 'The model returned an empty response.')
  }
  const raw = parsed as Record<string, unknown>

  const setupRaw = (raw.setup ?? {}) as Record<string, unknown>
  const liquidityRaw = (raw.liquidity ?? {}) as Record<string, unknown>
  const displacementRaw = (raw.displacement ?? {}) as Record<string, unknown>
  const confirmationRaw = (raw.confirmation ?? {}) as Record<string, unknown>

  const snapshot = request.liquiditySnapshot
  const sweptZones = snapshot.zones.filter((zone) => zone.swept)

  // Interpretation fields (model-filled, defensively coerced):
  const analysis: OracleAnalysis = {
    summary: str(raw.summary) ?? 'Analysis unavailable for this window.',
    bias: pickBias(raw.bias),
    setup: {
      family: pickFamily(setupRaw.family),
      level: pickLevel(setupRaw.level),
      direction: pickTradeDirection(setupRaw.direction),
      entryArea: str(setupRaw.entryArea),
      invalidation: str(setupRaw.invalidation),
    },
    liquidity: {
      nearestBuy: str(liquidityRaw.nearestBuy),
      nearestSell: str(liquidityRaw.nearestSell),
      notes: strArray(liquidityRaw.notes),
    },
    displacement: {
      present: Boolean(displacementRaw.present),
      direction: pickDirection(displacementRaw.direction),
      strength: displacementRaw.strength === null ? null : clampNumber(displacementRaw.strength, 0),
      notes: strArray(displacementRaw.notes),
    },
    confirmation: {
      present: Boolean(confirmationRaw.present),
      kind: pickConfirmationKind(confirmationRaw.kind),
      description: str(confirmationRaw.description),
    },
    invalidation: str(raw.invalidation),
    // Read confidence — a clamp on 0–100, never a win probability.
    confidence: Math.round(clampNumber(raw.confidence, 50)),
    risks: strArray(raw.risks),
    reasoning: strArray(raw.reasoning),
    // Provenance — server-stamped, never trusted from the model:
    sourceData: {
      symbol: request.symbol,
      timeframe: request.timeframe,
      source: snapshot.source,
      freshness: request.marketContext.freshness,
      candleCount: request.candles.length,
      dataComplete: !snapshot.unavailable && request.candles.length > 0,
      notes: buildSourceNotes(request, sweptZones),
    },
    model: { id: model.id, provider: model.provider, label: model.label },
    timestamp: now,
  }

  return analysis
}

/** Honest notes about the supplied data — what the model could and could not see. */
function buildSourceNotes(request: OracleApiRequest, sweptZones: Array<{ swept: boolean }>): string[] {
  const notes: string[] = []
  if (request.liquiditySnapshot.unavailable) notes.push('Liquidity analysis unavailable for this window.')
  if (request.candles.length === 0) notes.push('No candles were supplied for this window.')
  if (request.marketContext.freshness !== 'live') {
    notes.push(`Data freshness is '${request.marketContext.freshness}', not live.`)
  }
  if (request.liquiditySnapshot.zones.length === 0) {
    notes.push('No liquidity zones detected in the supplied candles.')
  } else if (sweptZones.length === 0) {
    notes.push('No detected liquidity zones were swept in this window.')
  }
  return notes
}
