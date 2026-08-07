import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframe, LiquidityTimeframeId, Tone } from '@/features/workspace/data'

/** A labeled block inside an analysis response (Key Levels, Next Action…). */
export interface AnalysisSection {
  title: string
  items: string[]
}

/** The signature Oracle read — a mini Bloomberg-style report. */
export interface AnalysisCard {
  kind: 'analysis'
  market: string
  ticker: string
  timeframe: LiquidityTimeframeId
  bias: string
  tone: Tone
  confidence: number
  summary: string
  reasoning: string[]
  risk: string
  tradeIdea: string
  sections: AnalysisSection[]
}

export interface LiquidityWall {
  side: 'buy' | 'sell'
  price: string
  size: string
  distance: string
}

/** Depth read — the nearest walls and which side holds the weight. */
export interface LiquidityCard {
  kind: 'liquidity'
  market: string
  ticker: string
  timeframe: LiquidityTimeframeId
  buy: LiquidityWall
  sell: LiquidityWall
  largest: LiquidityWall
  bias: string
  summary: string
}

/** A structured trade idea with entry, invalidation and a checklist. */
export interface TradeSetupCard {
  kind: 'trade-setup'
  market: string
  ticker: string
  timeframe: LiquidityTimeframeId
  entry: string
  stopLoss: string
  takeProfit: string
  riskReward: string
  confidence: number
  checklist: string[]
}

/** A calm explanation of a market concept, with a diagram placeholder. */
export interface EducationalCard {
  kind: 'educational'
  concept: string
  definition: string
  example: string
  whenToUse: string
  commonMistakes: string[]
}

/** Amber advisory — high volatility, wait-for-confirmation warnings. */
export interface WarningCard {
  kind: 'warning'
  title: string
  body: string
}

export type OracleCard = AnalysisCard | LiquidityCard | TradeSetupCard | EducationalCard | WarningCard

export interface OracleMessage {
  id: string
  role: 'user' | 'oracle'
  /** Local display time, e.g. "14:32". */
  time: string
  text?: string
  card?: OracleCard
  /** True while the mock stream is still revealing content. */
  streaming?: boolean
}

/** Everything Oracle needs to reason about a question. */
export interface OracleContext {
  coin: Coin
  timeframe: LiquidityTimeframe
}

export interface Suggestion {
  label: string
  prompt: string
  coinId?: string
}
