import { coins } from '@/features/markets/data'
import type { Coin } from '@/features/markets/types'
import { formatChange } from '@/lib/format'
import { loadSavedAnalyses } from '@/features/oracle/services/history'
import {
  marketStatus,
  oracleAssessment,
  windowReturn,
  type LiquidityTimeframe,
} from '@/features/workspace/data'

/* ============================================================
   Dashboard mock data — deterministic V1 figures derived from
   the seeded market feed. Every shape here is the contract a
   real portfolio/account API will fill later without touching
   the UI components.
   ============================================================ */

export interface PortfolioSummary {
  totalValue: number
  change24h: number
  change24hPct: number
  exposurePct: number
  availableBalance: number
  openPositions: number
}

export interface PulseMarket {
  coin: Coin
}

export type MarketSentiment = 'Risk-on' | 'Risk-off' | 'Mixed'

export interface MarketPulseData {
  markets: PulseMarket[]
  btcDominance: number
  sentiment: MarketSentiment
  notable: { coin: Coin; headline: string }
}

export interface Position {
  id: string
  coinId: string
  direction: 'long' | 'short'
  entry: number
  units: number
  risk: 'Low' | 'Medium' | 'High'
  status: 'Open' | 'Pending'
}

export type ActivityKind = 'analysis' | 'viewed' | 'setup' | 'watchlist'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  detail: string
  time: string
}

/** Static mock account — swap for real portfolio data later. */
export function portfolioSummary(): PortfolioSummary {
  const btc = coins.find((coin) => coin.id === 'bitcoin') ?? coins[0]
  const totalValue = 48_250.32
  const change24hPct = btc.change24h
  return {
    totalValue,
    change24h: (totalValue * change24hPct) / 100,
    change24hPct,
    exposurePct: 64,
    availableBalance: 12_840.55,
    openPositions: 4,
  }
}

/** The lead tape — BTC, ETH, SOL — plus dominance and sentiment. */
export function marketPulse(): MarketPulseData {
  const byId = (id: string) => coins.find((coin) => coin.id === id)
  const ids = ['bitcoin', 'ethereum', 'solana']
  const markets = ids
    .map((id) => byId(id))
    .filter((coin): coin is Coin => Boolean(coin))
    .map((coin) => ({ coin }))

  const totalCap = coins.reduce((sum, coin) => sum + coin.marketCap, 0)
  const btc = markets[0]?.coin
  const btcDominance = btc ? (btc.marketCap / totalCap) * 100 : 0

  const avgChange = markets.reduce((sum, m) => sum + m.coin.change24h, 0) / Math.max(markets.length, 1)
  const sentiment: MarketSentiment = avgChange > 1.5 ? 'Risk-on' : avgChange < -1.5 ? 'Risk-off' : 'Mixed'

  const notable = [...coins].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))[0]
  const headline = `${notable.name} leads the tape with a ${formatChange(notable.change24h)} move in the last 24 hours.`

  return { markets, btcDominance, sentiment, notable: { coin: notable, headline } }
}

/** Mock open positions — P/L is computed live against current prices. */
export function positions(): Position[] {
  const byId = (id: string) => coins.find((coin) => coin.id === id)
  const base = [
    { id: 'p1', coinId: 'bitcoin', direction: 'long' as const, entry: 138_900, units: 0.32, risk: 'Low' as const, status: 'Open' as const },
    { id: 'p2', coinId: 'ethereum', direction: 'long' as const, entry: 8_720, units: 2.4, risk: 'Medium' as const, status: 'Open' as const },
    { id: 'p3', coinId: 'solana', direction: 'short' as const, entry: 330, units: 14, risk: 'High' as const, status: 'Open' as const },
    { id: 'p4', coinId: 'pepe', direction: 'long' as const, entry: 0.000019, units: 2_500_000, risk: 'Medium' as const, status: 'Pending' as const },
  ]
  return base.filter((position) => byId(position.coinId))
}

/** Recent Forge activity — real saved analyses plus mock events. */
export function recentActivity(): ActivityItem[] {
  const analysisItems: ActivityItem[] = loadSavedAnalyses()
    .slice(0, 3)
    .map((saved) => ({
      id: `saved-${saved.id}`,
      kind: 'analysis' as const,
      title: saved.prompt,
      detail: `${saved.summary}`,
      time: 'Saved',
    }))

  const mockItems: ActivityItem[] = [
    {
      id: 'a1',
      kind: 'viewed',
      title: 'Viewed Ethereum workspace',
      detail: '1H window · ETH/USD',
      time: '32m ago',
    },
    {
      id: 'a2',
      kind: 'setup',
      title: 'Trade setup captured',
      detail: 'Bitcoin · 4H · 1.8:1',
      time: '2h ago',
    },
    {
      id: 'a3',
      kind: 'watchlist',
      title: 'Watchlist updated',
      detail: 'Added Solana',
      time: 'Yesterday',
    },
  ]

  return [...analysisItems, ...mockItems]
}

/** The Oracle brief — the lead market's read on the user's window. */
export function oracleBrief(coin: Coin, timeframe: LiquidityTimeframe) {
  const status = marketStatus(coin, timeframe)
  const assessment = oracleAssessment(coin, timeframe)
  const change = windowReturn(coin, timeframe)
  return {
    observation: assessment.summary,
    timeframe: timeframe.id,
    bias: status.trend.label,
    tone: status.trend.tone,
    confidence: assessment.bullish,
    windowReturn: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
  }
}
