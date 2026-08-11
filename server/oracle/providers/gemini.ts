import { fetchJson, mergeSignal, throwProviderError, type ProviderCallOptions, type ProviderCallResult } from './base'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Google Gemini adapter — first-class and independent of AgentRouter. The
 * key travels in the x-goog-api-key header (never in the URL), and is
 * never logged or returned.
 */
export async function callGemini(
  options: ProviderCallOptions,
  apiKey: string,
): Promise<ProviderCallResult> {
  const model = encodeURIComponent(options.modelId)
  const { status, body } = await fetchJson(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.user }] }],
      // responseMimeType 'application/json' is Gemini's NATIVE structured
      // output — the model is constrained to emit pure JSON (no fences, no
      // prose), which is what made earlier responses unparseable. Deliberately
      // no strict responseJsonSchema: it could 400 on older GEMINI_MODEL
      // overrides, and the prompt already defines the exact object shape.
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2000, temperature: 0.2 },
    }),
    signal: mergeSignal(options.signal),
  })

  if (status !== 200) {
    throwProviderError('Gemini', status, body, 'Provider returned an unexpected response.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch (cause) {
    throwProviderError('Gemini', status, body, `Provider returned malformed JSON: ${String(cause)}`)
  }

  const candidates = (parsed as { candidates?: Array<{ content?: { parts?: Array<{ text: string }> } }> })?.candidates ?? []
  const text = candidates[0]?.content?.parts?.[0]?.text ?? ''
  if (!text.trim()) {
    throwProviderError('Gemini', status, body, 'Provider returned an empty completion.')
  }

  const usage = (parsed as { usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown } })
    ?.usageMetadata
  const promptTokens = typeof usage?.promptTokenCount === 'number' ? usage.promptTokenCount : null
  const completionTokens = typeof usage?.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : null

  return { text, promptTokens, completionTokens }
}
