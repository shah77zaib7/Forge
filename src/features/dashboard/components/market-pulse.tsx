import { ArrowDownRight, ArrowUpRight, TrendingUp } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { Sparkline } from '@/components/ui/sparkline'
import { CoinLogo } from '@/features/markets/components/coin-logo'
import { SectionTitle } from '@/features/markets/components/section-title'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { marketPulse } from '../data'

function PulseRow({ coin }: { coin: Coin }) {
  const up = coin.change24h > 0
  const tone = up ? 'positive' : coin.change24h < 0 ? 'negative' : 'neutral'
  const Direction = up ? ArrowUpRight : ArrowDownRight

  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0">
      <CoinLogo ticker={coin.ticker} color={coin.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{coin.name}</p>
        <p className="font-mono text-[10px] uppercase text-faint">{coin.ticker}</p>
      </div>
      <Sparkline data={coin.spark} width={56} height={20} tone={tone} animated={false} className="hidden sm:block" />
      <div className="flex shrink-0 items-center gap-1.5">
        <Direction
          size={14}
          strokeWidth={2}
          className={cn(tone === 'positive' && 'text-positive', tone === 'negative' && 'text-negative', tone === 'neutral' && 'text-faint')}
        />
        <span className="w-16 text-right font-mono text-[13px] tabular-nums text-foreground">
          {formatMarketPrice(coin.price)}
        </span>
        <span className={cn('w-14 text-right font-mono text-[11px] tabular-nums', tone === 'positive' && 'text-positive', tone === 'negative' && 'text-negative', tone === 'neutral' && 'text-faint')}>
          {formatChange(coin.change24h)}
        </span>
      </div>
    </div>
  )
}

/** Compact overview of the lead tape, dominance and sentiment. */
export function MarketPulse() {
  const pulse = marketPulse()

  return (
    <GlassCard padding="md">
      <SectionTitle title="Market Pulse" meta="Lead tape" />

      <div className="mt-2">
        {pulse.markets.map(({ coin }) => (
          <PulseRow key={coin.id} coin={coin} />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4">
        <span className="text-[11px] uppercase tracking-[0.14em] text-faint">
          BTC dominance{' '}
          <span className="ml-1.5 font-mono text-xs tabular-nums text-foreground">
            {pulse.btcDominance.toFixed(1)}%
          </span>
        </span>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-faint">
          Sentiment{' '}
          <Badge variant={pulse.sentiment === 'Risk-on' ? 'positive' : pulse.sentiment === 'Risk-off' ? 'negative' : 'neutral'} size="sm">
            {pulse.sentiment}
          </Badge>
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-panel border border-border bg-tint/[0.03] px-3.5 py-3">
        <TrendingUp size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-faint" />
        <p className="text-[13px] leading-relaxed text-muted">{pulse.notable.headline}</p>
      </div>
    </GlassCard>
  )
}
