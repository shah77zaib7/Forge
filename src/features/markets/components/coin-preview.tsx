import { motion } from 'framer-motion'
import { ArrowUpRight, Orbit, Share } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Sparkline } from '@/components/ui/sparkline'
import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'
import { formatChange, formatCompact } from '@/lib/format'

import { categoryLabels } from '../data'
import { formatMarketPrice } from '../lib/format'
import type { Coin } from '../types'
import { CoinLogo } from './coin-logo'
import { SectionTitle } from './section-title'
import { StarButton } from './star-button'

interface CoinPreviewProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/**
 * The market workspace — large identity, live price, liquidity stats,
 * a short overview and quick actions. Re-animates as the selection
 * changes (driven by the keyed AnimatePresence above it).
 */
export function CoinPreview({ coin, favorited, onToggleFavorite }: CoinPreviewProps) {
  const tone = coin.change24h > 0 ? 'positive' : coin.change24h < 0 ? 'negative' : 'neutral'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, ease: ease.smooth }}
    >
      <GlassCard variant="strong" padding="lg" className="flex min-h-full flex-col">
        {/* Identity */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <CoinLogo ticker={coin.ticker} color={coin.color} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {coin.name}
                </h2>
                <Badge variant="neutral" size="sm">
                  {coin.ticker}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
          <StarButton size="md" favorited={favorited} onToggle={() => onToggleFavorite(coin.id)} />
        </div>

        {/* Price */}
        <div className="mt-8 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-foreground">
              {formatMarketPrice(coin.price)}
            </p>
            <div className="mt-3 flex items-center gap-2">
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
          <Sparkline
            data={coin.spark}
            width={140}
            height={44}
            tone={tone}
            className="hidden sm:block"
          />
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6">
          <Stat label="Market Cap" value={`$${formatCompact(coin.marketCap)}`} />
          <Stat label="Volume 24h" value={`$${formatCompact(coin.volume24h)}`} />
          <Stat label="Circulating" value={`${formatCompact(coin.supply)} ${coin.ticker}`} />
        </div>

        {/* About */}
        <div className="mt-8">
          <SectionTitle title="About" />
          <p className="mt-3 text-sm leading-relaxed text-muted">{coin.blurb}</p>
        </div>

        {/* Quick actions */}
        <div className="mt-auto flex flex-wrap gap-2 pt-8">
          <Button>
            Open Workspace
            <ArrowUpRight size={15} strokeWidth={2} />
          </Button>
          <Button variant="secondary">
            <Orbit size={15} strokeWidth={1.75} />
            Ask Oracle
          </Button>
          <Button variant="outline" onClick={() => onToggleFavorite(coin.id)}>
            {favorited ? 'In Watchlist' : 'Add to Watchlist'}
          </Button>
          <Button variant="ghost">
            <Share size={15} strokeWidth={1.75} />
            Share
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  )
}


