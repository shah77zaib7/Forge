/**
 * Lightweight request-cost estimation. Rough USD-per-1M-token rates so the
 * request metadata can show an estimated cost — this is a coarse estimate
 * for a single-user app, NOT billing. Tune the table as providers change
 * their pricing; rates for unreleased future models are best-effort guesses
 * and are labeled as such. Keys never appear here.
 */

/** $ per 1M tokens, keyed by model id (the workspace id, not gateway id). */
const RATES: Record<string, { input: number; output: number }> = {
  // Opus-class frontier models — estimates, verify against current pricing.
  'claude-opus-5': { input: 15, output: 75 },
  'claude-opus-4-8': { input: 15, output: 75 },
  // GPT-5.6 — estimate; GPT-5-class pricing.
  'gpt-5-6': { input: 2.5, output: 10 },
  // Gemini 2.5 Pro class.
  gemini: { input: 1.25, output: 10 },
  // AgentRouter gateway model id is dynamic — apply the gateway default.
  agentrouter: { input: 2, output: 10 },
}

/** Fallback for unknown/unlisted model ids. */
const FALLBACK_RATE = { input: 2, output: 8 }

export interface CostEstimate {
  /** USD, e.g. 0.00231. Null when token counts are unavailable. */
  usd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

/**
 * Estimate the USD cost of one request from token usage. Returns null when
 * the provider did not report tokens — never fabricates a cost.
 */
export function estimateCostUsd(
  modelId: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (promptTokens === null || completionTokens === null) return null
  const rate = RATES[modelId] ?? FALLBACK_RATE
  return (promptTokens / 1e6) * rate.input + (completionTokens / 1e6) * rate.output
}

/** Full estimate object — tokens + USD — for the request metadata. */
export function estimateCost(modelId: string, promptTokens: number | null, completionTokens: number | null): CostEstimate {
  return {
    usd: estimateCostUsd(modelId, promptTokens, completionTokens),
    inputTokens: promptTokens,
    outputTokens: completionTokens,
  }
}
