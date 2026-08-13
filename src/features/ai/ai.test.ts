import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AI_MODELS } from './models'
import { callOracle, localAnalysis, OracleClientError } from './client'
import type { OracleApiRequest } from './types'

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

function requestFixture(overrides: Partial<OracleApiRequest> = {}): OracleApiRequest {
  return {
    model: 'gemini',
    symbol: 'XAU/USD',
    timeframe: '1H',
    candles: [{ timestamp: 1_700_000_000_000, open: 2300, high: 2310, low: 2295, close: 2305 }],
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
      v2: null,
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

const SERVER_RESPONSE = {
  ok: true,
  analysis: {
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
    sourceData: {
      symbol: 'XAU/USD',
      timeframe: '1H',
      source: 'Twelve Data',
      freshness: 'recent',
      candleCount: 1,
      dataComplete: true,
      notes: [],
    },
    model: { id: 'gemini', provider: 'gemini', label: 'Gemini' },
    timestamp: 1234,
  },
  meta: {
    provider: 'gemini',
    modelId: 'gemini-3.6-flash',
    latencyMs: 5300,
    promptTokens: 900,
    completionTokens: 250,
    estimatedCostUsd: 0.003625,
    success: true,
  },
} as const

/* ------------------------------------------------------------------ */
/* Model selector set                                                  */
/* ------------------------------------------------------------------ */

describe('model selector registry', () => {
  it('contains exactly Local + Gemini — no obsolete providers', () => {
    expect(AI_MODELS.map((m) => m.id)).toEqual(['local', 'gemini'])
    expect(AI_MODELS.map((m) => m.label).sort()).toEqual(['Gemini', 'Local engine'])
    const serialized = JSON.stringify(AI_MODELS)
    expect(serialized).not.toMatch(/agentrouter|anthropic|openai|claude|gpt/i)
  })

  it('Local is labeled as the deterministic engine, Gemini as the AI provider', () => {
    const local = AI_MODELS.find((m) => m.id === 'local')!
    const gemini = AI_MODELS.find((m) => m.id === 'gemini')!
    expect(local.providerLabel).toBe('Local')
    expect(local.description).toContain('Deterministic')
    expect(gemini.providerLabel).toBe('Gemini')
    expect(gemini.description).toContain('GEMINI_API_KEY')
  })
})

/* ------------------------------------------------------------------ */
/* Local engine — deterministic request path                           */
/* ------------------------------------------------------------------ */

describe('localAnalysis (Local engine)', () => {
  it('returns a normalized deterministic analysis stamped as local', () => {
    const response = localAnalysis(requestFixture({ model: 'local' }))
    expect(response.ok).toBe(true)
    expect(response.analysis.model).toEqual({ id: 'local', provider: 'local', label: 'Local engine' })
    expect(response.analysis.summary).toContain('Spot Gold')
    // The deterministic engine derives bias from the supplied trend read.
    expect(response.analysis.bias).toBe('bullish')
    expect(response.analysis.setup.family).toBe('liquidity_sweep')
    // Local provenance — no tokens, no cost, no AI claim.
    expect(response.meta.provider).toBe('local')
    expect(response.meta.promptTokens).toBeNull()
    expect(response.meta.completionTokens).toBeNull()
    expect(response.meta.estimatedCostUsd).toBeNull()
  })

  it('reports incomplete data honestly instead of inventing facts', () => {
    const response = localAnalysis(
      requestFixture({ candles: [], liquiditySnapshot: { ...requestFixture().liquiditySnapshot, unavailable: true } }),
    )
    expect(response.ok).toBe(true)
    expect(response.analysis.sourceData.dataComplete).toBe(false)
    expect(response.analysis.sourceData.notes.some((n) => n.includes('unavailable'))).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Gemini request path + NO fallback to Local                          */
/* ------------------------------------------------------------------ */

describe('callOracle (Gemini request path)', () => {
  beforeEach(() => {
    // client.ts uses window timers; the node test env has none.
    vi.stubGlobal('window', {
      setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
      clearTimeout: (id: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(id),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the normalized payload to /api/oracle and returns the server analysis', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => SERVER_RESPONSE,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await callOracle(requestFixture())

    const called = fetchMock.mock.calls[0]
    expect(called[0]).toBe('/api/oracle')
    const init = called[1] as RequestInit
    expect(init.method).toBe('POST')
    const sent = JSON.parse(String(init.body))
    expect(sent.action).toBe('analyze')
    expect(sent.model).toBe('gemini')
    expect(sent.symbol).toBe('XAU/USD')

    // The server's analysis + provenance pass through untouched.
    expect(response.ok).toBe(true)
    expect(response.analysis.model).toEqual({ id: 'gemini', provider: 'gemini', label: 'Gemini' })
    expect(response.meta.provider).toBe('gemini')
    expect(response.meta.estimatedCostUsd).toBe(0.003625)
  })

  it('a Gemini failure rejects with the typed error — never a Local substitute', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          ok: false,
          error: { code: 'not_configured', message: 'No provider key configured for Gemini.', detail: 'Configure: GEMINI_API_KEY' },
        }),
      })),
    )

    const error = await callOracle(requestFixture()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OracleClientError)
    expect((error as OracleClientError).code).toBe('not_configured')
    expect((error as OracleClientError).detail).toContain('GEMINI_API_KEY')
    // The failure is surfaced honestly — it is NOT an ok local analysis.
    expect((error as OracleClientError).message).not.toContain('Local engine')
  })

  it('a network failure rejects as network — no fake answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))
    const error = await callOracle(requestFixture()).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(OracleClientError)
    expect((error as OracleClientError).code).toBe('network')
  })
})
