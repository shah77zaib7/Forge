import { motion } from 'framer-motion'

import { ease } from '@/design/motion'

import type { Coin } from '../types'
import { CoinCard } from './coin-card'

interface CoinListProps {
  coins: Coin[]
  selectedId: string | null
  onSelect: (id: string) => void
  favorites: Set<string>
  onToggleFavorite: (id: string) => void
}

export function CoinList({ coins, selectedId, onSelect, favorites, onToggleFavorite }: CoinListProps) {
  return (
    <div className="space-y-1">
      {coins.map((coin, index) => (
        <motion.div
          key={coin.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.45), ease: ease.smooth }}
        >
          <CoinCard
            coin={coin}
            selected={selectedId === coin.id}
            onSelect={onSelect}
            favorited={favorites.has(coin.id)}
            onToggleFavorite={onToggleFavorite}
          />
        </motion.div>
      ))}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-panel border border-transparent px-3 py-3">
      <div className="size-8 rounded-full bg-tint/[0.08]" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 w-24 rounded-full bg-tint/[0.07]" />
        <div className="h-2 w-14 rounded-full bg-tint/[0.05]" />
      </div>
      <div className="h-2.5 w-14 rounded-full bg-tint/[0.07]" />
      <div className="size-8 rounded-full bg-tint/[0.05]" />
    </div>
  )
}

/** Calm skeleton rows shown while the (simulated) feed loads. */
export function CoinListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 7 }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  )
}
