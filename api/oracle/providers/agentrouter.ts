import { agentRouterBaseUrl } from '../lib/models'
import { callOpenAICompatible } from './openai'
import type { ProviderCallOptions, ProviderCallResult } from './base'

/**
 * AgentRouter — an OpenAI-compatible chat-completions gateway. ONE
 * AGENTROUTER_API_KEY serves many models (Claude, GPT, etc.), so it is the
 * first gateway in the `via` chain for Claude/OpenAI entries. The model id
 * passed through is the concrete model id the gateway resolves.
 */
export async function callAgentRouter(
  options: ProviderCallOptions,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProviderCallResult> {
  const apiKey = env.AGENTROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('AgentRouter is not configured (AGENTROUTER_API_KEY missing).')
  }
  return callOpenAICompatible({
    baseUrl: agentRouterBaseUrl(env),
    apiKey,
    providerLabel: 'AgentRouter',
    modelId: options.modelId,
    system: options.system,
    user: options.user,
    signal: options.signal,
  })
}
