import { motion, type Variants } from 'framer-motion'
import { ArrowUpRight, Orbit, Share } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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
import { changeTone } from '@/lib/format'
import { AssetIcon } from './asset-icon'
import { SectionTitle } from './section-title'
import { StarButton } from './star-button'

interface CoinPreviewProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: (id: string) => void
  /**
   * 'panel' — desktop right pane, inside a GlassCard.
   * 'sheet' — mobile workspace: the sheet is already glass, so the card
   * is dropped, typography scales up, and the primary actions live in
   * the sheet's sticky footer.
   */
  variant?: 'panel' | 'sheet'
  /** Horizontal swipe direction, threaded through AnimatePresence
   * `custom` so entering AND exiting coins part correctly: 1 slides in
   * from the right (next coin), -1 from the left, 0 = no slide. */
  custom?: number
}

/** Direction-aware slide for the swipe transition — the exiting coin
 * glides out the way the new one came, so consecutive swipes part. */
const previewVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 48,
    y: 14,
    filter: 'blur(4px)',
  }),
  center: { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -24,
    y: -10,
    filter: 'blur(4px)',
  }),
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
export function CoinPreview({
  coin,
  favorited,
  onToggleFavorite,
  variant = 'panel',
  custom = 0,
}: CoinPreviewProps) {
  const navigate = useNavigate()
  const sheet = variant === 'sheet'
  const tone = changeTone(coin.change24h)

  const content = (
    <>
      {/* Identity */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AssetIcon ticker={coin.ticker} color={coin.color} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={cn(
                  'font-semibold tracking-tight text-foreground',
                  sheet ? 'text-2xl' : 'text-xl',
                )}
              >
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
      <div className={cn(sheet ? 'mt-10' : 'mt-8', 'flex items-end justify-between gap-6')}>
        <div>
          <p
            className={cn(
              'font-mono font-medium tabular-nums tracking-tight text-foreground',
              sheet ? 'text-[2.5rem] leading-none' : 'text-4xl',
            )}
          >
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
      <div
        className={cn(
          sheet ? 'mt-10' : 'mt-8',
          'grid grid-cols-3 gap-6 border-t border-border pt-6',
        )}
      >
        <Stat label="Market Cap" value={`$${formatCompact(coin.marketCap)}`} />
        <Stat label="Volume 24h" value={`$${formatCompact(coin.volume24h)}`} />
        <Stat
          label="Circulating"
          value={coin.supply === null ? '—' : `${formatCompact(coin.supply)} ${coin.ticker}`}
        />
      </div>

      {/* About */}
      <div className={cn(sheet ? 'mt-10' : 'mt-8')}>
        <SectionTitle title="About" />
        <p className="mt-3 text-sm leading-relaxed text-muted">{coin.blurb}</p>
      </div>

      {/* Actions — on mobile the two primaries live in the sheet's
          sticky footer, so only the quiet pair remains here. */}
      {sheet ? (
        <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
          <Button
            variant="outline"
            size="lg"
            className="w-full px-4"
            onClick={() => onToggleFavorite(coin.id)}
          >
            {favorited ? 'In Watchlist' : 'Add to Watchlist'}
          </Button>
          <Button variant="ghost" size="lg" className="w-full px-4">
            <Share size={15} strokeWidth={1.75} />
            Share
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 pt-8">
          <Button onClick={() => navigate(`/markets/${coin.id}`)}>
            Open Workspace
            <ArrowUpRight size={15} strokeWidth={2} />
          </Button>
          <Button variant="secondary" onClick={() => navigate('/oracle')}>
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
      )}
    </>
  )

  return (
    <motion.div
      custom={custom}
      variants={previewVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.35, ease: ease.smooth }}
    >
      {sheet ? (
        <div className="flex min-h-full flex-col">{content}</div>
      ) : (
        <GlassCard variant="strong" padding="lg" className="flex min-h-full flex-col">
          {content}
        </GlassCard>
      )}
    </motion.div>
  )
}
