import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { formatChange } from '@/lib/format'
import { getCoins } from '@/store/market-data'
import {
  liquiditySnapshot,
  liquidityTimeframes,
  marketStatus,
  oracleAssessment,
  windowReturn,
  type LiquidityTimeframe,
  type LiquidityTimeframeId,
} from '@/features/workspace/data'

import type {
  ComparisonCard,
  EducationalCard,
  MarketBriefCard,
  OracleCard,
  OracleContext,
  OracleResponse,
  OracleService,
} from '../types'

/**
 * MockOracleService — the deterministic response engine.
 *
 * It receives the user message, the scoped conversation context and the
 * active mode, resolves follow-ups ("it", timeframe switches, asset
 * swaps, comparisons) against that context, and returns structured
 * OracleResponse cards — never raw text. Swapping in a real AI later
 * means replacing this single implementation of OracleService.
 */
export const oracleService: OracleService = {
  respond(request) {
    const { userMessage, conversation, mode } = request
    const lower = userMessage.toLowerCase()
    // The live universe at call time — Oracle analyzes real market data.
    const universe = getCoins()
    const hinted = request.coinIdHint ? universe.find((coin) => coin.id === request.coinIdHint) : undefined
    const mentioned = coinMentions(lower, universe)
    const primary = hinted ?? mentioned[0] ?? conversation.coin
    const hintedTf = request.timeframeIdHint
    const parsedTf = parseTimeframeId(lower)
    const tfId = hintedTf ?? parsedTf

    // Two-asset comparison — "it/this" points back at the conversation's
    // asset, so the fallback is the context coin, not the first mention.
    if (isComparison(lower)) {
      const { primary: a, secondary: b } = comparisonPair(
        lower,
        mentioned,
        conversation.coin,
        conversation.coin,
        universe,
      )
      const timeframe = tfId ? timeframeById(tfId) : conversation.timeframe
      return { cards: [buildComparisonCard(a, b, timeframe)], coin: a, timeframe }
    }

    // Market brief — "what's happening today" reads the 1D window by default.
    if (isBriefIntent(lower)) {
      const timeframe = tfId ? timeframeById(tfId) : timeframeById('1D')
      return { cards: [buildMarketBriefCard({ coin: primary, timeframe })], coin: primary, timeframe }
    }

    // Concept questions — "explain X" always; "why X" in Teacher mode.
    const askingToLearn = isLearnIntent(lower) || (mode === 'teacher' && lower.includes('why'))
    if (askingToLearn) {
      const lesson = explainConcept(lower) ?? (mode === 'teacher' ? conceptForWhy(lower) : null)
      if (lesson) {
        const timeframe = tfId ? timeframeById(tfId) : conversation.timeframe
        return { cards: [lesson], coin: primary, timeframe }
      }
    }

    const timeframe = tfId ? timeframeById(tfId) : conversation.timeframe
    const ctx: OracleContext = { coin: primary, timeframe }
    const wrap = (cards: OracleCard[]): OracleResponse => ({ cards, coin: primary, timeframe })

    if (lower.includes('liquidity')) return wrap([buildLiquidityCard(ctx)])
    if (lower.includes('plan') || lower.includes('setup') || lower.includes('trade')) {
      return wrap([buildTradeSetupCard(ctx)])
    }
    if (isWarningIntent(lower)) return wrap([buildWarningCard(primary, timeframe)])

    // Default analysis — the mode decides what rides along:
    // Trader adds an actionable setup, Teacher explains the concept the
    // current market is demonstrating.
    const cards: OracleCard[] = [buildAnalysisCard(ctx)]
    const advisory = volatilityWarning(primary, timeframe)
    if (advisory) cards.push(advisory)
    cards.push(mode === 'trader' ? buildTradeSetupCard(ctx) : conceptForState(primary, timeframe))
    return wrap(cards)
  },
}

/* ------------------------------------------------------------------ */
/* Intent parsing                                                      */
/* ------------------------------------------------------------------ */

const TIMEFRAME_MAP: Record<string, LiquidityTimeframeId> = {
  '1m': '1M',
  '5m': '5M',
  '15m': '15M',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1W',
}

/** Pull a window mention out of a prompt: \"what about 4h\" → 4H. */
export function parseTimeframeId(text: string): LiquidityTimeframeId | null {
  const match = text.toLowerCase().match(/\b(\d{1,2})\s*(m|h|d|w)\b/)
  if (!match) return null
  return TIMEFRAME_MAP[`${match[1]}${match[2]}`] ?? null
}

function timeframeById(id: LiquidityTimeframeId): LiquidityTimeframe {
  return liquidityTimeframes.find((tf) => tf.id === id) ?? liquidityTimeframes[0]
}

/** All coins mentioned in a prompt, in order of appearance. */
function coinMentions(text: string, universe: Coin[]): Coin[] {
  const lower = text.toLowerCase()
  const found: Coin[] = []
  for (const coin of universe) {
    const ticker = coin.ticker.toLowerCase()
    const name = coin.name.toLowerCase()
    // Ticker first (compact, unambiguous), then full names (length-gated
    // so short words like "Near" don't false-positive on prose).
    if (lower.includes(ticker) || (name.length > 3 && lower.includes(name))) found.push(coin)
  }
  return found
}

function isComparison(text: string): boolean {
  return text.includes('compare') || text.includes('versus') || /\bvs\b/.test(text)
}

function isBriefIntent(text: string): boolean {
  return (
    text.includes('today') ||
    text.includes('market update') ||
    text.includes('daily brief') ||
    text.includes('this week') ||
    text.includes('what is happening') ||
    text.includes("what's happening")
  )
}

function isLearnIntent(text: string): boolean {
  return (
    text.includes('explain') ||
    text.includes('what is') ||
    text.includes('whats') ||
    text.includes('what does') ||
    text.includes('meaning') ||
    text.includes('teach')
  )
}

const isWarningIntent = (text: string) =>
  text.includes('volatile') ||
  text.includes('warning') ||
  text.includes('should i') ||
  text.includes('crash') ||
  text.includes('safe to')

/** Resolve which asset is \"primary\" and which \"secondary\" for a comparison.
 *  \"it/this\" points back at the conversation's asset. */
function comparisonPair(
  text: string,
  mentioned: Coin[],
  fallback: Coin,
  conversationCoin: Coin,
  universe: Coin[],
): { primary: Coin; secondary: Coin } {
  const pronoun = /\b(it|this|that|them|there)\b/.test(text) || text.includes('compare with') || text.includes('compare to')

  let primary: Coin
  let secondary: Coin
  if (mentioned.length >= 2) {
    primary = mentioned[0]
    secondary = mentioned[1]
  } else if (mentioned.length === 1) {
    if (pronoun) {
      primary = fallback
      secondary = mentioned[0]
    } else {
      primary = mentioned[0]
      secondary = fallback
    }
  } else {
    primary = fallback
    secondary = conversationCoin
  }
  if (secondary.id === primary.id) {
    secondary = universe.find((coin) => coin.id !== primary.id) ?? primary
  }
  return { primary, secondary }
}

/* ------------------------------------------------------------------ */
/* Concept library — the Teacher's shelf                               */
/* ------------------------------------------------------------------ */

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

function educationalCard(key: string): EducationalCard {
  const concept = concepts[key]
  return {
    kind: 'educational',
    concept: concept.concept,
    definition: concept.definition,
    example: concept.example,
    whenToUse: concept.whenToUse,
    commonMistakes: concept.commonMistakes,
  }
}

function explainConcept(prompt: string): EducationalCard | null {
  const entry = Object.entries(concepts).find(([key]) => prompt.includes(key))
  return entry ? educationalCard(entry[0]) : null
}

/** Teacher mode answers \"why…?\" by mapping the topic to a concept. */
function conceptForWhy(prompt: string): EducationalCard | null {
  const map: Array<[RegExp, string]> = [
    [/displacement/, 'displacement'],
    [/liquidity|sweep/, 'liquidity'],
    [/reject|resistance|support/, 'support and resistance'],
    [/volume/, 'volume'],
    [/momentum/, 'momentum'],
    [/bullish|bearish|trend|structure|breakout|pullback|range/, 'market structure'],
  ]
  for (const [pattern, key] of map) {
    if (pattern.test(prompt)) return educationalCard(key)
  }
  return null
}

/** Teacher mode attaches the concept the current market is demonstrating. */
function conceptForState(coin: Coin, timeframe: LiquidityTimeframe): EducationalCard {
  const status = marketStatus(coin, timeframe)
  if (status.volume === 'Above Average') return educationalCard('volume')
  if (status.momentum === 'Strong' || status.momentum === 'Weak') return educationalCard('momentum')
  if (status.trend.label !== 'Neutral') return educationalCard('market structure')
  return educationalCard('support and resistance')
}

/* ------------------------------------------------------------------ */
/* Card builders                                                       */
/* ------------------------------------------------------------------ */

const keyLevels = (coin: Coin, tf: LiquidityTimeframe) => {
  const [buy, sell, support, resistance] = liquiditySnapshot(coin, tf)
  return { buy, sell, support, resistance }
}

function buildAnalysisCard(ctx: OracleContext): OracleCard {
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

function buildLiquidityCard(ctx: OracleContext): OracleCard {
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

function buildTradeSetupCard(ctx: OracleContext): OracleCard {
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

function buildWarningCard(coin: Coin, timeframe: LiquidityTimeframe): OracleCard {
  if (Math.abs(coin.change24h ?? 0) >= 5 || timeframe.volatility >= 2) {
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
function volatilityWarning(coin: Coin, timeframe: LiquidityTimeframe): OracleCard | null {
  if (Math.abs(coin.change24h ?? 0) < 5 && timeframe.volatility < 2) return null
  return buildWarningCard(coin, timeframe)
}

function buildComparisonCard(
  primary: Coin,
  secondary: Coin,
  timeframe: LiquidityTimeframe,
): ComparisonCard {
  const read = (coin: Coin) => {
    const status = marketStatus(coin, timeframe)
    return {
      trend: status.trend.label,
      momentum: status.momentum,
      structure: status.structure,
      volume: status.volume,
      confidence: oracleAssessment(coin, timeframe).bullish,
    }
  }
  const p = read(primary)
  const s = read(secondary)
  const changeP = windowReturn(primary, timeframe)
  const changeS = windowReturn(secondary, timeframe)

  let conclusion: string
  if (p.trend === s.trend) {
    const pStronger = changeP >= changeS
    const lead = pStronger ? primary : secondary
    const trail = pStronger ? secondary : primary
    conclusion = `Both ${primary.ticker} and ${secondary.ticker} read ${p.trend.toLowerCase()} on the ${timeframe.id} window, but ${lead.ticker} carries the stronger hand — ${pStronger ? p.momentum : s.momentum} momentum with ${pStronger ? p.volume : s.volume} volume, versus ${trail.ticker}'s ${pStronger ? s.momentum : p.momentum}. Confidence reads ${p.confidence}% / ${s.confidence}%.`
  } else {
    conclusion = `${primary.ticker} reads ${p.trend.toLowerCase()} while ${secondary.ticker} reads ${s.trend.toLowerCase()} on the ${timeframe.id} window — a real divergence (confidence ${p.confidence}% / ${s.confidence}%). Trade each asset against its own structure rather than forcing one market view.`
  }

  return {
    kind: 'comparison',
    primary: { market: primary.name, ticker: primary.ticker },
    secondary: { market: secondary.name, ticker: secondary.ticker },
    timeframe: timeframe.id,
    rows: [
      { metric: 'Trend', primary: p.trend, secondary: s.trend },
      { metric: 'Momentum', primary: p.momentum, secondary: s.momentum },
      { metric: 'Structure', primary: p.structure, secondary: s.structure },
      { metric: 'Volume', primary: p.volume, secondary: s.volume },
      { metric: 'Confidence', primary: `${p.confidence}%`, secondary: `${s.confidence}%` },
    ],
    conclusion,
  }
}

function buildMarketBriefCard(ctx: OracleContext): MarketBriefCard {
  const { coin, timeframe } = ctx
  const status = marketStatus(coin, timeframe)
  const assessment = oracleAssessment(coin, timeframe)
  const change = windowReturn(coin, timeframe)
  const { buy, sell, support, resistance } = keyLevels(coin, timeframe)
  const trend = status.trend.label

  return {
    kind: 'market-brief',
    market: coin.name,
    ticker: coin.ticker,
    timeframe: timeframe.id,
    headline: `${coin.name} is ${trend.toLowerCase()} on the ${timeframe.id} window with ${status.momentum.toLowerCase()} momentum and ${status.volume.toLowerCase()} volume.`,
    happening: [
      `${coin.name} trades near ${formatMarketPrice(coin.price)} — a ${formatChange(change)} read for the window.`,
      `Structure is ${status.structure.toLowerCase()} and the tape bias reads ${status.bias.toLowerCase()}.`,
      `Volume runs ${status.volume.toLowerCase()} relative to its own average.`,
    ],
    whyItMatters: [
      `Buyers cluster at ${buy.value} (${buy.caption}); sellers sit at ${sell.value} (${sell.caption}).`,
      `Support holds at ${support.value} and resistance at ${resistance.value}.`,
      assessment.summary,
    ],
    watch: [
      trend === 'Neutral'
        ? 'Wait for a decisive breakout beyond either level before committing.'
        : `A retest of ${trend === 'Bullish' ? support.value : resistance.value} is the entry zone to watch.`,
      `A close beyond ${trend === 'Bullish' ? resistance.value : support.value} extends the read; losing the far side flips it.`,
    ],
  }
}
