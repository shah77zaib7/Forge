import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { formatCompact } from '@/lib/format'
import { getCoins } from '@/store/market-data'

/* ============================================================
   Deterministic mock data for the Coin Workspace.
   Every figure derives from the coin itself via a seeded RNG,
   so the same coin always renders the same "market" — no jitter
   across navigations, and no live APIs yet.
   ============================================================ */

export type TimeframeId = '1H' | '4H' | '1D' | '1W' | '1M' | 'YTD' | 'ALL'

export interface Timeframe {
  id: TimeframeId
  /** Sample count for the mock series. */
  points: number
  /** Per-sample volatility — grows with the window. */
  volatility: number
  /** Scales the coin's 24h volume into this window's volume figure. */
  volumeFactor: number
}

export const timeframes: Timeframe[] = [
  { id: '1H', points: 60, volatility: 0.002, volumeFactor: 0.05 },
  { id: '4H', points: 96, volatility: 0.004, volumeFactor: 0.2 },
  { id: '1D', points: 96, volatility: 0.005, volumeFactor: 1 },
  { id: '1W', points: 168, volatility: 0.012, volumeFactor: 6.5 },
  { id: '1M', points: 120, volatility: 0.02, volumeFactor: 27 },
  { id: 'YTD', points: 160, volatility: 0.035, volumeFactor: 190 },
  { id: 'ALL', points: 200, volatility: 0.06, volumeFactor: 460 },
]

/* ------------------------------------------------------------------ */
/* Seeded RNG                                                          */
/* ------------------------------------------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* Chart — a seeded log-return walk that ends exactly at spot price    */
/* ------------------------------------------------------------------ */

export function chartSeries(coin: Coin, timeframe: Timeframe): number[] {
  const rand = mulberry32(hashString(`${coin.id}:${timeframe.id}`))
  const stepDrift = (coin.change24h / 100) * timeframe.volatility * 0.9
  const logs: number[] = []
  let log = 0
  for (let i = 0; i < timeframe.points; i++) {
    log += (rand() - 0.48) * timeframe.volatility * 2 + stepDrift
    logs.push(log)
  }
  const end = logs[logs.length - 1]
  return logs.map((value) => coin.price * Math.exp(value - end))
}

export interface Ohlcv {
  high: number
  low: number
  open: number
  close: number
  volume: number
}

export function ohlcv(coin: Coin, timeframe: Timeframe, series: number[]): Ohlcv {
  const rand = mulberry32(hashString(`${coin.id}:${timeframe.id}:ohlcv`))
  return {
    high: Math.max(...series) * (1 + rand() * 0.0015),
    low: Math.min(...series) * (1 - rand() * 0.0015),
    open: series[0],
    close: coin.price,
    volume: coin.volume24h * timeframe.volumeFactor * (0.85 + rand() * 0.3),
  }
}

/* ------------------------------------------------------------------ */
/* Oracle — a composed, timeframe-aware AI assessment                  */
/* ------------------------------------------------------------------ */

export type Tone = 'positive' | 'negative' | 'neutral'

export interface OracleAssessment {
  summary: string
  bullish: number
  neutral: number
  bearish: number
}

/** The factors Oracle states it weighs — shown on the card for trust. */
export const oracleInputs = [
  'Selected Timeframe',
  'Liquidity',
  'Market Structure',
  'Volume',
  'Momentum',
] as const

/**
 * The window's expected return, in percent. One seeded draw shared by
 * every timeframe-aware surface (status, oracle, depth) so the whole
 * workspace tells the same story per window.
 */
export function windowReturn(coin: Coin, timeframe: LiquidityTimeframe): number {
  const rand = mulberry32(hashString(`${coin.id}:window:${timeframe.id}`))
  return coin.change24h * timeframe.returnFactor + (rand() - 0.5) * timeframe.volatility * 1.6
}

export function oracleAssessment(coin: Coin, timeframe: LiquidityTimeframe): OracleAssessment {
  const rand = mulberry32(hashString(`${coin.id}:oracle:${timeframe.id}`))
  const change = windowReturn(coin, timeframe)
  const score = change / Math.max(timeframe.volatility, 0.1)

  let summary: string
  let bullish: number

  if (score > 1.4) {
    summary = `On the ${timeframe.id} window, ${coin.name} is pressing toward recent highs with momentum firmly in buyers' hands. Volume is confirming the move, and pullbacks are being absorbed quickly.`
    bullish = 78 + Math.round(rand() * 12)
  } else if (score > 0.4) {
    summary = `On the ${timeframe.id} window, ${coin.name} holds above its recent support while momentum stays positive. Buyers are in control of the short-term trend.`
    bullish = 60 + Math.round(rand() * 14)
  } else if (score > -0.4) {
    summary = `On the ${timeframe.id} window, ${coin.name} is consolidating inside a balanced range. Neither side has asserted control yet — the market is waiting for a catalyst before choosing direction.`
    bullish = 40 + Math.round(rand() * 12)
  } else if (score > -1.4) {
    summary = `On the ${timeframe.id} window, ${coin.name} has slipped below near-term support with sellers in control. Watch for a stabilizing close before the risk skew returns to neutral.`
    bullish = 22 + Math.round(rand() * 10)
  } else {
    summary = `On the ${timeframe.id} window, ${coin.name} is under sustained selling pressure. Sellers control the tape and dips keep getting sold until volume confirms a turn.`
    bullish = 8 + Math.round(rand() * 10)
  }

  bullish = Math.min(bullish, 90)
  const bearish = Math.min(70, Math.max(6, Math.round((100 - bullish) * (0.2 + rand() * 0.35))))
  const neutral = Math.max(4, 100 - bullish - bearish)

  return { summary, bullish, neutral, bearish }
}

/* ------------------------------------------------------------------ */
/* Market status — the "what's happening right now" pulse card         */
/* ------------------------------------------------------------------ */

export interface MarketStatusData {
  trend: { label: 'Bullish' | 'Bearish' | 'Neutral'; direction: 'up' | 'down' | 'flat'; tone: Tone }
  momentum: string
  volume: string
  structure: string
  bias: string
}

export function marketStatus(coin: Coin, timeframe: LiquidityTimeframe): MarketStatusData {
  const rand = mulberry32(hashString(`${coin.id}:status:${timeframe.id}`))
  const change = windowReturn(coin, timeframe)
  const score = Math.abs(change) / Math.max(timeframe.volatility, 0.1)

  const trend: MarketStatusData['trend'] =
    change > 0.1
      ? { label: 'Bullish', direction: 'up', tone: 'positive' }
      : change < -0.1
        ? { label: 'Bearish', direction: 'down', tone: 'negative' }
        : { label: 'Neutral', direction: 'flat', tone: 'neutral' }

  const momentum = score > 0.8 ? 'Strong' : score > 0.35 ? 'Moderate' : 'Weak'

  // Longer windows naturally carry more traded volume.
  const volumeScore = 0.25 + rand() * 0.5 + timeframe.sizeFactor * 0.08
  const volume = volumeScore > 0.7 ? 'Above Average' : volumeScore > 0.35 ? 'Average' : 'Below Average'

  const structure =
    trend.label === 'Bullish'
      ? rand() > 0.5
        ? 'Higher Highs'
        : 'Higher Lows'
      : trend.label === 'Bearish'
        ? rand() > 0.5
          ? 'Lower Lows'
          : 'Lower Highs'
        : 'Range Bound'

  const bias =
    score > 0.9 && volume === 'Above Average'
      ? 'Breakout'
      : Math.abs(change) > 0.15 && change * coin.change24h < 0
        ? 'Reversal'
        : Math.abs(change) < 0.15
          ? 'Range'
          : 'Continuation'

  return { trend, momentum, volume, structure, bias }
}

/* ------------------------------------------------------------------ */
/* Market stats                                                        */
/* ------------------------------------------------------------------ */

export interface MarketStat {
  label: string
  value: string
}

export function marketStats(coin: Coin): MarketStat[] {
  const rand = mulberry32(hashString(`${coin.id}:stats`))
  // Total cap comes from the live universe so derived shares stay real.
  const totalCap = getCoins().reduce((sum, market) => sum + market.marketCap, 0)
  const maxSupply = coin.supply * (1.05 + rand() * 0.4)
  const fdv = coin.marketCap * (maxSupply / coin.supply)
  const liquidity = coin.volume24h * (0.6 + rand() * 0.5)
  const dominance = (coin.marketCap / totalCap) * 100
  const volatility = Math.max(0.4, Math.abs(coin.change24h) * (0.7 + rand() * 0.6))

  return [
    { label: 'Market Cap', value: `$${formatCompact(coin.marketCap)}` },
    { label: 'FDV', value: `$${formatCompact(fdv)}` },
    { label: 'Volume 24h', value: `$${formatCompact(coin.volume24h)}` },
    { label: 'Liquidity', value: `$${formatCompact(liquidity)}` },
    { label: 'Circulating Supply', value: `${formatCompact(coin.supply)} ${coin.ticker}` },
    { label: 'Max Supply', value: `${formatCompact(maxSupply)} ${coin.ticker}` },
    { label: 'Dominance', value: `${dominance.toFixed(1)}%` },
    { label: 'Volatility 24h', value: `${volatility.toFixed(1)}%` },
  ]
}

/* ------------------------------------------------------------------ */
/* Liquidity snapshot — Forge's signature depth view                   */
/* ------------------------------------------------------------------ */

export type LiquidityTimeframeId = '1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'

export interface LiquidityTimeframe {
  id: LiquidityTimeframeId
  /** Scales the coin's 24h change into this window's expected return. */
  returnFactor: number
  /** Percentage spread of the window — drives wall & level distances. */
  volatility: number
  /** Scales depth size relative to the 24h baseline. */
  sizeFactor: number
}

export const liquidityTimeframes: LiquidityTimeframe[] = [
  { id: '1M', returnFactor: 0.06, volatility: 0.08, sizeFactor: 0.5 },
  { id: '5M', returnFactor: 0.12, volatility: 0.12, sizeFactor: 0.65 },
  { id: '15M', returnFactor: 0.25, volatility: 0.2, sizeFactor: 0.8 },
  { id: '1H', returnFactor: 0.45, volatility: 0.35, sizeFactor: 1 },
  { id: '4H', returnFactor: 0.7, volatility: 0.7, sizeFactor: 1.25 },
  { id: '1D', returnFactor: 1, volatility: 1.2, sizeFactor: 1.5 },
  { id: '1W', returnFactor: 2.4, volatility: 3, sizeFactor: 2.2 },
]

/** The depth view opens on this window. */
export const DEFAULT_LIQUIDITY_TIMEFRAME: LiquidityTimeframeId = '1H'

export interface LiquidityItem {
  label: string
  icon: 'buy' | 'sell' | 'support' | 'resistance' | 'trend'
  value: string
  caption: string
  tone: Tone
  /** Secondary stat rows under the primary value (e.g. order size). */
  details?: Array<{ label: string; value: string }>
}

const formatDistance = (value: number) => (value < 0.1 ? `${value.toFixed(2)}%` : `${value.toFixed(1)}%`)

/**
 * The depth book for a given window. Short timeframes show a tight,
 * shallow book near spot; longer ones widen the walls and levels and
 * surface more size. Trend derives from the window's expected return,
 * so it can disagree with the 24h header — that is the point.
 */
export function liquiditySnapshot(coin: Coin, timeframe: LiquidityTimeframe): LiquidityItem[] {
  const rand = mulberry32(hashString(`${coin.id}:liquidity:${timeframe.id}`))
  const spot = coin.price

  const change = windowReturn(coin, timeframe)
  const uptrend = change > 0.1
  const downtrend = change < -0.1

  // Buy / sell walls — buy sits just under spot, sell just above,
  // spreading with the window. Size grows with the window's volume.
  const buyDistance = timeframe.volatility * (0.5 + rand() * 0.7)
  const sellDistance = timeframe.volatility * (0.55 + rand() * 0.8)
  const buyPrice = spot * (1 - buyDistance / 100)
  const sellPrice = spot * (1 + sellDistance / 100)
  const buyDepth = coin.volume24h * timeframe.sizeFactor * (0.004 + rand() * 0.007)
  const sellDepth = coin.volume24h * timeframe.sizeFactor * (0.0035 + rand() * 0.006)

  // Levels stay coherent with the book — support below the buy wall,
  // resistance above the sell wall.
  const support = buyPrice * (1 - (timeframe.volatility * (0.3 + rand() * 0.6)) / 100)
  const resistance = sellPrice * (1 + (timeframe.volatility * (0.35 + rand() * 0.7)) / 100)

  return [
    {
      label: 'Nearest Buy Liquidity',
      icon: 'buy',
      value: formatMarketPrice(buyPrice),
      caption: `${formatDistance(buyDistance)} below spot`,
      tone: 'neutral',
      details: [{ label: 'Size', value: `$${formatCompact(buyDepth)}` }],
    },
    {
      label: 'Nearest Sell Liquidity',
      icon: 'sell',
      value: formatMarketPrice(sellPrice),
      caption: `${formatDistance(sellDistance)} above spot`,
      tone: 'neutral',
      details: [{ label: 'Size', value: `$${formatCompact(sellDepth)}` }],
    },
    {
      label: 'Strong Support',
      icon: 'support',
      value: formatMarketPrice(support),
      caption: 'Level to watch',
      tone: 'neutral',
    },
    {
      label: 'Strong Resistance',
      icon: 'resistance',
      value: formatMarketPrice(resistance),
      caption: 'Level to watch',
      tone: 'neutral',
    },
    {
      label: 'Trend',
      icon: 'trend',
      value: uptrend ? 'Uptrend' : downtrend ? 'Downtrend' : 'Sideways',
      caption: uptrend ? 'Momentum positive' : downtrend ? 'Momentum negative' : 'Range bound',
      tone: uptrend ? 'positive' : downtrend ? 'negative' : 'neutral',
    },
  ]
}

/* ------------------------------------------------------------------ */
/* News — mock headlines with coin-specific copy                       */
/* ------------------------------------------------------------------ */

export interface NewsItem {
  source: string
  headline: string
  time: string
}

const headlines: Array<{ source: string; make: (name: string, ticker: string) => string }> = [
  { source: 'Forge Wire', make: (name) => `${name} holds key support as buyers defend the range` },
  { source: 'Blockbeat', make: (_name, ticker) => `On-chain activity for ${ticker} climbs as accumulation persists` },
  { source: 'The Ledger', make: (_name, ticker) => `${ticker} options market tilts bullish into the week ahead` },
  { source: 'ChainSignal', make: (name, ticker) => `Whale wallets move ${ticker} ahead of ${name}'s next move` },
  { source: 'Deep Pool', make: (name) => `Liquidity depth around ${name} thins near current levels` },
  { source: 'Meridian Daily', make: (_name, ticker) => `Derivatives funding turns positive as ${ticker} momentum builds` },
  { source: 'Forge Wire', make: (name) => `${name} network metrics steady amid broader market swings` },
  { source: 'The Ledger', make: (name) => `Analysts weigh ${name}'s path after a quiet session` },
]

const times: Array<{ label: string; minutes: number }> = [
  { label: '2m ago', minutes: 2 },
  { label: '14m ago', minutes: 14 },
  { label: '38m ago', minutes: 38 },
  { label: '1h ago', minutes: 60 },
  { label: '2h ago', minutes: 120 },
  { label: '4h ago', minutes: 240 },
  { label: '9h ago', minutes: 540 },
  { label: 'Yesterday', minutes: 1440 },
]

export function newsFor(coin: Coin, count = 4): NewsItem[] {
  const offset = hashString(`${coin.id}:news`) % headlines.length
  const picks = Array.from({ length: count }, (_, index) => {
    const entry = headlines[(offset + index) % headlines.length]
    const time = times[(offset + index) % times.length]
    return {
      source: entry.source,
      headline: entry.make(coin.name, coin.ticker),
      time: time.label,
      minutes: time.minutes,
    }
  }).sort((a, b) => a.minutes - b.minutes)
  return picks.map(({ source, headline, time }) => ({ source, headline, time }))
}

/* ------------------------------------------------------------------ */
/* Related markets — top of the live universe by cap, stables excluded */
/* ------------------------------------------------------------------ */

export function relatedMarkets(coin: Coin, count = 8): Coin[] {
  // The shared universe is ordered by live market cap already.
  return getCoins()
    .filter((market) => market.id !== coin.id && !market.categories.includes('stable'))
    .slice(0, count)
}
