/** Requests fail fast instead of hanging a poll loop. */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Fetch and parse a JSON payload with a hard timeout. The caller's signal is
 * bridged into an internal controller so either side can cancel the request.
 */
export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', onAbort)
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Market feed request failed (${response.status})`)
    }
    return await response.json()
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
