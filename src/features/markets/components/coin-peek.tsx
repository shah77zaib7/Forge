import { motion, type MotionValue } from 'framer-motion'

import { cn } from '@/lib/cn'
import { formatChange } from '@/lib/format'

import { formatMarketPrice } from '../lib/format'
import type { Coin } from '../types'
import { CoinLogo } from './coin-logo'

interface CoinPeekProps {
  coin: Coin
  /**
   * Which edge the peek belongs to: 'next' parks just off the right edge
   * and slides in while swiping left; 'prev' mirrors on the left while
   * swiping right.
   */
  side: 'next' | 'prev'
  /** The swipe track's shared drag offset — keeps the peek glued to the card. */
  x: MotionValue<number>
}

/**
 * A quiet glass card for the adjacent coin, parked just off the sheet's
 * edge inside the swiped track. As the current card is dragged away the
 * peek glides with the finger, revealing a growing sliver from the screen
 * edge — the iOS photo-gallery edge peek. Hidden at rest; decorative,
 * never interactive (pointer-events-none, aria-hidden).
 */
export function CoinPeek({ coin, side, x }: CoinPeekProps) {
  const next = side === 'next'
  const tone = coin.change24h > 0 ? 'positive' : coin.change24h < 0 ? 'negative' : 'neutral'

  return (
    <motion.div
      aria-hidden
      style={{ x }}
      className={cn(
        'pointer-events-none absolute inset-y-0 flex w-64',
        next ? 'left-full pr-10' : 'right-full pl-10',
      )}
    >
      <div
        className={cn(
          'flex h-full w-full items-center gap-3 border border-border/70 bg-background/60 px-4 shadow-float backdrop-blur-2xl',
          // The mirrored layout puts the logo + name on the leading edge,
          // so the sliver always shows recognizable identity first.
          next ? 'rounded-l-2xl border-r-0' : 'flex-row-reverse rounded-r-2xl border-l-0',
        )}
      >
        <CoinLogo ticker={coin.ticker} color={coin.color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{coin.name}</p>
          <p className="mt-0.5 font-mono text-[11px] uppercase text-faint">{coin.ticker}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono text-xs tabular-nums text-foreground">
            {formatMarketPrice(coin.price)}
          </span>
          <span
            className={cn(
              'mt-0.5 font-mono text-[11px] tabular-nums',
              tone === 'positive' && 'text-positive',
              tone === 'negative' && 'text-negative',
              tone === 'neutral' && 'text-faint',
            )}
          >
            {formatChange(coin.change24h)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
