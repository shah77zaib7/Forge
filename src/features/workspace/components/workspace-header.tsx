import { ArrowLeft, Check, Share } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CoinLogo } from '@/features/markets/components/coin-logo'
import { StarButton } from '@/features/markets/components/star-button'
import { categoryLabels } from '@/features/markets/data'
import { formatMarketPrice } from '@/features/markets/lib/format'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { shareCoin } from '../lib/share'

interface WorkspaceHeaderProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
}

/** Identity, live price and actions — the calm entry into a market. */
export function WorkspaceHeader({ coin, favorited, onToggleFavorite }: WorkspaceHeaderProps) {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number | null>(null)
  const tone = coin.change24h > 0 ? 'positive' : coin.change24h < 0 ? 'negative' : 'neutral'

  async function handleShare() {
    const result = await shareCoin(coin)
    if (result !== 'copied') return
    setCopied(true)
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1600)
  }

  // Clear the feedback timer if the user navigates away mid-feedback.
  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  return (
    <header>
      <button
        type="button"
        onClick={() => navigate('/markets')}
        className="group inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-medium text-muted outline-none transition-colors duration-200 hover:bg-tint/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-tint/30"
      >
        <ArrowLeft
          size={14}
          strokeWidth={1.75}
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
        />
        Markets
      </button>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 items-center gap-5">
          <CoinLogo
            ticker={coin.ticker}
            color={coin.color}
            size="xl"
            className="size-16 shrink-0 lg:size-20"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-3xl font-semibold tracking-tight text-foreground">
                {coin.name}
              </h1>
              <Badge variant="neutral" size="sm">
                {coin.ticker}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {coin.categories.map((category) => (
                <Badge key={category} variant="neutral" size="sm">
                  {categoryLabels[category]}
                </Badge>
              ))}
              {coin.trending && (
                <Badge variant="positive" size="sm" dot>
                  Trending
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Price + actions */}
        <div className="flex items-center justify-between gap-6 lg:justify-end">
          <div className="text-left lg:text-right">
            <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-foreground lg:text-5xl">
              {formatMarketPrice(coin.price)}
            </p>
            <div className="mt-2.5 flex items-center gap-2 lg:justify-end">
              <span
                className={cn(
                  'font-mono text-sm tabular-nums',
                  tone === 'positive' && 'text-positive',
                  tone === 'negative' && 'text-negative',
                  tone === 'neutral' && 'text-faint',
                )}
              >
                {formatChange(coin.change24h)}
              </span>
              <span className="text-xs text-faint">24h</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              className="size-9 px-0"
              onClick={handleShare}
              aria-label={copied ? 'Link copied' : 'Share'}
            >
              {copied ? (
                <Check size={16} strokeWidth={2} className="text-positive" />
              ) : (
                <Share size={16} strokeWidth={1.75} />
              )}
            </Button>
            <StarButton size="md" favorited={favorited} onToggle={() => onToggleFavorite(coin.id)} />
          </div>
        </div>
      </div>
    </header>
  )
}
