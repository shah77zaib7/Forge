import type { Coin } from '@/features/markets/types'
import {
  marketStatus,
  oracleAssessment,
  windowReturn,
  type LiquidityTimeframe,
  type Tone,
} from '@/features/workspace/data'

import type { OracleCard, Suggestion } from './types'

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

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** How long the staged thinking phase runs before a response streams in. */
export const THINK_DURATION = 3100

/** The staged analysis steps shown while Oracle "thinks" — aligned to the
 *  user's trading methodology (liquidity sweep → displacement → setup).
 *  The sequence advances only while the real request is in flight.
 */
export const THINK_STEPS = [
  'Reading market structure',
  'Checking liquidity',
  'Detecting displacement',
  'Evaluating the setup',
  'Generating analysis',
] as const

/** Friendly date for saved analyses — \"Today · 5:42 PM\", \"Yesterday\", \"Aug 6\". */
export function formatSavedDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return `Today · ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/* ------------------------------------------------------------------ */
/* Plain-text rendering — Copy action + saved summaries                */
/* ------------------------------------------------------------------ */

/**
 * A plain-text rendering of a response card — used by the Copy action
 * so users can paste a clean, structured read anywhere.
 */
export function cardToText(card: OracleCard): string {
  switch (card.kind) {
    case 'analysis':
      return [
        `Market Summary — ${card.market} (${card.ticker}) · ${card.timeframe} window`,
        `Bias: ${card.bias} · Confidence: ${card.confidence}%`,
        '',
        `Summary: ${card.summary}`,
        '',
        'Reasoning:',
        ...card.reasoning.map((point) => `• ${point}`),
        '',
        `Risk: ${card.risk}`,
        `Trade idea: ${card.tradeIdea}`,
        '',
        ...card.sections.map((section) => `${section.title}: ${section.items.join(' · ')}`),
      ].join('\n')
    case 'liquidity':
      return [
        `Liquidity Map — ${card.market} (${card.ticker}) · ${card.timeframe} window`,
        `Bias: ${card.bias}`,
        `Nearest buy: ${card.buy.price} (${card.buy.size}) · ${card.buy.distance}`,
        `Nearest sell: ${card.sell.price} (${card.sell.size}) · ${card.sell.distance}`,
        `Largest wall: ${card.largest.price} (${card.largest.size}) · ${card.largest.distance}`,
        '',
        card.summary,
      ].join('\n')
    case 'trade-setup':
      return [
        `Trade Setup — ${card.market} (${card.ticker}) · ${card.timeframe} window`,
        `Entry: ${card.entry} · Stop: ${card.stopLoss} · Target: ${card.takeProfit}`,
        `Risk / Reward: ${card.riskReward} · Confidence: ${card.confidence}%`,
        '',
        'Checklist:',
        ...card.checklist.map((item) => `• ${item}`),
      ].join('\n')
    case 'educational':
      return [
        card.concept,
        '',
        `Definition: ${card.definition}`,
        '',
        `Example: ${card.example}`,
        '',
        `When to use: ${card.whenToUse}`,
        '',
        'Common mistakes:',
        ...card.commonMistakes.map((item) => `• ${item}`),
      ].join('\n')
    case 'warning':
      return `${card.title}\n\n${card.body}`
    case 'comparison':
      return [
        `Comparison — ${card.primary.ticker} vs ${card.secondary.ticker} · ${card.timeframe} window`,
        '',
        ...card.rows.map((row) => `${row.metric}: ${row.primary} / ${row.secondary}`),
        '',
        `Conclusion: ${card.conclusion}`,
      ].join('\n')
    case 'market-brief':
      return [
        `Market Brief — ${card.market} (${card.ticker}) · ${card.timeframe} window`,
        card.headline,
        '',
        "What's happening:",
        ...card.happening.map((point) => `• ${point}`),
        '',
        'Why it matters:',
        ...card.whyItMatters.map((point) => `• ${point}`),
        '',
        'What to watch:',
        ...card.watch.map((point) => `• ${point}`),
      ].join('\n')
    case 'ai':
      return [
        `Oracle Analysis — ${card.analysis.sourceData.symbol} · ${card.analysis.sourceData.timeframe} · ${card.modelLabel}`,
        `Bias: ${card.analysis.bias} · Confidence: ${card.analysis.confidence}%`,
        '',
        `Summary: ${card.analysis.summary}`,
        '',
        `Setup: ${card.analysis.setup.family} (${card.analysis.setup.level})${card.analysis.setup.direction ? ` · ${card.analysis.setup.direction}` : ''}`,
        card.analysis.setup.entryArea ? `Entry area: ${card.analysis.setup.entryArea}` : null,
        `Invalidation: ${card.analysis.invalidation ?? 'none supplied'}`,
        '',
        'Reasoning:',
        ...card.analysis.reasoning.map((point) => `• ${point}`),
        '',
        'Risks:',
        ...card.analysis.risks.map((point) => `• ${point}`),
        '',
        `Source: ${card.analysis.sourceData.source} · ${card.analysis.sourceData.symbol} · ${card.analysis.sourceData.timeframe} · ${card.analysis.sourceData.candleCount} candles · ${card.analysis.sourceData.freshness}`,
        ...(card.meta ? [`Provider: ${card.meta.provider}${card.meta.estimatedCostUsd !== null ? ` · ~$${card.meta.estimatedCostUsd.toFixed(4)} est` : ''}`] : []),
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    case 'ai-error':
      return `${card.modelLabel} could not complete the analysis (${card.code})\n\n${card.message}${card.detail ? `\n\n${card.detail}` : ''}`
  }
}

/** One-line summary of a card — saved-analysis list + history rows. */
export function cardSummary(card: OracleCard): string {
  switch (card.kind) {
    case 'analysis':
      return `Bias ${card.bias} · ${card.confidence}% confidence`
    case 'liquidity':
      return `Buy ${card.buy.price} · Sell ${card.sell.price} · ${card.bias}`
    case 'trade-setup':
      return `Entry ${card.entry} · Stop ${card.stopLoss} · Target ${card.takeProfit} · ${card.riskReward}`
    case 'educational':
      return `Concept — ${card.concept}`
    case 'warning':
      return card.title
    case 'comparison':
      return `${card.primary.ticker} vs ${card.secondary.ticker}`
    case 'market-brief':
      return card.headline
    case 'ai':
      return `Bias ${card.analysis.bias} · ${card.analysis.confidence}% · ${card.analysis.setup.family}`
    case 'ai-error':
      return `${card.modelLabel} — ${card.code}`
  }
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
