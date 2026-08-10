import { useMemo } from 'react'

import type { Coin } from '@/features/markets/types'
import { formatChange } from '@/lib/format'
import { useMarketData } from '@/store/market-data'

import type { MarketPulseData, MarketSentiment, PulseMarket } from '../data'

/** The lead tape — BTC, ETH, SOL — keyed by CoinGecko asset id. */
const LEAD_TAPE_IDS = ['bitcoin', 'ethereum', 'solana'] as const

export interface UseMarketPulseResult {
  /**
   * The full Market Pulse contract built from the shared live universe.
   * Null while the first load is in flight or when no quotes have arrived.
   */
  pulse: MarketPulseData | null
  loading: boolean
  stale: boolean
  error: string | null
  refresh: () => void
}

/**
 * Live Market Pulse — reads the canonical market-data store (one app-wide
 * CoinGecko loop) and derives the lead tape, dominance, sentiment and
 * notable-leader read. The dashboard card consumes the same MarketPulseData
 * contract the mock used, so the UI is untouched.
 */
export function useMarketPulse(): UseMarketPulseResult {
  const { coins, btcDominance, loading, stale, error, refresh } = useMarketData()

  const pulse = useMemo<MarketPulseData | null>(() => {
    if (coins.length === 0) return null

    const markets: PulseMarket[] = LEAD_TAPE_IDS.map((id) => coins.find((coin) => coin.id === id))
      .filter((coin): coin is Coin => coin !== undefined)
      .map((coin) => ({ coin }))
    if (markets.length === 0) return null

    const avgChange =
      markets.reduce((sum, { coin }) => sum + (coin.change24h ?? 0), 0) / markets.length
    const sentiment: MarketSentiment =
      avgChange > 1.5 ? 'Risk-on' : avgChange < -1.5 ? 'Risk-off' : 'Mixed'

    const notable = [...coins].sort(
      (a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0),
    )[0]
    if (!notable) return null

    const headline = `${notable.name} leads the tape with a ${formatChange(notable.change24h)} move in the last 24 hours.`

    return { markets, btcDominance, sentiment, notable: { coin: notable, headline } }
  }, [coins, btcDominance])

  return { pulse, loading, stale, error, refresh }
}
