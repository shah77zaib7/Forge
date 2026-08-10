/**
 * CoinGecko API client — Forge's primary general cryptocurrency market-data
 * provider.
 *
 * Uses the keyless public endpoints only: no API key, no secrets, nothing to
 * configure. Every payload is validated before use so a malformed, partial or
 * hostile response can never break the UI — callers receive normalized quotes
 * with finite numbers or a thrown error to surface as a network failure.
 */

export interface CoinGeckoQuote {
  /** CoinGecko asset id (e.g. "bitcoin") — the stable lookup key. */
  id: string
  name: string
  /** Uppercased ticker (e.g. "BTC"). */
  symbol: string
  priceUsd: number
  /** 24h change in percent, relative to USD. */
  change24hPct: number
  marketCapUsd: number
  /** 24h traded volume in USD — null when absent from a partial response. */
  volume24hUsd: number | null
  /** Circulating supply — null when absent from a partial response. */
  supply: number | null
  /** Official logo URL (CoinGecko CDN) — null when absent from a partial response. */
  logoUrl: string | null
  /** 24h high in USD — null when absent from a partial response. */
  high24hUsd: number | null
  /** 24h low in USD — null when absent from a partial response. */
  low24hUsd: number | null
  /** Downsampled 7-day price series for the mini sparkline. */
  spark: number[]
  /** Epoch ms when the quote was fetched. */
  updatedAt: number
}

export interface CoinGeckoGlobal {
  /** BTC's share of total crypto market cap, in percent. */
  btcDominance: number
  updatedAt: number
}

import { fetchJson } from './http'

const BASE_URL = 'https://api.coingecko.com/api/v3'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Normalize an unknown value into a finite number, or null. */
function toFiniteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null
}

/** Keep a bounded, evenly spaced series — first and last points included. */
function downsample(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values
  const step = (values.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, index) => values[Math.round(index * step)])
}

function parseSpark(value: unknown): number[] {
  if (typeof value !== 'object' || value === null) return []
  const prices = (value as Record<string, unknown>).price
  if (!Array.isArray(prices)) return []
  const series = prices.map(toFiniteNumber).filter((point): point is number => point !== null)
  return downsample(series, 60)
}

function parseQuote(item: unknown): CoinGeckoQuote | null {
  if (typeof item !== 'object' || item === null) return null
  const record = item as Record<string, unknown>

  const id = typeof record.id === 'string' ? record.id : ''
  const name = typeof record.name === 'string' ? record.name : ''
  const symbol = typeof record.symbol === 'string' ? record.symbol.toUpperCase() : ''
  const price = toFiniteNumber(record.current_price)
  // Prefer the vs-currency (USD) change; fall back to the generic field.
  const change =
    toFiniteNumber(record.price_change_percentage_24h_in_currency) ??
    toFiniteNumber(record.price_change_percentage_24h)
  const marketCap = toFiniteNumber(record.market_cap)
  const logoUrl = typeof record.image === 'string' && record.image.length > 0 ? record.image : null
  const high24h = toFiniteNumber(record.high_24h)
  const low24h = toFiniteNumber(record.low_24h)

  if (!id || !name || !symbol || price === null || change === null || marketCap === null) {
    return null
  }

  return {
    id,
    name,
    symbol,
    priceUsd: price,
    change24hPct: change,
    marketCapUsd: marketCap,
    volume24hUsd: toFiniteNumber(record.total_volume),
    supply: toFiniteNumber(record.circulating_supply),
    logoUrl,
    high24hUsd: high24h,
    low24hUsd: low24h,
    spark: parseSpark(record.sparkline_in_7d),
    updatedAt: Date.now(),
  }
}

/**
 * Fetch live quotes for the given CoinGecko asset ids in a single request —
 * prices, 24h change, market cap and a 7-day sparkline per asset.
 */
export async function fetchCoinGeckoQuotes(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<CoinGeckoQuote[]> {
  const url = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&order=market_cap_desc&price_change_percentage=24h&sparkline=true`
  const payload = await fetchJson(url, signal)

  if (!Array.isArray(payload)) {
    throw new Error('Market feed returned an unexpected payload')
  }

  const quotes = payload.map(parseQuote).filter((quote): quote is CoinGeckoQuote => quote !== null)
  if (quotes.length === 0) {
    throw new Error('Market feed returned no quotes')
  }
  return quotes
}

/** Fetch the global market snapshot (used for BTC dominance). */
export async function fetchCoinGeckoGlobal(signal?: AbortSignal): Promise<CoinGeckoGlobal> {
  const payload = await fetchJson(`${BASE_URL}/global`, signal)
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Market feed returned an unexpected payload')
  }
  const data = (payload as Record<string, unknown>).data
  if (typeof data !== 'object' || data === null) {
    throw new Error('Market feed returned an unexpected payload')
  }
  const percentages = (data as Record<string, unknown>).market_cap_percentage
  const btcDominance =
    typeof percentages === 'object' && percentages !== null
      ? toFiniteNumber((percentages as Record<string, unknown>).btc)
      : null
  if (btcDominance === null) {
    throw new Error('Market feed returned no dominance data')
  }
  return { btcDominance, updatedAt: Date.now() }
}
