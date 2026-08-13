/**
 * Lightweight request-cost estimation. Rough USD-per-1M-token rates so the
 * request metadata can show an estimated cost — this is a coarse estimate
 * for a single-user app, NOT billing. Gemini is the only external AI
 * provider, so this table holds its rate only. Keys never appear here.
 */

/** $ per 1M tokens, keyed by model id (the workspace id, not gateway id). */
const RATES: Record<string, { input: number; output: number }> = {
  // Gemini 3 class (default gemini-3.6-flash) — estimate.
  gemini: { input: 1.25, output: 10 },
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
