/** Requests fail fast instead of hanging a poll loop. */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * Fetch and parse a JSON payload with a hard timeout. The caller's signal is
 * bridged into an internal controller so either side can cancel the request.
 */
export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = window.setTimeout(() => {
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
      throw new Error(`Market feed request failed (${response.status})`)
    }
    return await response.json()
  } catch (cause) {
    // A caller's abort is a cancellation; our own timeout is a failure that
    // surfaces must render as an error rather than an eternal loading state.
    if (timedOut) throw new Error('Market feed request timed out')
    throw cause
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
