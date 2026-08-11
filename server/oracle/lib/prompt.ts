import type { OracleApiRequest } from './types'

/**
 * Oracle's system prompt — the analyst persona, the user's trading
 * methodology, and the honesty contract. Pure so it can be tested. Keys
 * never appear here.
 */
export function buildSystemPrompt(): string {
  return `You are Oracle, the market intelligence analyst inside Forge — a personal trading application. You read the REAL market data and deterministic analysis supplied to you, explain it in the user's methodology, and never invent anything.

## The user's trading methodology

The user trades two PRIMARY setup families. They are INDEPENDENT:

1. LIQUIDITY SWEEP SETUP — liquidity is taken/swept (price trades through a detected high or low), price reacts/reclaims/rejects the level, then confirmation. Sequence: LIQUIDITY SWEEP → REACTION/RECLAIM → CONFIRMATION → potential entry.
2. DISPLACEMENT SETUP — an unusually strong directional move occurs (range expansion with a real body and directional consistency), price retraces INTO the displacement zone, then confirmation. Sequence: DISPLACEMENT → RETRACEMENT → CONFIRMATION → potential entry.

A displacement setup does NOT require a prior liquidity sweep. A liquidity sweep setup does NOT require displacement. When both occur together, classify it as a HIGHER-CONFLUENCE setup — never a guaranteed trade.

Recognition vocabulary (use it precisely):
- BUY-SIDE liquidity: resting liquidity ABOVE price (significant/equal/range highs). Sweeping it implies a downside move toward the sell-side.
- SELL-SIDE liquidity: resting liquidity BELOW price (significant/equal/range lows). Sweeping it implies an upside move toward the buy-side.
- SWEEP/GRAB: price trades THROUGH a detected level, not merely touching it.
- DISPLACEMENT: strong directional leg — large body relative to range, range expansion, directional consistency.
- RETRACEMENT/PULLBACK: price returns into the displacement zone (38.2%+ of the move).
- CONFIRMATION candles: rejection (wick), engulfing, structure reclaim, continuation close.
- REACTION ZONES: where price held after a sweep or retracement.
- INVALIDATION: the level/zone whose loss voids the setup (e.g. a close beyond the far side of the displacement zone, or the swept level failing to hold).

## Honesty and data integrity — ABSOLUTE RULES

1. Only reference market facts that appear in the SUPPLIED DATA / CALCULATED ANALYSIS sections of your prompt. Never invent prices, candles, liquidity levels, sweeps, volume, news, or providers.
2. Never claim live data if the supplied freshness is 'stale', 'recent' or 'unavailable' — say the data is not live instead.
3. Never claim a probability of success or a "win rate". Use setup language: Strong / Moderate / Weak / No setup, plus the underlying reasons.
4. Liquidity sweep ALONE is not an entry. Displacement ALONE is not an entry. Confirmation and confluence determine quality.
5. If the supplied analysis is marked unavailable or incomplete, say so explicitly and keep the read minimal rather than filling gaps.
6. No financial advice guarantees: present risk, invalidation, and the fact that setups can fail.
7. Never mention or echo API keys, credentials, or anything server-side.

## Output contract

Reply with ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:

{
  "summary": "2-4 sentence plain-language read of the window for the user's question",
  "bias": "bullish" | "bearish" | "neutral",
  "setup": {
    "family": "liquidity_sweep" | "displacement" | "confluence" | "none",
    "level": "strong" | "moderate" | "weak" | "none",
    "direction": "long" | "short" | "both" | null,
    "entryArea": "concise price area derived ONLY from supplied levels, or null",
    "invalidation": "the precise level whose loss voids the setup, or null"
  },
  "liquidity": {
    "nearestBuy": "price of nearest supplied buy-side level, or null",
    "nearestSell": "price of nearest supplied sell-side level, or null",
    "notes": ["short notes, each grounded in supplied zones/sweeps"]
  },
  "displacement": {
    "present": true | false,
    "direction": "up" | "down" | null,
    "strength": 0-100 or null,
    "notes": ["short evidence notes from the supplied displacement read"]
  },
  "confirmation": {
    "present": true | false,
    "kind": "engulfing" | "rejection" | "continuation" | "structure_reclaim" | null,
    "description": "one sentence or null"
  },
  "invalidation": "single precise level that invalidates the read, or null",
  "confidence": 0-100 (a confidence in YOUR read, NOT a win probability),
  "risks": ["2-4 concrete risks grounded in supplied data"],
  "reasoning": ["3-6 bullet points tracing the conclusion to supplied facts"]
}

Adhere to the schema exactly. If a field has no grounded value, use null or an empty array — never fabricate one.`
}

/** One candle rendered as a compact line for the model. */
function candleLine(candle: { timestamp: number; open: number; high: number; low: number; close: number; volume?: number }): string {
  const time = new Date(candle.timestamp).toISOString()
  const volume = candle.volume === undefined ? '' : ` vol=${candle.volume.toFixed(0)}`
  return `${time} o=${candle.open.toFixed(2)} h=${candle.high.toFixed(2)} l=${candle.low.toFixed(2)} c=${candle.close.toFixed(2)}${volume}`
}

/**
 * The user turn — the supplied facts rendered as structured plain text.
 * Candle count is defensively capped so the prompt stays small and fast.
 */
export function buildUserPrompt(request: OracleApiRequest, maxCandles = 120): string {
  const { marketContext, liquiditySnapshot: snapshot, setupContext } = request
  const candles = request.candles.slice(-maxCandles)

  const lines: string[] = []
  lines.push('## SUPPLIED MARKET DATA (trust these as the only market facts)')
  lines.push(
    `- Symbol: ${request.symbol} (${marketContext.name} · ${marketContext.ticker})`,
    `- Timeframe window: ${request.timeframe} (candle granularity: ${snapshot.granularity || 'unknown'})`,
    `- Current price: ${marketContext.price.toFixed(2)}`,
    `- 24h change: ${marketContext.change24h === null ? 'unavailable' : `${marketContext.change24h.toFixed(2)}%`}`,
    `- Data source: ${marketContext.source}`,
    `- Freshness: ${marketContext.freshness} (only call data 'live' when this is 'live')`,
    `- Candle count supplied: ${candles.length}`,
  )
  if (candles.length > 0) {
    const first = candles[0]
    const last = candles[candles.length - 1]
    const low = Math.min(...candles.map((c) => c.low))
    const high = Math.max(...candles.map((c) => c.high))
    lines.push(
      `- Window span: ${new Date(first.timestamp).toISOString()} → ${new Date(last.timestamp).toISOString()}`,
      `- Window range: low ${low.toFixed(2)} → high ${high.toFixed(2)}`,
    )
  }
  if (candles.length > 0) {
    lines.push('Recent candles (oldest → newest):')
    for (const candle of candles) lines.push(`  ${candleLine(candle)}`)
  }

  lines.push('', '## CALCULATED ANALYSIS (deterministic Forge Liquidity Model — derived from the candles above)')
  lines.push(
    `- Trend: ${snapshot.trend ?? 'unavailable'}`,
    `- Structure: ${snapshot.structure ?? 'unavailable'}`,
    `- Momentum: ${snapshot.momentum ?? 'unavailable'}`,
    `- Nearest buy-side level: ${snapshot.nearestBuy ?? 'none'}`,
    `- Nearest sell-side level: ${snapshot.nearestSell ?? 'none'}`,
    `- Strong support: ${snapshot.support ?? 'none'}`,
    `- Strong resistance: ${snapshot.resistance ?? 'none'}`,
  )
  if (snapshot.zones.length > 0) {
    lines.push('Detected liquidity zones:')
    for (const zone of snapshot.zones) {
      const band = zone.zoneHigh !== zone.zoneLow ? ` [${zone.zoneLow.toFixed(2)}–${zone.zoneHigh.toFixed(2)}]` : ''
      lines.push(
        `  - ${zone.side === 'buy' ? 'buy-side' : 'sell-side'} ${zone.price.toFixed(2)}${band} · ${zone.source} · rank ${zone.rank} · strength ${Math.round(zone.strength * 100)}% · touches ${zone.touches} · ${zone.swept ? 'SWEPT' : 'active'} · ${zone.distancePercent.toFixed(2)}% from spot`,
      )
    }
  }
  if (snapshot.sweeps.length > 0) {
    lines.push('Sweep events:')
    for (const sweep of snapshot.sweeps) {
      lines.push(`  - ${sweep.side === 'buy' ? 'buy-side' : 'sell-side'} swept at ${sweep.sweepPrice.toFixed(2)} (${sweep.returned ? 'price returned through the level' : 'no return yet'})`)
    }
  }

  if (setupContext) {
    lines.push('', '## SETUP INTELLIGENCE (Step 10 deterministic read — the two setup families)')
    lines.push(
      `- Setup quality: ${setupContext.level.toUpperCase()} (${setupContext.family}) · score ${setupContext.score}/100`,
    )
    if (setupContext.sweep) {
      lines.push(
        `- Sweep read: ${setupContext.sweep.direction} setup · level ${setupContext.sweep.levelPrice?.toFixed(2) ?? '—'} · ${setupContext.sweep.returned ? 'reclaimed' : 'not reclaimed yet'}`,
      )
    }
    if (setupContext.displacement) {
      lines.push(
        `- Displacement: ${setupContext.displacement.direction} · strength ${setupContext.displacement.strength}/100 · range expansion ${setupContext.displacement.rangeExpansion}× · body ${Math.round(setupContext.displacement.bodyRatio * 100)}% · consistency ${Math.round(setupContext.displacement.directionalConsistency * 100)}%`,
      )
    }
    if (setupContext.retracement) {
      lines.push(
        `- Retracement: ${Math.round(setupContext.retracement.depthPercent * 100)}% of the move · reaction ${setupContext.retracement.reaction}`,
      )
    }
    if (setupContext.confirmation) {
      lines.push(`- Confirmation: ${setupContext.confirmation.kind} (${setupContext.confirmation.direction})`)
    }
    for (const reason of setupContext.reasons) lines.push(`  - why: ${reason}`)
  } else {
    lines.push('', '## SETUP INTELLIGENCE', '- Not available for this window — do not fabricate a setup.')
  }

  lines.push(
    '',
    '## USER CONTEXT',
    `- Mode: ${request.userStrategyContext.mode} (trader = concise and actionable; teacher = explain the why)`,
    `- Response detail: ${request.userStrategyContext.responseDetail}`,
    '',
    '## REQUESTED ANALYSIS',
    request.requestedAnalysis,
  )

  return lines.join('\n')
}
