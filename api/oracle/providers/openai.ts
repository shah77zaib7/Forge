import { fetchJson, mergeSignal, throwProviderError, type ProviderCallOptions, type ProviderCallResult } from './base'

interface OpenAICompatibleOptions extends ProviderCallOptions {
  baseUrl: string
  apiKey: string
  /** Display name for error messages ('OpenAI', 'AgentRouter'). */
  providerLabel: string
  /** JSON body field for the token cap (max_tokens vs max_completion_tokens). */
  maxTokensField?: 'max_tokens' | 'max_completion_tokens'
}

/**
 * OpenAI-compatible chat-completions call — shared by the OpenAI adapter
 * and the AgentRouter gateway (both speak the same protocol). Returns the
 * text and token usage when the provider reports them.
 */
export async function callOpenAICompatible(options: OpenAICompatibleOptions): Promise<ProviderCallResult> {
  const { baseUrl, apiKey, providerLabel, modelId, system, user, signal, maxTokensField = 'max_tokens' } = options
  const { status, body } = await fetchJson(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      [maxTokensField]: 2000,
      temperature: 0.2,
    }),
    signal: mergeSignal(signal),
  })

  if (status !== 200) {
    throwProviderError(providerLabel, status, body, 'Provider returned an unexpected response.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (cause) {
    throwProviderError(providerLabel, status, body, `Provider returned malformed JSON: ${String(cause)}`)
  }

  const choice = (parsed as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
  const text = typeof choice?.message?.content === 'string' ? choice.message.content : ''
  if (!text.trim()) {
    throwProviderError(providerLabel, status, body, 'Provider returned an empty completion.')
  }

  const usage = (parsed as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } })?.usage
  const promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null
  const completionTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null

  return { text, promptTokens, completionTokens }
}
