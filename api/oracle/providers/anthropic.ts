import { fetchJson, mergeSignal, throwProviderError, type ProviderCallOptions, type ProviderCallResult } from './base'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Anthropic Messages API adapter. The key travels in the x-api-key header
 * (never in the URL or the body) and is never logged or returned.
 */
export async function callAnthropic(
  options: ProviderCallOptions,
  apiKey: string,
): Promise<ProviderCallResult> {
  const { status, body } = await fetchJson(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: options.modelId,
      max_tokens: 2000,
      system: options.system,
      messages: [{ role: 'user', content: options.user }],
    }),
    signal: mergeSignal(options.signal),
  })

  if (status !== 200) {
    throwProviderError('Anthropic', status, body, 'Provider returned an unexpected response.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (cause) {
    throwProviderError('Anthropic', status, body, `Provider returned malformed JSON: ${String(cause)}`)
  }

  const content = (parsed as { content?: Array<{ type: string; text: string }> })?.content ?? []
  const text = content.find((block) => block.type === 'text')?.text ?? ''
  if (!text.trim()) {
    throwProviderError('Anthropic', status, body, 'Provider returned an empty completion.')
  }

  const usage = (parsed as { usage?: { input_tokens?: unknown; output_tokens?: unknown } })?.usage
  const promptTokens = typeof usage?.input_tokens === 'number' ? usage.input_tokens : null
  const completionTokens = typeof usage?.output_tokens === 'number' ? usage.output_tokens : null

  return { text, promptTokens, completionTokens }
}
