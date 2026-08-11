import { OracleApiError } from '../lib/errors'

/** What every provider adapter receives. */
export interface ProviderCallOptions {
  /** The concrete model id for the provider/gateway (entry.modelId). */
  modelId: string
  system: string
  user: string
  signal?: AbortSignal
}

/** What every provider adapter returns. */
export interface ProviderCallResult {
  text: string
  promptTokens: number | null
  completionTokens: number | null
}

/** Provider request timeout — the model should respond well inside this. */
export const PROVIDER_TIMEOUT_MS = 60_000

/**
 * Combine an optional caller signal with a hard timeout so a hung provider
 * can never leave the function running forever. Falls back to the timeout
 * alone when the runtime has no AbortSignal.any.
 */
export function mergeSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  if (signal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeout])
  }
  return timeout
}

/** Extract a safe message from an API error body without leaking keys. */
function errorMessageFromBody(bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>
    const candidate =
      typeof parsed.message === 'string'
        ? parsed.message
        : typeof (parsed as { error?: unknown }).error === 'object'
          ? ((parsed as { error?: Record<string, unknown> }).error?.message ?? null)
          : null
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 300)
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const trimmed = bodyText.trim().slice(0, 300)
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Map a provider HTTP failure to the typed Oracle error. 429 → rate_limit,
 * everything else → provider_error with the API's own message when
 * available. Never throws the raw key or request internals.
 */
export function throwProviderError(provider: string, status: number, bodyText: string, fallback: string): never {
  const message = errorMessageFromBody(bodyText)
  if (status === 429) {
    throw new OracleApiError('rate_limit', `Rate limit reached on ${provider}.`, message ?? undefined)
  }
  if (status === 408 || status === 504) {
    throw new OracleApiError('timeout', `${provider} timed out.`, message ?? undefined)
  }
  throw new OracleApiError('provider_error', `${provider} request failed (${status}).`, message ?? fallback)
}

/**
 * Read the JSON error body for a failed provider call — keeps the exact API
 * message (safe, non-secret) for the error detail.
 */
export function readErrorText(bodyText: string): string | null {
  return errorMessageFromBody(bodyText)
}

/** Fetch helper with signal support for the adapters. */
export async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; body: string }> {
  const response = await fetch(url, init)
  const body = await response.text()
  return { status: response.status, body }
}
