import { coins } from '@/features/markets/data'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { formatChange } from '@/lib/format'

import {
  liquiditySnapshot,
  marketStatus,
  oracleAssessment,
  windowReturn,
  type LiquidityTimeframe,
  type Tone,
} from '@/features/workspace/data'

import type {
  AnalysisCard,
  EducationalCard,
  LiquidityCard,
  OracleCard,
  OracleContext,
  Suggestion,
  TradeSetupCard,
  WarningCard,
} from './types'

/* ------------------------------------------------------------------ */
/* Greeting + suggestions                                              */
/* ------------------------------------------------------------------ */

/** Time-aware greeting — Oracle speaks like an analyst, not a bot. */
export function getGreeting(): string {
  const hour = new Date().getHours()
  const part = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
  return `Good ${part}. What would you like to understand about the market today?`
}

export const suggestions: Suggestion[] = [
  { label: 'Analyze BTC', prompt: 'Analyze Bitcoin', coinId: 'bitcoin' },
  { label: 'Analyze SOL', prompt: 'Analyze Solana', coinId: 'solana' },
  { label: 'Explain Market Structure', prompt: 'Explain market structure' },
  { label: 'Find Liquidity', prompt: 'Where is the liquidity right now?' },
  { label: 'Is BTC bullish?', prompt: 'Is Bitcoin bullish right now?', coinId: 'bitcoin' },
  { label: 'Build Trading Plan', prompt: 'Build me a trading plan' },
  { label: "Explain today's move", prompt: "Explain today's move" },
  { label: 'Why is price rejecting?', prompt: 'Why is price rejecting?' },
]

/** Match a coin by ticker or name inside a prompt; fall back when unclear. */
export function resolveCoin(prompt: string, fallback: Coin): Coin {
  const hay = prompt.toLowerCase()
  const match = coins.find((coin) => {
    const ticker = coin.ticker.toLowerCase()
    const name = coin.name.toLowerCase()
    // Ticker first (compact, unambiguous), then full names (length-gated
    // so short words like "Near" don't false-positive on prose).
    return hay.includes(ticker) || (name.length > 3 && hay.includes(name))
  })
  return match ?? fallback
}

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/* ------------------------------------------------------------------ */
/* Market health — the sidebar scorecard                               */
/* ------------------------------------------------------------------ */

export interface MarketHealth {
  trend: { label: string; tone: Tone }
  confidence: number
  volatility: 'Low' | 'Medium' | 'High'
  risk: 'Low' | 'Medium' | 'High'
  momentum: string
}

export function marketHealth(coin: Coin, timeframe: LiquidityTimeframe): MarketHealth {
  const status = marketStatus(coin, timeframe)
  const assessment = oracleAssessment(coin, timeframe)
  const change = windowReturn(coin, timeframe)

  const vol = Math.abs(change) + timeframe.volatility
  const volatility = vol < 0.8 ? 'Low' : vol < 2.2 ? 'Medium' : 'High'

  const riskScore = (100 - assessment.bullish) * 0.5 + timeframe.volatility * 14
  const risk = riskScore > 45 ? 'High' : riskScore > 22 ? 'Medium' : 'Low'

  return {
    trend: status.trend,
    confidence: assessment.bullish,
    volatility,
    risk,
    momentum: status.momentum,
  }
}

/* ------------------------------------------------------------------ */
/* Response builders — deterministic per coin + window                 */
/* ------------------------------------------------------------------ */

const keyLevels = (coin: Coin, tf: LiquidityTimeframe) => {
  const [buy, sell, support, resistance] = liquiditySnapshot(coin, tf)
  return { buy, sell, support, resistance }
}

function buildAnalysisCard(ctx: OracleContext): AnalysisCard {
  const { coin, timeframe } = ctx
  const status = marketStatus(coin, timeframe)
  const assessment = oracleAssessment(coin, timeframe)
  const change = windowReturn(coin, timeframe)
  const { sell, support, resistance } = keyLevels(coin, timeframe)

  const bias = status.trend.label
  const tone = status.trend.tone

  const reasoning = [
    `Liquidity sweep ${change > 0 ? 'completed' : 'building'} at the nearest lows — resting orders fuel the move`,
    `${bias} displacement in the ${timeframe.id} window${change > 0 ? '' : ' lower'}`,
    bias === 'Bullish'
      ? 'Higher lows forming on the current market structure'
      : bias === 'Bearish'
        ? 'Lower highs forming on the current market structure'
        : 'Price is consolidating inside a balanced range',
    `Volume reads ${status.volume.toLowerCase()} for the window`,
    `Momentum is ${status.momentum.toLowerCase()} and supporting ${bias === 'Neutral' ? 'range conditions' : 'the read'}`,
  ]

  const tradeIdea =
    bias === 'Bullish'
      ? `Wait for a retracement toward support at ${support.value} before considering a long entry.`
      : bias === 'Bearish'
        ? `Wait for a pullback toward resistance at ${resistance.value} before considering a short entry.`
        : `Avoid chasing the range — wait for a confirmed breakout beyond ${support.value} / ${resistance.value}.`

  return {
    kind: 'analysis',
    market: coin.name,
    ticker: coin.ticker,
    timeframe: timeframe.id,
    bias,
    tone,
    confidence: assessment.bullish,
    summary: assessment.summary,
    reasoning,
    risk: `A ${sell.details?.[0]?.value ?? 'large'} sell wall sits above price at ${sell.value} — expect a reaction if it is reached.`,
    tradeIdea,
    sections: [
      { title: 'Key Levels', items: [`Support — ${support.value}`, `Resistance — ${resistance.value}`] },
      {
        title: 'Next Action',
        items:
          bias === 'Bullish'
            ? ['Watch for a hold above the open while the window matures.']
            : bias === 'Bearish'
              ? ['Watch for a failed retest of the level before shorting.']
              : ['Wait for either side of the range to give first.'],
      },
      {
        title: 'Invalidation',
        items: [`A close beyond ${bias === 'Bullish' ? support.value : resistance.value} invalidates the read.`],
      },
    ],
  }
}

/** Parse a formatted compact size like "$46.11M" back to a number. */
function parseCompact(value: string): number {
  const match = value.replace(/[$,]/g, '').match(/([\d.]+)([KMBT]?)/i)
  if (!match) return 0
  const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[match[2].toUpperCase()] ?? 1
  return parseFloat(match[1]) * multiplier
}

function buildLiquidityCard(ctx: OracleContext): LiquidityCard {
  const { coin, timeframe } = ctx
  const { buy, sell } = keyLevels(coin, timeframe)

  const buySize = parseCompact(buy.details?.[0]?.value ?? '0')
  const sellSize = parseCompact(sell.details?.[0]?.value ?? '0')
  const largest = buySize >= sellSize ? buy : sell
  const bias =
    buySize > sellSize * 1.15 ? 'Buy-side heavy' : sellSize > buySize * 1.15 ? 'Sell-side heavy' : 'Balanced'

  return {
    kind: 'liquidity',
    market: coin.name,
    ticker: coin.ticker,
    timeframe: timeframe.id,
    buy: { side: 'buy', price: buy.value, size: buy.details?.[0]?.value ?? '—', distance: buy.caption },
    sell: { side: 'sell', price: sell.value, size: sell.details?.[0]?.value ?? '—', distance: sell.caption },
    largest: {
      side: largest.icon === 'buy' ? 'buy' : 'sell',
      price: largest.value,
      size: largest.details?.[0]?.value ?? '—',
      distance: largest.caption,
    },
    bias,
    summary: `The nearest walls sit ${buy.caption} and ${sell.caption}. Order flow leans ${bias.toLowerCase()} in this window.`,
  }
}

function buildTradeSetupCard(ctx: OracleContext): TradeSetupCard {
  const { coin, timeframe } = ctx
  const assessment = oracleAssessment(coin, timeframe)
  const { support, resistance } = keyLevels(coin, timeframe)

  const entry = formatMarketPrice(coin.price)
  const stop = support.value
  const target = resistance.value
  const stopNum = Number(stop.replace(/,/g, '')) || coin.price
  const targetNum = Number(target.replace(/,/g, '')) || coin.price
  const riskPerUnit = coin.price - stopNum
  const rewardPerUnit = targetNum - coin.price
  const rr = riskPerUnit > 0 && rewardPerUnit > 0 ? (rewardPerUnit / riskPerUnit).toFixed(1) : '—'

  return {
    kind: 'trade-setup',
    market: coin.name,
    ticker: coin.ticker,
    timeframe: timeframe.id,
    entry,
    stopLoss: stop,
    takeProfit: target,
    riskReward: `${rr}:1`,
    confidence: assessment.bullish,
    checklist: [
      'Structure confirms the intended direction',
      'Liquidity swept on the entry side',
      'Volume supports the move',
      `Risk capped at ${stop}`,
      `Position sized for a ${rr}:1 reward`,
    ],
  }
}

interface Concept {
  concept: string
  definition: string
  example: string
  whenToUse: string
  commonMistakes: string[]
}

const concepts: Record<string, Concept> = {
  displacement: {
    concept: 'Displacement',
    definition:
      'A strong, impulsive move against the prevailing range — price breaks structure with aggression and little retracement. Displacement usually signals institutional intent rather than retail noise.',
    example:
      'Price sits in a tight range, then a single 4H candle drives through the high with above-average volume and closes near the top. That candle is displacement.',
    whenToUse: 'Use it to confirm a breakout is real, and to time entries after a liquidity sweep precedes the move.',
    commonMistakes: [
      'Chasing the candle after displacement is already extended',
      'Confusing a wide-range candle on low volume with displacement',
      'Ignoring the retracement that typically follows',
    ],
  },
  liquidity: {
    concept: 'Liquidity',
    definition:
      'Pools of resting orders — stop losses, limit orders and liquidation clusters — that price tends to sweep before continuing. Where liquidity sits, price is likely to visit.',
    example:
      'A cluster of stop-losses sits just below a support level. Price dips into them, triggers the stops, then reverses sharply higher. That dip was a liquidity sweep.',
    whenToUse: 'Use it to anticipate where price is likely to head, and to avoid entering right before a sweep.',
    commonMistakes: [
      'Placing stops exactly where everyone else has theirs',
      'Treating every sweep as a reversal signal',
      'Forgetting that liquidity is drawn to both sides of price',
    ],
  },
  'market structure': {
    concept: 'Market Structure',
    definition:
      'The sequence of higher highs and higher lows (bullish) or lower highs and lower lows (bearish) that defines the trend. Structure is the frame every other signal hangs on.',
    example:
      'Bitcoin prints a higher low, breaks its previous high, and continues to hold above each pullback — a textbook bullish structure.',
    whenToUse: 'Use it first, before indicators: trade with structure, not against it.',
    commonMistakes: [
      'Trading counter-trend without a structural reason',
      'Renaming every pullback a reversal',
      'Ignoring timeframes — structure on 1H can disagree with 1W',
    ],
  },
  momentum: {
    concept: 'Momentum',
    definition:
      'The speed and strength of price movement over a window. Strong momentum confirms direction; fading momentum warns that a move is losing conviction.',
    example:
      'A rally that keeps closing near its highs on rising volume shows momentum. One that stalls with shrinking candles shows momentum fading.',
    whenToUse: 'Use it to confirm entries and to exit before momentum fades into a range.',
    commonMistakes: [
      'Treating high momentum as a reason to chase into exhaustion',
      'Ignoring the volume half of the momentum read',
      'Using momentum as a standalone signal',
    ],
  },
  'support and resistance': {
    concept: 'Support & Resistance',
    definition:
      'Price levels where buyers (support) or sellers (resistance) have repeatedly stepped in. They act as magnets, and once broken they tend to flip roles.',
    example:
      'Every bounce off $140,900 builds a support shelf. When price finally breaks it, that same level becomes resistance on the retest.',
    whenToUse: 'Use them to set entries, stop-losses and take-profits — the whole trade plan hangs on them.',
    commonMistakes: [
      'Drawing levels as single lines instead of zones',
      'Ignoring the liquidity resting behind each level',
      'Not watching for the role flip after a break',
    ],
  },
  volume: {
    concept: 'Volume',
    definition:
      'The number of units traded in a window. It tells you whether a move carries conviction or is happening on thin air.',
    example:
      'A breakout on three times the average volume is meaningful. The same breakout on a quarter of average volume often fails.',
    whenToUse: 'Use it to validate breakouts, sweeps and momentum — confirm before you commit.',
    commonMistakes: [
      'Reading price without the volume context',
      'Assuming high volume always means continuation',
      'Forgetting to compare volume against its own average',
    ],
  },
}

function explainConcept(prompt: string): EducationalCard | null {
  const entry = Object.entries(concepts).find(([key]) => prompt.includes(key))
  if (!entry) return null
  const concept = entry[1]
  return {
    kind: 'educational',
    concept: concept.concept,
    definition: concept.definition,
    example: concept.example,
    whenToUse: concept.whenToUse,
    commonMistakes: concept.commonMistakes,
  }
}

function buildWarningCard(coin: Coin, timeframe: LiquidityTimeframe): WarningCard {
  if (Math.abs(coin.change24h) >= 5 || timeframe.volatility >= 2) {
    return {
      kind: 'warning',
      title: 'High volatility expected',
      body: `${coin.name} is trading with ${timeframe.volatility >= 2 ? 'above-average' : 'elevated'} volatility in the ${timeframe.id} window (24h move ${formatChange(coin.change24h)}). Avoid entering before confirmation — wait for a clean close before acting.`,
    }
  }
  return {
    kind: 'warning',
    title: 'Wait for confirmation',
    body: `The setup on ${coin.name} is not confirmed yet. Wait for a decisive close in the ${timeframe.id} window before committing — patience removes most losses.`,
  }
}

/** Append a volatility advisory after an analysis when conditions demand it. */
function volatilityWarning(coin: Coin, timeframe: LiquidityTimeframe): WarningCard | null {
  if (Math.abs(coin.change24h) < 5 && timeframe.volatility < 2) return null
  return buildWarningCard(coin, timeframe)
}

/**
 * Compose a full Oracle response for a prompt against the current context.
 * Returns one or more cards — an analysis can be followed by an advisory.
 */
export function buildOracleResponse(prompt: string, ctx: OracleContext): OracleCard[] {
  const { coin, timeframe } = ctx
  const lower = prompt.toLowerCase()

  const askingToLearn =
    lower.includes('explain') ||
    lower.includes('what is') ||
    lower.includes('whats') ||
    lower.includes('what does') ||
    lower.includes('meaning')

  if (askingToLearn) {
    const lesson = explainConcept(lower)
    if (lesson) return [lesson]
  }

  if (lower.includes('liquidity')) return [buildLiquidityCard(ctx)]
  if (lower.includes('plan') || lower.includes('setup') || lower.includes('trade')) {
    return [buildTradeSetupCard(ctx)]
  }
  if (
    lower.includes('volatile') ||
    lower.includes('warning') ||
    lower.includes('should i') ||
    lower.includes('crash') ||
    lower.includes('safe to')
  ) {
    return [buildWarningCard(coin, timeframe)]
  }

  const analysis = buildAnalysisCard(ctx)
  const advisory = volatilityWarning(coin, timeframe)
  return advisory ? [analysis, advisory] : [analysis]
}


