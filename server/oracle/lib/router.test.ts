import { afterEach, describe, expect, it, vi } from 'vitest'

import { estimateCostUsd } from './cost'
import { OracleApiError } from './errors'
import { agentRouterBaseUrl, availabilityReport, oracleModelById, resolveGateway } from './models'
import { extractJson, normalizeAnalysis } from './normalize'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { routeAnalysis } from './router'
import type { OracleApiRequest } from './types'

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

function requestFixture(overrides: Partial<OracleApiRequest> = {}): OracleApiRequest {
  return {
    model: 'claude-opus-5',
    symbol: 'XAU/USD',
    timeframe: '1H',
    candles: [
      { timestamp: 1_700_000_000_000, open: 2300, high: 2310, low: 2295, close: 2305 },
      { timestamp: 1_700_000_003_600, open: 2305, high: 2320, low: 2300, close: 2318 },
    ],
    liquiditySnapshot: {
      trend: 'bullish',
      structure: 'higher highs',
      momentum: 'strong',
      nearestBuy: '2325.0',
      nearestSell: '2290.0',
      support: '2295.0',
      resistance: '2320.0',
      zones: [
        {
          side: 'buy',
          price: 2325,
          zoneLow: 2323,
          zoneHigh: 2325,
          source: 'equal_high',
          rank: 'high',
          strength: 0.8,
          touches: 2,
          swept: true,
          distancePercent: 0.2,
        },
        {
          side: 'sell',
          price: 2290,
          zoneLow: 2290,
          zoneHigh: 2292,
          source: 'swing_low',
          rank: 'medium',
          strength: 0.6,
          touches: 1,
          swept: false,
          distancePercent: 0.5,
        },
      ],
      sweeps: [{ side: 'buy', direction: 'up', sweepPrice: 2325.5, returned: true }],
      granularity: '1h',
      source: 'Twelve Data',
      unavailable: false,
      updatedAt: Date.now(),
    },
    setupContext: {
      family: 'liquidity_sweep',
      level: 'moderate',
      score: 62,
      sweep: { direction: 'short', levelPrice: 2325, returned: true },
      displacement: { direction: 'down', strength: 74, rangeExpansion: 2.1, bodyRatio: 0.8, directionalConsistency: 0.9 },
      retracement: { depthPercent: 0.5, reaction: 'held' },
      confirmation: null,
      reasons: ['Buy-side swept and reclaimed'],
    },
    marketContext: {
      name: 'Spot Gold',
      ticker: 'XAU/USD',
      price: 2310.5,
      change24h: 0.42,
      source: 'Twelve Data',
      freshness: 'recent',
    },
    userStrategyContext: { mode: 'trader', responseDetail: 'default' },
    requestedAnalysis: 'Analyze the liquidity situation',
    ...overrides,
  }
}

const MODEL_JSON = JSON.stringify({
  summary: 'Buy-side was swept at 2325 and reclaimed; price is holding above support.',
  bias: 'bearish',
  setup: { family: 'liquidity_sweep', level: 'moderate', direction: 'short', entryArea: '2308–2312', invalidation: '2325' },
  liquidity: { nearestBuy: '2325.0', nearestSell: '2290.0', notes: ['Buy-side swept and reclaimed'] },
  displacement: { present: true, direction: 'down', strength: 74, notes: ['Range expansion 2.1×'] },
  confirmation: { present: false, kind: null, description: null },
  invalidation: 'A close above 2325 voids the read',
  confidence: 78,
  risks: ['Gold can gap at session opens'],
  reasoning: ['Buy-side swept', 'Displacement down', 'No confirmation yet'],
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ */
/* Model registry + availability                                       */
/* ------------------------------------------------------------------ */

describe('model registry', () => {
  it('lists the full selector set with correct providers', () => {
    const models = availabilityReport({}).models
    expect(models.map((m) => m.id)).toEqual(['local', 'claude-opus-5', 'claude-opus-4-8', 'gpt-5-6', 'gemini', 'agentrouter'])
    const claude = models.find((m) => m.id === 'claude-opus-5')!
    expect(claude.label).toBe('Claude Opus 5')
    expect(claude.requires).toEqual(['AGENTROUTER_API_KEY', 'ANTHROPIC_API_KEY'])
    expect(claude.available).toBe(false)
    expect(claude.gateway).toBeNull()
  })

  it('local is always available, gemini requires its own key', () => {
    const report = availabilityReport({ GEMINI_API_KEY: 'g' }).models
    expect(report.find((m) => m.id === 'local')!.available).toBe(true)
    const gemini = report.find((m) => m.id === 'gemini')!
    expect(gemini.available).toBe(true)
    expect(gemini.gateway).toBe('Gemini')
  })
})

describe('gateway resolution', () => {
  it('prefers AgentRouter over direct Anthropic for Claude entries', () => {
    const entry = oracleModelById('claude-opus-5')!
    expect(resolveGateway(entry, { AGENTROUTER_API_KEY: 'x' })).toBe('agentrouter')
    expect(resolveGateway(entry, { ANTHROPIC_API_KEY: 'y' })).toBe('anthropic')
    expect(resolveGateway(entry, { AGENTROUTER_API_KEY: 'x', ANTHROPIC_API_KEY: 'y' })).toBe('agentrouter')
    expect(resolveGateway(entry, {})).toBeNull()
  })

  it('gpt-5-6 resolves to openai when only the openai key exists', () => {
    const entry = oracleModelById('gpt-5-6')!
    expect(resolveGateway(entry, { OPENAI_API_KEY: 'o' })).toBe('openai')
  })
})

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

describe('routeAnalysis', () => {
  it('rejects unknown models with a typed error', async () => {
    await expect(routeAnalysis(requestFixture({ model: 'nope' }), {})).rejects.toMatchObject({
      code: 'unknown_model',
    })
  })

  it('rejects the local engine on the server', async () => {
    await expect(routeAnalysis(requestFixture({ model: 'local' }), {})).rejects.toMatchObject({
      code: 'bad_request',
    })
  })

  it('returns not_configured naming the missing keys when no gateway has a key', async () => {
    const error = await routeAnalysis(requestFixture(), {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OracleApiError)
    expect((error as OracleApiError).code).toBe('not_configured')
    expect((error as OracleApiError).detail).toContain('AGENTROUTER_API_KEY')
  })

  it('routes through AgentRouter and stamps provenance server-side', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: MODEL_JSON } }],
          usage: { prompt_tokens: 1200, completion_tokens: 300 },
        }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { analysis, meta } = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' })

    // The request went to the AgentRouter gateway with the concrete model id.
    const called = fetchMock.mock.calls[0]
    expect(String(called[0])).toContain('/chat/completions')
    const sent = JSON.parse(String((called[1] as RequestInit).body))
    expect(sent.model).toBe('claude-opus-5')
    expect(sent.messages[0].role).toBe('system')
    expect(sent.messages[1].role).toBe('user')

    // Provenance is stamped by the server — the model cannot spoof it.
    expect(analysis.model).toEqual({ id: 'claude-opus-5', provider: 'agentrouter', label: 'Claude Opus 5' })
    expect(analysis.sourceData).toMatchObject({
      symbol: 'XAU/USD',
      timeframe: '1H',
      source: 'Twelve Data',
      freshness: 'recent',
      candleCount: 2,
      dataComplete: true,
    })
    expect(analysis.timestamp).toBeGreaterThan(0)

    // Interpretation fields survive normalization.
    expect(analysis.bias).toBe('bearish')
    expect(analysis.confidence).toBe(78)
    expect(analysis.setup.family).toBe('liquidity_sweep')
    expect(analysis.reasoning.length).toBe(3)

    // Meta carries provider, tokens and an estimated cost.
    expect(meta.provider).toBe('agentrouter')
    expect(meta.promptTokens).toBe(1200)
    expect(meta.completionTokens).toBe(300)
    expect(meta.estimatedCostUsd).toBeCloseTo(1200 / 1e6 * 15 + 300 / 1e6 * 75, 5)
  })

  it('surfaces a network failure as provider_error with the real cause — never the generic message', async () => {
    // A dead gateway host: fetch rejects (DNS/connection) instead of returning HTTP.
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))
    const error = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OracleApiError)
    expect((error as OracleApiError).code).toBe('provider_error')
    expect((error as OracleApiError).message).toContain('AgentRouter')
    // The underlying cause is preserved safely — this is what makes the
    // dead-host diagnosis visible instead of "Oracle could not complete…".
    expect((error as OracleApiError).detail).toContain('fetch failed')
  })

  it('maps an abort/timeout to the typed timeout code with a safe detail', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(abortError)))
    const error = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OracleApiError)
    expect((error as OracleApiError).code).toBe('timeout')
    expect((error as OracleApiError).detail).toContain('aborted')
  })

  it('defaults the AgentRouter base URL to the working gateway (agentrouter.org)', () => {
    expect(agentRouterBaseUrl({})).toBe('https://agentrouter.org/v1')
    // The dead api.agentrouter.dev host must never be the default.
    expect(agentRouterBaseUrl({})).not.toContain('api.agentrouter.dev')
    // A custom gateway still wins.
    expect(agentRouterBaseUrl({ AGENTROUTER_BASE_URL: 'https://gw.example.com/v1' })).toBe('https://gw.example.com/v1')
  })

  it('uses a current stable Gemini model by default, with the env override intact', () => {
    expect(oracleModelById('gemini', {})!.modelId).toBe('gemini-3.6-flash')
    expect(oracleModelById('gemini', { GEMINI_MODEL: 'gemini-3.5-flash' })!.modelId).toBe('gemini-3.5-flash')
    // The retired 2.5-pro id must never be the default.
    expect(oracleModelById('gemini', {})!.modelId).not.toBe('gemini-2.5-pro')
  })

  it('maps provider 429 to rate_limit and 500 to provider_error', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 429,
      text: async () => JSON.stringify({ message: 'Rate limit exceeded' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const rate = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' }).catch((e: unknown) => e)
    expect((rate as OracleApiError).code).toBe('rate_limit')
    expect((rate as OracleApiError).detail).toContain('Rate limit exceeded')

    fetchMock.mockResolvedValueOnce({ status: 500, text: async () => 'boom' })
    vi.stubGlobal('fetch', fetchMock)
    const failed = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' }).catch((e: unknown) => e)
    expect((failed as OracleApiError).code).toBe('provider_error')
  })

  it('throws bad_model_output when the model returns non-JSON', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 200,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'Sorry, I cannot help with that.' } }],
        }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const error = await routeAnalysis(requestFixture(), { AGENTROUTER_API_KEY: 'ar' }).catch((e: unknown) => e)
    expect((error as OracleApiError).code).toBe('bad_model_output')
  })
})

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

describe('normalizeAnalysis', () => {
  it('extracts JSON from markdown fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('clamps confidence and coerces invalid bias/setup fields', () => {
    const analysis = normalizeAnalysis(
      JSON.stringify({ summary: 'x', bias: 'extreme', confidence: 999, setup: { family: 'magic' } }),
      requestFixture(),
      { id: 'gemini', provider: 'gemini', label: 'Gemini' },
      1234,
    )
    expect(analysis.bias).toBe('neutral')
    expect(analysis.confidence).toBe(100)
    expect(analysis.setup.family).toBe('none')
    expect(analysis.model.id).toBe('gemini')
    expect(analysis.timestamp).toBe(1234)
  })

  it('never lets the model spoof sourceData', () => {
    const analysis = normalizeAnalysis(
      JSON.stringify({ summary: 'x', sourceData: { symbol: 'FAKE', source: 'FakeSource' } }),
      requestFixture(),
      { id: 'claude-opus-5', provider: 'anthropic', label: 'Claude Opus 5' },
    )
    expect(analysis.sourceData.symbol).toBe('XAU/USD')
    expect(analysis.sourceData.source).toBe('Twelve Data')
    expect(analysis.sourceData.candleCount).toBe(2)
  })

  it('notes when data is unavailable or not live', () => {
    const analysis = normalizeAnalysis(
      JSON.stringify({ summary: 'x' }),
      requestFixture({
        candles: [],
        liquiditySnapshot: { ...requestFixture().liquiditySnapshot, unavailable: true },
      }),
      { id: 'gemini', provider: 'gemini', label: 'Gemini' },
    )
    expect(analysis.sourceData.dataComplete).toBe(false)
    expect(analysis.sourceData.notes.some((n) => n.includes('unavailable'))).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Cost                                                                */
/* ------------------------------------------------------------------ */

describe('estimateCostUsd', () => {
  it('computes from input/output rates', () => {
    expect(estimateCostUsd('claude-opus-5', 1_000_000, 0)).toBeCloseTo(15, 5)
    expect(estimateCostUsd('gpt-5-6', 0, 1_000_000)).toBeCloseTo(10, 5)
  })

  it('returns null when tokens are missing — never fabricates', () => {
    expect(estimateCostUsd('claude-opus-5', null, null)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

describe('prompt', () => {
  it('teaches the two independent setup families', () => {
    const system = buildSystemPrompt()
    expect(system).toContain('LIQUIDITY SWEEP SETUP')
    expect(system).toContain('DISPLACEMENT SETUP')
    expect(system).toContain('INDEPENDENT')
    expect(system).toContain('Never claim a probability of success')
    expect(system).toContain('Reply with ONLY a single JSON object')
  })

  it('renders the supplied facts and caps candle lines', () => {
    const request = requestFixture()
    const user = buildUserPrompt(request, 1)
    expect(user).toContain('XAU/USD')
    expect(user).toContain('Twelve Data')
    expect(user).toContain('recent')
    expect(user).toContain('Buy-side swept and reclaimed')
    // Only the last 1 candle rendered.
    expect(user.match(/^\s*\d{4}-\d{2}-\d{2}T/gm)!.length).toBe(1)
  })
})
