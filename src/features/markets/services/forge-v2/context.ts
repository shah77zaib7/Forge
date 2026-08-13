/**
 * Forge V2 — Group 6 (Context). Evaluates the environment around a setup:
 * does higher-timeframe market structure agree, how far is the opposing
 * liquidity (room to run vs a wall), and is volatility elevated. Context
 * MODIFIES setup quality from deterministic measurements — it never invents
 * signals. Each factor is a pure function of the engine's TimeframeAnalysis.
 */

import type { StructureResult, TimeframeAnalysis } from '../market-intelligence'

export type ContextDirection = 'long' | 'short'

export interface ContextWeights {
  /** Points when structure aligns with the setup direction. */
  structure: number
  /** Opposing liquidity beyond this distance (%) earns the room bonus. */
  opposingLiquidityThreshold: number
  /** Points when there is room to the opposing liquidity. */
  opposingLiquidityBonus: number
  /** ATR as % of price above which volatility is elevated. */
  volatilityThresholdAtpPct: number
  /** Penalty when volatility is elevated. */
  volatilityPenalty: number
  /** Penalty when structure conflicts with the setup direction. */
  conflictingStructurePenalty: number
}

export interface ContextRead {
  structure: {
    trend: StructureResult['trend'] | null
    label: StructureResult['label'] | null
    aligned: boolean
  }
  opposingLiquidity: {
    side: 'buy' | 'sell' | null
    price: number | null
    distancePercent: number | null
  }
  volatility: { atrPercent: number | null; elevated: boolean }
  contribution: number
  reasons: string[]
}

export function structureAlignsWithDirection(
  structure: StructureResult | null,
  direction: ContextDirection,
): boolean {
  if (!structure) return false
  if (direction === 'long') return structure.trend === 'bullish'
  return structure.trend === 'bearish'
}

/**
 * Evaluate the context contribution for a setup direction. Returns the
 * aligned/conflicting/neutral read plus the points earned (or penalties).
 */
export function evaluateContext(
  analysis: TimeframeAnalysis,
  direction: ContextDirection,
  weights: ContextWeights,
): ContextRead {
  const structure = analysis.structure
  const reasons: string[] = []
  let contribution = 0

  // Structure alignment.
  const aligned = structureAlignsWithDirection(structure, direction)
  if (aligned) {
    contribution += weights.structure
    reasons.push(`Structure aligns — ${structure?.trend} supports the ${direction} read`)
  } else if (structure) {
    contribution -= weights.conflictingStructurePenalty
    reasons.push(
      weights.conflictingStructurePenalty > 0
        ? `Structure conflicts — ${structure.trend} opposes the ${direction} read`
        : `Structure does not align — ${structure.trend} does not support the ${direction} read`,
    )
  } else {
    reasons.push('No structure read available for context')
  }

  // Opposing liquidity distance — for a long, buy-side pools above are the
  // wall; distance = room to run.
  const opposing = direction === 'long' ? analysis.liquidity.buySide[0] : analysis.liquidity.sellSide[0]
  if (opposing) {
    if (opposing.distancePercent > weights.opposingLiquidityThreshold) {
      contribution += weights.opposingLiquidityBonus
      reasons.push(
        `Room to opposing liquidity — nearest ${opposing.side === 'buy' ? 'buy-side' : 'sell-side'} pool ${opposing.distancePercent.toFixed(1)}% away`,
      )
    } else {
      reasons.push(
        `Opposing liquidity close — nearest ${opposing.side === 'buy' ? 'buy-side' : 'sell-side'} pool ${opposing.distancePercent.toFixed(1)}% away`,
      )
    }
  }

  // Volatility — elevated ATR relative to price is a risk factor.
  const atrPercent = analysis.atr > 0 ? (analysis.atr / analysis.currentPrice) * 100 : null
  const elevated = atrPercent !== null && atrPercent > weights.volatilityThresholdAtpPct
  if (elevated) {
    contribution -= weights.volatilityPenalty
    reasons.push(`Elevated volatility — ATR ${atrPercent.toFixed(2)}% of price`)
  } else if (atrPercent !== null) {
    reasons.push(`Volatility calm — ATR ${atrPercent.toFixed(2)}% of price`)
  }

  return {
    structure: {
      trend: structure?.trend ?? null,
      label: structure?.label ?? null,
      aligned,
    },
    opposingLiquidity: opposing
      ? { side: opposing.side, price: opposing.price, distancePercent: opposing.distancePercent }
      : { side: null, price: null, distancePercent: null },
    volatility: { atrPercent, elevated },
    contribution,
    reasons,
  }
}
