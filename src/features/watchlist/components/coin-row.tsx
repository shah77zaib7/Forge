import { ArrowUpRight } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Sparkline } from '@/components/ui/sparkline'
import { AssetIcon } from '@/features/markets/components/asset-icon'
import { StarButton } from '@/features/markets/components/star-button'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'
import { changeTone, formatChange } from '@/lib/format'

interface CoinRowProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
  /** Hide the star for compact preview surfaces. */
  showStar?: boolean
  /** Tighter padding + smaller sparkline for preview cards. */
  dense?: boolean
}

/**
 * A watchlist row — keyboard-accessible div + role so the favorite star
 * nests as a real interactive element (same pattern as the Markets list).
 * Clicking anywhere opens the Coin Workspace.
 */
export function CoinRow({ coin, favorited, onToggleFavorite, showStar = true, dense = false }: CoinRowProps) {
  const navigate = useNavigate()
  const tone = changeTone(coin.change24h)

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Ignore keys aimed at nested interactive elements (the star).
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(`/markets/${coin.id}`)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/markets/${coin.id}`)}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-panel border text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30',
        dense ? 'px-2.5 py-2.5' : 'px-3 py-3',
        'border-transparent hover:border-border hover:bg-tint/[0.04]',
      )}
    >
      <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{coin.name}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase text-faint">{coin.ticker}</p>
      </div>

      <Sparkline
        data={coin.spark}
        width={dense ? 56 : 72}
        height={22}
        tone={tone}
        className="hidden shrink-0 sm:block"
      />

      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="font-mono text-[13px] font-medium tabular-nums text-foreground">
          {formatMarketPrice(coin.price)}
        </span>
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            tone === 'positive' && 'text-positive',
            tone === 'negative' && 'text-negative',
            tone === 'neutral' && 'text-faint',
          )}
        >
          {formatChange(coin.change24h)}
        </span>
      </div>

      {showStar && (
        <StarButton favorited={favorited} onToggle={() => onToggleFavorite(coin.id)} className="-mr-1" />
      )}

      <ArrowUpRight
        size={14}
        strokeWidth={2}
        className="hidden shrink-0 text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:block"
      />
    </div>
  )
}
