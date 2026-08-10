/**
 * gold-api.com client — Forge's spot precious-metals feed (XAU, XAG).
 *
 * Keyless public endpoint with CORS enabled; no API key, nothing to
 * configure. It is price-only by design: change, market cap, volume and
 * supply are simply absent, so merged coins carry null for those fields
 * and every surface renders an honest dash instead of a fabricated number.
 * Payloads are validated before use so a malformed response surfaces as a
 * network failure rather than corrupting the store.
 */

import { fetchJson } from './http'

export interface MetalQuote {
  /** Provider symbol, lowercased (e.g. "xau") — the stable lookup key. */
  id: string
  name: string
  /** Uppercased symbol (e.g. "XAU"). */
  symbol: string
  /** Spot price in USD. */
  priceUsd: number
  /** Epoch ms when the quote was fetched. */
  updatedAt: number
}

const BASE_URL = 'https://api.gold-api.com'

function parsePrice(symbol: string, payload: unknown): MetalQuote | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  const price = typeof record.price === 'number' && Number.isFinite(record.price) ? record.price : null
  const name = typeof record.name === 'string' ? record.name : ''
  if (price === null || !name) return null
  return {
    id: symbol.toLowerCase(),
    name,
    symbol: symbol.toUpperCase(),
    priceUsd: price,
    updatedAt: Date.now(),
  }
}

/**
 * Fetch spot prices for the given metals (e.g. ["XAU", "XAG"]) — one
 * request per symbol, all-or-nothing so a partial response can never
 * masquerade as complete data.
 */
export async function fetchMetalQuotes(
  symbols: readonly string[],
  signal?: AbortSignal,
): Promise<MetalQuote[]> {
  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const payload = await fetchJson(`${BASE_URL}/price/${symbol}`, signal)
      const quote = parsePrice(symbol, payload)
      if (!quote) {
        throw new Error(`Metal feed returned no quote for ${symbol}`)
      }
      return quote
    }),
  )
  return quotes
}
