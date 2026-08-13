/**
 * Forge V2 engine entry — the ONE place the ecosystem gets its deterministic
 * market state from. It wires the existing deterministic layers together:
 *
 *   live candles + TimeframeAnalysis (market-intelligence.ts)
 *        ↓
 *   Setup Intelligence (setup-intelligence.ts) — sweep/displacement/
 *        pullback/confirmation/context reads, configurable via V2 params
 *        ↓
 *   analyzeForgeV2 (this module) → canonical ForgeMarketState
 *        ↓
 *   Workspace UI · Oracle · Journal · Analytics · future AI models
 *
 * The engine never re-derives the methodology — it consumes the same
 * TimeframeAnalysis both surfaces already use, so UI and Oracle can never
 * disagree. Every score contribution is traceable to a group and a reason;
 * the active configuration snapshot travels with the state so consumers can
 * tell exactly which parameters produced the read.
 */

import type { Candle } from '../history'
import type { TimeframeAnalysis } from '../market-intelligence'
import { assessSetupIntelligence, type ConfirmationSeries, type SetupIntelligence } from '../setup-intelligence'
import { mergeV2Config, v2ConfigToSetupOptions, type V2ConfigPatch } from './config'
import type { ForgeMarketState } from './types'

export interface ForgeV2Input {
  /** Canonical asset id, e.g. 'gold' or 'BTC'. */
  asset: string
  /** Workspace window id, e.g. '1H'. */
  timeframe: string
  /** The deterministic engine analysis (real zones, sweeps, structure). */
  analysis: TimeframeAnalysis
  /** The window's own candle series. */
  candles: Candle[]
  /** Optional separate series for confirmations (1M execution model). */
  confirmationSeries?: ConfirmationSeries
  /** Partial V2 config — merged over defaults, clamped to sane bounds. */
  config?: V2ConfigPatch
}

/**
 * Build the canonical Forge V2 market state for one window. Pure and
 * deterministic: identical inputs always produce an identical state.
 * `status: 'insufficient'` when the underlying analysis has no usable data —
 * never a fabricated setup.
 */
export function analyzeForgeV2(input: ForgeV2Input): ForgeMarketState {
  const config = mergeV2Config(input.config)
  const { analysis, candles } = input

  const intelligence: SetupIntelligence = assessSetupIntelligence(
    analysis,
    candles,
    input.asset,
    v2ConfigToSetupOptions(config),
    input.confirmationSeries,
  )

  const quality = intelligence.setupQuality

  return {
    engine: 'forge-v2',
    version: 2,
    market: {
      asset: input.asset,
      timeframe: input.timeframe,
      candleGranularity: analysis.candleGranularity,
      candleCount: candles.length,
      currentPrice: analysis.currentPrice,
      atr: analysis.atr,
    },
    liquidity: {
      buySide: analysis.liquidity.buySide,
      sellSide: analysis.liquidity.sellSide,
      contribution: quality.contributions.liquidity,
      reasons: quality.reasons.filter((reason) => /liquidity/i.test(reason)),
    },
    sweeps: {
      records: analysis.sweeps,
      read: intelligence.sweep,
      contribution: quality.contributions.sweep,
      reasons: quality.reasons.filter((reason) => /sweep|reclaim/i.test(reason)),
    },
    displacement: {
      read: intelligence.displacement,
      contribution: quality.contributions.displacement,
      reasons: quality.reasons.filter((reason) => /displacement|retrace/i.test(reason)),
    },
    pullback: {
      read: intelligence.retracement,
      contribution: quality.contributions.pullback,
      reasons: quality.reasons.filter((reason) => /retrace|zone|pullback/i.test(reason)),
    },
    confirmation: {
      read: intelligence.confirmation,
      contribution: quality.contributions.confirmation,
      timeframe: intelligence.confirmationTimeframe,
      reasons: quality.reasons.filter((reason) => /confirmation|engulf|rejection|reclaim|continuation/i.test(reason)),
    },
    context: intelligence.context,
    scoring: {
      total: quality.score,
      level: quality.level,
      family: quality.family,
      contributions: quality.contributions,
      configuration: config,
      reasons: quality.reasons,
      missing: quality.missing ?? [],
      confluenceBonus: quality.confluenceBonus ?? null,
      cappedByNoConfirmation: quality.cappedByNoConfirmation ?? false,
    },
    setup: {
      direction: intelligence.sweep?.direction ?? null,
      invalidation: invalidationFor(intelligence),
      read: intelligence.read,
    },
    analysis,
    metadata: {
      configVersion: config.version,
      computedAt: intelligence.computedAt,
    },
  }
}

/**
 * Deterministic invalidation condition — the level whose loss voids the
 * setup, when the evidence supports naming one.
 */
function invalidationFor(intelligence: SetupIntelligence): string | null {
  const { sweep, retracement, displacement, confirmation } = intelligence
  if (sweep?.present && sweep.levelPrice !== null) {
    return `Price closes back beyond the swept ${sweep.levelSource ?? 'liquidity'} level at ${sweep.levelPrice}`
  }
  if (retracement?.found && displacement) {
    return `Price closes beyond the displacement zone (${displacement.zoneLow}–${displacement.zoneHigh})`
  }
  if (confirmation) return `Price reverses against the ${confirmation.direction} confirmation`
  return null
}
