import { OracleApiError } from './errors'
import type { OracleAnalysis, OracleApiRequest } from './types'

/**
 * Normalization of a provider's raw output into the shared OracleAnalysis
 * shape. The model fills only interpretation fields; provenance
 * (sourceData, model, timestamp) is ALWAYS stamped server-side from the
 * request facts, so a model can never claim data it was not given.
 */

/** Strip a single markdown code fence around a JSON payload. */
function stripFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

/** Index of the brace that balances the one at `start`, strings respected. */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Try progressively safer interpretations: pure JSON, fenced JSON, then a
 * balanced-brace scan that tolerates harmless surrounding text. Never
 * rewrites malformed JSON — returns the parse error for diagnostics.
 */
function firstParseableJson(text: string): { parsed: unknown } | { error: string } {
  const attempts = [text, stripFence(text)]
  let lastError: string | null = null
  for (const candidate of attempts) {
    try {
      return { parsed: JSON.parse(candidate) }
    } catch (cause) {
      lastError = String(cause)
    }
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    const end = findBalancedEnd(text, i)
    if (end === -1) continue
    const candidate = text.slice(i, end + 1)
    try {
      return { parsed: JSON.parse(candidate) }
    } catch (cause) {
      lastError = String(cause)
    }
  }
  return { error: lastError ?? 'No JSON object found in the response.' }
}

/**
 * Extract the model's JSON object — pure JSON, ```json fences, or JSON
 * embedded in harmless surrounding text. Malformed JSON is NEVER rewritten:
 * it throws bad_model_output carrying the exact parser error (with
 * position/line/column) so the underlying failure stays visible.
 */
export function extractJson(text: string): unknown {
  const trimmed = String(text).trim()
  if (trimmed.length === 0) {
    throw new OracleApiError('bad_model_output', 'The model returned an empty response.')
  }
  const result = firstParseableJson(trimmed)
  if ('parsed' in result) return result.parsed
  throw new OracleApiError('bad_model_output', 'The model returned malformed JSON.', result.error)
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

  // The one required interpretation field: the summary IS the analysis.
  // Never invent one — a response without it is a model failure.
  const summary = str(raw.summary)
  if (summary === null) {
    throw new OracleApiError(
      'bad_model_output',
      'The model response is missing the required "summary" field.',
    )
  }

  const setupRaw = (raw.setup ?? {}) as Record<string, unknown>
  const liquidityRaw = (raw.liquidity ?? {}) as Record<string, unknown>
  const displacementRaw = (raw.displacement ?? {}) as Record<string, unknown>
  const confirmationRaw = (raw.confirmation ?? {}) as Record<string, unknown>

  const snapshot = request.liquiditySnapshot
  const sweptZones = snapshot.zones.filter((zone) => zone.swept)

  // Interpretation fields (model-filled, defensively coerced):
  const analysis: OracleAnalysis = {
    summary,
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
