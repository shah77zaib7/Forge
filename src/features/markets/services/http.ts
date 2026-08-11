/** Requests fail fast instead of hanging a poll loop. */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * A non-2xx response from a market-data provider. `status` lets callers
 * distinguish genuine failures from provider rate limits.
 */
export class HttpStatusError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpStatusError'
    this.status = status
  }
}

/**
 * HTTP 429 — the provider is throttling (CoinGecko free tier, Twelve Data
 * credits, exchange rate limits). Surfaces must render this as a temporary,
 * retryable condition rather than a permanent failure.
 */
export class RateLimitError extends HttpStatusError {
  constructor(status = 429, message = 'Rate limit reached — the market-data provider is throttling requests') {
    super(status, message)
    this.name = 'RateLimitError'
  }
}

/**
 * Fetch and parse a JSON payload with a hard timeout. The caller's signal is
 * bridged into an internal controller so either side can cancel the request.
 * HTTP 429 raises RateLimitError so providers/UI can handle throttling
 * distinctly from other failures.
 */
export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', onAbort)
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      if (response.status === 429) {
        let host = ''
        try {
          host = new URL(response.url).hostname
        } catch {
          /* response.url may be empty for mocked/streamed responses */
        }
        throw new RateLimitError(429, `Rate limit reached (HTTP 429)${host ? ` — ${host}` : ''}`)
      }
      throw new HttpStatusError(response.status, `Market feed request failed (${response.status})`)
    }
    return await response.json()
  } catch (cause) {
    // A caller's abort is a cancellation; our own timeout is a failure that
    // surfaces must render as an error rather than an eternal loading state.
    if (timedOut) throw new Error('Market feed request timed out')
    throw cause
  } finally {
    globalThis.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
