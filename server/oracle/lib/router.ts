import { OracleApiError } from './errors'
import { oracleModelById, PROVIDER_KEYS, providerLabel, resolveGateway, type OracleProviderId } from './models'
import { normalizeAnalysis } from './normalize'
import { buildSystemPrompt, buildUserPrompt } from './prompt'
import { estimateCostUsd } from './cost'
import type { OracleApiRequest, OracleRequestMeta } from './types'
import type { ProviderCallOptions, ProviderCallResult } from '../providers/base'
import { callAgentRouter } from '../providers/agentrouter'
import { callAnthropic } from '../providers/anthropic'
import { callGemini } from '../providers/gemini'
import { callOpenAICompatible } from '../providers/openai'

/**
 * The Oracle router — the ONLY place that decides which provider serves a
 * model. The frontend sends one normalized request; the router resolves the
 * model registry entry, picks the first configured gateway (AgentRouter
 * first for Claude/OpenAI entries, then direct keys, Gemini standalone),
 * calls the matching adapter, and normalizes the output. Provider keys are
 * read from process.env and never leave this layer.
 */

interface RouteResult {
  analysis: import('./types').OracleAnalysis
  meta: OracleRequestMeta
}

function directAdapterFor(gateway: Exclude<OracleProviderId, 'local'>, env: NodeJS.ProcessEnv) {
  switch (gateway) {
    case 'agentrouter':
      return (options: ProviderCallOptions) => callAgentRouter(options, env)
    case 'anthropic': {
      const apiKey = env.ANTHROPIC_API_KEY?.trim() ?? ''
      return (options: ProviderCallOptions) => callAnthropic(options, apiKey)
    }
    case 'openai': {
      const apiKey = env.OPENAI_API_KEY?.trim() ?? ''
      return (options: ProviderCallOptions) =>
        callOpenAICompatible({
          baseUrl: 'https://api.openai.com/v1',
          apiKey,
          providerLabel: 'OpenAI',
          modelId: options.modelId,
          system: options.system,
          user: options.user,
          signal: options.signal,
          maxTokensField: 'max_completion_tokens',
        })
    }
    case 'gemini': {
      const apiKey = env.GEMINI_API_KEY?.trim() ?? ''
      return (options: ProviderCallOptions) => callGemini(options, apiKey)
    }
  }
}

/**
 * Route one analysis request. Throws OracleApiError with a typed code —
 * unknown_model / not_configured / provider_error / rate_limit / timeout /
 * bad_model_output — so the endpoint can surface an honest state.
 */
export async function routeAnalysis(
  request: OracleApiRequest,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const startedAt = Date.now()

  const entry = oracleModelById(request.model, env)
  if (!entry) {
    throw new OracleApiError('unknown_model', `Unknown Oracle model "${request.model}".`)
  }
  if (entry.provider === 'local') {
    // The Local engine is deterministic and client-side — the server never
    // serves it. Guard against a client that insists on sending it here.
    throw new OracleApiError('bad_request', 'The local engine runs on the client — pick a server model.')
  }

  const gateway = resolveGateway(entry, env)
  if (!gateway) {
    throw new OracleApiError(
      'not_configured',
      `No provider key configured for ${entry.label}.`,
      `Configure one of: ${entry.via.filter((p) => p !== 'local').map((p) => PROVIDER_KEYS[p]).join(', ')}`,
    )
  }
  if (gateway === 'local') {
    // resolveGateway never returns 'local' for server models, but TS needs
    // the narrowing: the local engine runs on the client, never here.
    throw new OracleApiError('bad_request', 'The local engine runs on the client — pick a server model.')
  }

  const call = directAdapterFor(gateway, env)
  let result: ProviderCallResult
  try {
    result = await call({
      modelId: entry.modelId,
      system: buildSystemPrompt(),
      user: buildUserPrompt(request),
      signal,
    })
  } catch (cause) {
    // Keep the real provider failure visible: typed errors pass through;
    // anything else (network/DNS/TLS abort) becomes a typed provider_error
    // or timeout carrying a SAFE detail (error name + message, truncated,
    // never a key) — instead of the handler's generic service_unavailable.
    if (cause instanceof OracleApiError) throw cause
    const label = providerLabel(gateway)
    if (isAbortLike(cause)) {
      throw new OracleApiError('timeout', `${label} timed out.`, safeErrorDetail(cause))
    }
    throw new OracleApiError('provider_error', `${label} request failed.`, safeErrorDetail(cause))
  }

  const analysis = normalizeAnalysis(result.text, request, {
    id: entry.id,
    provider: gateway,
    label: entry.label,
  })

  const meta: OracleRequestMeta = {
    provider: gateway,
    modelId: entry.modelId,
    latencyMs: Date.now() - startedAt,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    estimatedCostUsd: estimateCostUsd(entry.id, result.promptTokens, result.completionTokens),
    success: true,
  }

  return { analysis, meta }
}

/** Timeout/abort signals from the AbortSignal chain (Node + browsers). */
function isAbortLike(cause: unknown): boolean {
  if (cause instanceof Error) {
    return cause.name === 'AbortError' || cause.name === 'TimeoutError' || /timed? ?out|aborted/i.test(cause.message)
  }
  return false
}

/** A short, safe fragment of the underlying error — never a key. */
function safeErrorDetail(cause: unknown): string | undefined {
  const message = cause instanceof Error ? cause.message : String(cause)
  const trimmed = message.trim().replace(/\s+/g, ' ').slice(0, 300)
  return trimmed.length > 0 ? trimmed : undefined
}

