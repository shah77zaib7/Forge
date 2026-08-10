import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import { SectionTitle } from '@/features/markets/components/section-title'
import { formatMarketPrice } from '@/features/markets/lib/format'
import { useCoins } from '@/store/market-data'
import { cn } from '@/lib/cn'

import { positions } from '../data'

const riskTone = { Low: 'positive', Medium: 'neutral', High: 'negative' } as const

/** Active positions — entry vs current real price drives a live P/L. */
export function ActivePositions() {
  const coins = useCoins()
  const rows = positions(coins)
  const openCount = rows.filter((position) => position.status === 'Open').length

  return (
    <GlassCard padding="md" className="overflow-hidden">
      <SectionTitle title="Active Positions" meta={`${openCount} open`} />

      {/* Negative margins let the table scroll flush with the card on
          narrow screens; it never overflows the page. */}
      <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[38rem] border-collapse">
          <thead>
            <tr className="border-b border-border">
              {['Asset', 'Entry', 'Current', 'P/L', 'Direction', 'Risk', 'Status'].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="pb-2.5 pr-4 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-faint last:pr-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((position) => {
              const coin = coins.find((market) => market.id === position.coinId)
              if (!coin) return null
              const multiplier = position.direction === 'long' ? 1 : -1
              const pl = (coin.price - position.entry) * position.units * multiplier
              const plTone = pl > 0 ? 'positive' : pl < 0 ? 'negative' : 'neutral'
              const Direction = position.direction === 'long' ? ArrowUpRight : ArrowDownRight

              return (
                <tr key={position.id} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" className="size-7 text-[10px]" />
                      <span className="text-[13px] font-medium text-foreground">{coin.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-[13px] tabular-nums text-muted">
                    {formatMarketPrice(position.entry)}
                  </td>
                  <td className="py-3 pr-4 font-mono text-[13px] tabular-nums text-foreground">
                    {formatMarketPrice(coin.price)}
                  </td>
                  <td
                    className={cn(
                      'py-3 pr-4 font-mono text-[13px] tabular-nums',
                      plTone === 'positive' && 'text-positive',
                      plTone === 'negative' && 'text-negative',
                      plTone === 'neutral' && 'text-faint',
                    )}
                  >
                    {pl >= 0 ? '+' : '−'}${Math.abs(pl).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-foreground">
                      <Direction
                        size={13}
                        strokeWidth={2}
                        className={cn(
                          position.direction === 'long' ? 'text-positive' : 'text-negative',
                        )}
                      />
                      {position.direction === 'long' ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={riskTone[position.risk]} size="sm">
                      {position.risk}
                    </Badge>
                  </td>
                  <td className="py-3 last:pr-0">
                    <Badge variant="neutral" size="sm">
                      {position.status}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}
