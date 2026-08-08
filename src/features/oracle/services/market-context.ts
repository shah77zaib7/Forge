import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { formatChange } from '@/lib/format'
import {
  liquiditySnapshot,
  marketStatus,
  windowReturn,
  type LiquidityTimeframe,
} from '@/features/workspace/data'

import type { MarketContextSnapshot } from '../types'

/**
 * The exact market read Oracle is working from — the Market Context sheet
 * displays this. Pure derivation from the deterministic mock feed; a live
 * market-data adapter can fill the same shape later without UI changes.
 */
export function buildMarketContext(coin: Coin, timeframe: LiquidityTimeframe): MarketContextSnapshot {
  const status = marketStatus(coin, timeframe)
  const [buy, sell, support, resistance] = liquiditySnapshot(coin, timeframe)
  const change = windowReturn(coin, timeframe)

  return {
    coinId: coin.id,
    name: coin.name,
    ticker: coin.ticker,
    timeframeId: timeframe.id,
    price: formatMarketPrice(coin.price),
    change24h: formatChange(coin.change24h),
    windowReturn: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
    trend: status.trend.label,
    trendTone: status.trend.tone,
    structure: status.structure,
    momentum: status.momentum,
    volume: status.volume,
    buyLiquidity: buy.value,
    sellLiquidity: sell.value,
    support: support.value,
    resistance: resistance.value,
    updatedAt: Date.now(),
  }
}
