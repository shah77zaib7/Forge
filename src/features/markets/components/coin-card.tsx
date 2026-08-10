import type { KeyboardEvent } from 'react'

import { Sparkline } from '@/components/ui/sparkline'
import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { formatMarketPrice } from '../lib/format'
import type { Coin } from '../types'
import { changeTone } from '@/lib/format'
import { AssetIcon } from './asset-icon'
import { StarButton } from './star-button'

interface CoinCardProps {
  coin: Coin
  selected: boolean
  onSelect: (id: string) => void
  favorited: boolean
  onToggleFavorite: (id: string) => void
}

/**
 * A single market row. The row itself is a keyboard-accessible
 * button (div + role) so the favorite star can nest as a real
 * interactive element without invalid HTML.
 */
export function CoinCard({ coin, selected, onSelect, favorited, onToggleFavorite }: CoinCardProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Ignore keys aimed at nested interactive elements (the favorite star).
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(coin.id)
    }
  }

  const tone = changeTone(coin.change24h)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(coin.id)}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-3 rounded-panel border px-3 py-3 text-left outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30',
        selected
          ? 'border-border-strong bg-tint/[0.07]'
          : 'border-transparent hover:border-border hover:bg-tint/[0.04]',
      )}
    >
      <AssetIcon ticker={coin.ticker} color={coin.color} size="sm" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{coin.name}</p>
        <p className="mt-0.5 font-mono text-[11px] uppercase text-faint">{coin.ticker}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
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

      <Sparkline
        data={coin.spark}
        width={64}
        height={24}
        tone={tone}
        className="hidden shrink-0 sm:block"
      />

      <StarButton
        favorited={favorited}
        onToggle={() => onToggleFavorite(coin.id)}
        className="-mr-1"
      />
    </div>
  )
}
