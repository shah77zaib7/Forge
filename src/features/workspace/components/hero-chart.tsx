import { GlassCard } from '@/components/ui/glass-card'
import { TradingViewChart } from '@/features/chart/tradingview-chart'
import type { Coin } from '@/features/markets/types'

import type { LiquidityTimeframe } from '../data'
import { LiquidityLadder } from './liquidity-ladder'
import { SectionHeading } from './section-heading'

/**
 * The hero chart — the official TradingView Advanced Chart embedded as a
 * native Forge card. TradingView owns the chart experience (candles, zoom,
 * pan, crosshair, timeframes, fullscreen); the symbol comes from the asset
 * registry, so this card needs no per-asset logic. Assets without a
 * TradingView symbol get the component's graceful unavailable state.
 *
 * The Forge Liquidity ladder sits beneath the chart in the same card — the
 * Liquidity Model's ranked zones for the selected window, the same output
 * that drives the Liquidity Snapshot and Oracle.
 */
export function HeroChart({ coin, timeframe }: { coin: Coin; timeframe: LiquidityTimeframe }) {
  return (
    <section id="forge-chart" className="scroll-mt-24">
      <SectionHeading eyebrow="01 — Chart" title="Price action" />
      <GlassCard className="mt-4 overflow-hidden">
        <TradingViewChart symbol={coin.tvSymbol ?? null} className="h-[440px] sm:h-[520px]" />
        <LiquidityLadder coin={coin} timeframe={timeframe} />
      </GlassCard>
    </section>
  )
}
