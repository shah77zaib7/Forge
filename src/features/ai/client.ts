import type { OracleAnalysis, OracleApiRequest, OracleApiResponse, OracleRequestMeta } from './types'

/**
 * The Oracle API client — the ONLY frontend path to the single Oracle
 * Serverless Function (POST /api/oracle with { action: 'analyze' }).
 * Typed failures surface honestly (network / rate_limit / not_configured /
 * provider_error / bad_model_output…). `localAnalysis` is the deterministic
 * Local engine fallback: it produces the SAME normalized analysis shape from
 * the supplied facts, so the app is fully functional with zero keys while
 * the server models remain honest unavailable states until configured.
 */

export class OracleClientError extends Error {
  readonly code: string
  readonly detail?: string

  constructor(code: string, message: string, detail?: string) {
    super(message)
    this.name = 'OracleClientError'
    this.code = code
    this.detail = detail
  }
}

const REQUEST_TIMEOUT_MS = 30_000

/** POST one normalized analysis request to the server router. */
export async function callOracle(
  request: OracleApiRequest,
  signal?: AbortSignal,
): Promise<OracleApiResponse> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch('/api/oracle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'analyze', ...request }),
      signal: controller.signal,
    })
    const body = (await response.json().catch(() => null)) as
      | OracleApiResponse
      | { ok: false; error?: { code?: string; message?: string; detail?: string } }
      | null

    if (!response.ok || !body || body.ok !== true) {
      const error = (body as { error?: { code?: string; message?: string; detail?: string } } | null)?.error
      throw new OracleClientError(
        error?.code ?? 'service_unavailable',
        error?.message ?? 'Oracle could not complete the analysis.',
        error?.detail,
      )
    }
    return body
  } catch (cause) {
    if (cause instanceof OracleClientError) throw cause
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new OracleClientError('timeout', 'Oracle timed out. Please retry.')
    }
    throw new OracleClientError(
      'network',
      'Could not reach the Oracle service.',
      cause instanceof Error ? cause.message : undefined,
    )
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/* ------------------------------------------------------------------ */
/* Local engine — deterministic analysis from the supplied facts        */
/* ------------------------------------------------------------------ */

function biasFromTrend(trend: string | null): OracleAnalysis['bias'] {
  if (trend === 'bullish' || trend === 'Bullish') return 'bullish'
  if (trend === 'bearish' || trend === 'Bearish') return 'bearish'
  return 'neutral'
}

/**
 * The deterministic Local engine — reads the SAME Liquidity Model +
 * Setup Intelligence facts the server would receive and renders a
 * normalized analysis with server-shaped provenance. No AI, no invented
 * levels: every number traces to the supplied snapshot/setup.
 */
export function localAnalysis(request: OracleApiRequest): OracleApiResponse {
  const { liquiditySnapshot: snapshot, setupContext } = request
  const trend = biasFromTrend(snapshot.trend)
  const family = setupContext?.family ?? 'none'

  const familyLine =
    family === 'none'
      ? 'No setup is forming in this window — neither family has enough evidence.'
      : family === 'confluence'
        ? 'A higher-confluence setup is forming: both the liquidity-sweep and displacement families show evidence.'
        : family === 'liquidity_sweep'
          ? 'A liquidity-sweep setup is forming.'
          : 'A displacement setup is forming.'

  const sweepLine = setupContext?.sweep
    ? setupContext.sweep.returned
      ? `Price swept ${setupContext.sweep.direction === 'short' ? 'buy-side' : 'sell-side'} liquidity at ${setupContext.sweep.levelPrice?.toFixed(2) ?? 'the level'} and reclaimed it.`
      : `Price swept ${setupContext.sweep.direction === 'short' ? 'buy-side' : 'sell-side'} liquidity at ${setupContext.sweep.levelPrice?.toFixed(2) ?? 'the level'} but has not reclaimed it yet.`
    : null

  const summary = [
    `${request.marketContext.name} reads ${snapshot.trend ?? 'sideways'} on the ${request.timeframe} window (${request.marketContext.source}).`,
    snapshot.nearestBuy ? `Nearest buy-side liquidity sits at ${snapshot.nearestBuy}.` : null,
    snapshot.nearestSell ? `Nearest sell-side liquidity sits at ${snapshot.nearestSell}.` : null,
    sweepLine,
    familyLine,
  ]
    .filter(Boolean)
    .join(' ')

  const notes: string[] = snapshot.zones.slice(0, 4).map(
    (zone) =>
      `${zone.side === 'buy' ? 'Buy-side' : 'Sell-side'} ${zone.source.replace(/_/g, ' ')} at ${zone.price.toFixed(2)} · ${zone.rank} rank · ${zone.touches} touch${zone.touches === 1 ? '' : 'es'} · ${zone.swept ? 'swept' : 'active'}`,
  )

  const reasoning: string[] = [
    `Trend: ${snapshot.trend ?? 'unavailable'} · structure: ${snapshot.structure ?? 'unavailable'} · momentum: ${snapshot.momentum ?? 'unavailable'}`,
    ...(snapshot.zones.length > 0
      ? [`${snapshot.zones.length} liquidity zone${snapshot.zones.length === 1 ? '' : 's'} detected from real candles.`]
      : ['No liquidity zones detected in this window.']),
    ...(snapshot.sweeps.length > 0
      ? snapshot.sweeps.map(
          (sweep) => `${sweep.side === 'buy' ? 'Buy-side' : 'Sell-side'} swept at ${sweep.sweepPrice.toFixed(2)}${sweep.returned ? ' with a return through the level' : ''}.`,
        )
      : []),
    ...(setupContext?.reasons ?? []),
  ].slice(0, 8)

  const risks: string[] = [
    `Data freshness is '${request.marketContext.freshness}' — ${request.marketContext.freshness === 'live' ? 'live' : 'not live'}.`,
    ...(snapshot.sweeps.some((sweep) => !sweep.returned)
      ? ['A sweep has not reclaimed its level — price may retest before confirming.']
      : []),
    'This is a deterministic read of supplied OHLC, not a price prediction.',
  ]

  const setup = setupContext
    ? {
        family: setupContext.family,
        level: setupContext.level,
        direction: (setupContext.sweep?.direction ?? null) as OracleAnalysis['setup']['direction'],
        entryArea: setupContext.retracement
          ? `After a retracement of ${Math.round(setupContext.retracement.depthPercent * 100)}% of the move`
          : null,
        invalidation: setupContext.sweep?.levelPrice
          ? `A close beyond ${setupContext.sweep.levelPrice.toFixed(2)} voids the read`
          : null,
      }
    : { family: 'none' as const, level: 'none' as const, direction: null, entryArea: null, invalidation: null }

  const analysis: OracleAnalysis = {
    summary,
    bias: trend,
    setup,
    liquidity: {
      nearestBuy: snapshot.nearestBuy,
      nearestSell: snapshot.nearestSell,
      notes,
    },
    displacement: {
      present: Boolean(setupContext?.displacement),
      direction: setupContext?.displacement?.direction ?? null,
      strength: setupContext?.displacement?.strength ?? null,
      notes: setupContext?.displacement
        ? [
            `Range expansion ${setupContext.displacement.rangeExpansion.toFixed(1)}× · body ${Math.round(setupContext.displacement.bodyRatio * 100)}% · consistency ${Math.round(setupContext.displacement.directionalConsistency * 100)}%`,
          ]
        : [],
    },
    confirmation: {
      present: Boolean(setupContext?.confirmation),
      kind: setupContext?.confirmation?.kind ?? null,
      description: setupContext?.confirmation
        ? `${setupContext.confirmation.kind.replace(/_/g, ' ')} candle in the ${setupContext.confirmation.direction} direction`
        : null,
    },
    invalidation: setup.invalidation,
    confidence: Math.round(setupContext?.score ?? 0),
    risks,
    reasoning,
    sourceData: {
      symbol: request.symbol,
      timeframe: request.timeframe,
      source: snapshot.source,
      freshness: request.marketContext.freshness,
      candleCount: request.candles.length,
      dataComplete: !snapshot.unavailable && request.candles.length > 0,
      notes: snapshot.unavailable
        ? ['Liquidity analysis unavailable for this window.']
        : request.marketContext.freshness !== 'live'
          ? [`Data freshness is '${request.marketContext.freshness}', not live.`]
          : [],
    },
    model: { id: 'local', provider: 'local', label: 'Local engine' },
    timestamp: Date.now(),
  }

  const meta: OracleRequestMeta = {
    provider: 'local',
    modelId: 'local',
    latencyMs: 0,
    promptTokens: null,
    completionTokens: null,
    estimatedCostUsd: null,
    success: true,
  }

  return { ok: true, analysis, meta }
}
