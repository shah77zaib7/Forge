import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { CoinLogo } from '@/features/markets/components/coin-logo'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { relatedMarkets } from '../data'
import { SectionHeading } from './section-heading'

/** Related markets — a snap-scrolling rail of the top of the universe. */
export function RelatedMarkets({ coin }: { coin: Coin }) {
  const navigate = useNavigate()
  const related = useMemo(() => relatedMarkets(coin), [coin])

  return (
    <section>
      <SectionHeading
        eyebrow="06 — Related"
        title="Related markets"
        meta={<span className="font-mono text-[11px] text-faint">{related.length} markets</span>}
      />
      <div className="-mx-1 mt-4 flex snap-x gap-3 overflow-x-auto overscroll-contain px-1 pb-1">
        {related.map((market) => {
          const tone =
            market.change24h > 0 ? 'positive' : market.change24h < 0 ? 'negative' : 'neutral'
          return (
            <button
              key={market.id}
              type="button"
              onClick={() => navigate(`/markets/${market.id}`)}
              className="group flex w-40 shrink-0 snap-start flex-col gap-4 rounded-panel border border-border bg-tint/[0.03] p-4 text-left outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-tint/[0.05] focus-visible:ring-2 focus-visible:ring-tint/30"
            >
              <div className="flex items-center gap-2.5">
                <CoinLogo ticker={market.ticker} color={market.color} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{market.name}</p>
                  <p className="font-mono text-[10px] uppercase text-faint">{market.ticker}</p>
                </div>
              </div>
              <div className="mt-auto">
                <p className="font-mono text-sm tabular-nums text-foreground">
                  {formatMarketPrice(market.price)}
                </p>
                <p
                  className={cn(
                    'mt-0.5 font-mono text-[11px] tabular-nums',
                    tone === 'positive' && 'text-positive',
                    tone === 'negative' && 'text-negative',
                    tone === 'neutral' && 'text-faint',
                  )}
                >
                  {formatChange(market.change24h)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
