import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframe, LiquidityTimeframeId, Tone } from '@/features/workspace/data'

/** Analyst persona — Trader keeps it actionable, Teacher explains why. */
export type OracleMode = 'trader' | 'teacher'

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

/** One metric row in a two-asset comparison table. */
export interface ComparisonRow {
  metric: string
  primary: string
  secondary: string
}

/** Side-by-side read of two assets on a shared window. */
export interface ComparisonCard {
  kind: 'comparison'
  primary: { market: string; ticker: string }
  secondary: { market: string; ticker: string }
  timeframe: LiquidityTimeframeId
  rows: ComparisonRow[]
  conclusion: string
}

/** \"What's happening today\" — a scannable daily brief. */
export interface MarketBriefCard {
  kind: 'market-brief'
  market: string
  ticker: string
  timeframe: LiquidityTimeframeId
  headline: string
  happening: string[]
  whyItMatters: string[]
  watch: string[]
}

export type OracleCard =
  | AnalysisCard
  | LiquidityCard
  | TradeSetupCard
  | EducationalCard
  | WarningCard
  | ComparisonCard
  | MarketBriefCard

export interface OracleMessage {
  id: string
  role: 'user' | 'oracle'
  /** Local display time, e.g. \"14:32\". */
  time: string
  text?: string
  /** Chart the user attached to this message (user messages only). */
  chart?: Coin
  card?: OracleCard
  /** True while the mock stream is still revealing content. */
  streaming?: boolean
  /** The prompt that produced this exchange — lets Regenerate replay it. */
  prompt?: string
  /** Coin the response was built against (oracle messages only). */
  coinId?: string
  /** Window the response was built on (oracle messages only). */
  timeframeId?: LiquidityTimeframeId
  /** Groups a user turn with its oracle responses — used for dividers
   *  and for regenerating a single exchange. */
  exchange?: string
  /** True when the message was restored from saved history. */
  fromHistory?: boolean
}

/** Everything a card builder needs to reason about a question. */
export interface OracleContext {
  coin: Coin
  timeframe: LiquidityTimeframe
}

/** What Oracle remembers about the current conversation — scoped to it,
 *  never persisted. The real-AI service will receive this same shape. */
export interface ConversationContext {
  coin: Coin
  timeframe: LiquidityTimeframe
  mode: OracleMode
  recentUserMessages: string[]
  recentPrompts: string[]
}

/** The input contract for the response engine. */
export interface OracleRequest {
  userMessage: string
  conversation: ConversationContext
  mode: OracleMode
  /** Suggestion chips pin the asset even when the prompt is generic. */
  coinIdHint?: string
  /** Regenerate pins the window the original read was built on. */
  timeframeIdHint?: LiquidityTimeframeId
}

/** A structured engine reply — the UI renders cards, never raw text. */
export interface OracleResponse {
  cards: OracleCard[]
  coin: Coin
  timeframe: LiquidityTimeframe
}

/**
 * The response engine contract. MockOracleService implements it today;
 * a RealOracleService can swap in later without touching the UI.
 */
export interface OracleService {
  respond(request: OracleRequest): OracleResponse
}

/** The exact market read Oracle is working from — what the Market
 *  Context sheet displays. Same shape a live market-data adapter fills. */
export interface MarketContextSnapshot {
  coinId: string
  name: string
  ticker: string
  timeframeId: LiquidityTimeframeId
  price: string
  change24h: string
  /** Expected return for the selected window, in percent. */
  windowReturn: string
  trend: string
  trendTone: Tone
  structure: string
  momentum: string
  volume: string
  buyLiquidity: string
  sellLiquidity: string
  support: string
  resistance: string
  updatedAt: number
}

/** A user-saved Oracle read, persisted locally on this device. */
export interface SavedAnalysis {
  id: string
  coinId: string
  timeframeId: LiquidityTimeframeId
  prompt: string
  card: OracleCard
  summary: string
  mode: OracleMode
  createdAt: number
}

export interface Suggestion {
  label: string
  prompt: string
  coinId?: string
}
