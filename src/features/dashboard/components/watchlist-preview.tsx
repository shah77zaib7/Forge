import { ArrowRight, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { SectionTitle } from '@/features/markets/components/section-title'
import { coins } from '@/features/markets/data'
import { useFavorites } from '@/store/favorites'

import { CoinRow } from '@/features/watchlist/components/coin-row'

/** Your starred markets, one tap from their workspaces. */
export function WatchlistPreview() {
  const navigate = useNavigate()
  const { favorites, toggleFavorite } = useFavorites()
  const watchCoins = coins.filter((coin) => favorites.has(coin.id)).slice(0, 5)

  return (
    <GlassCard padding="md" className="flex min-h-72 flex-col">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title="Watchlist" meta={`${favorites.size} saved`} />
        {watchCoins.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/watchlist')}
            className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:text-foreground"
          >
            View all
            <ArrowRight size={12} strokeWidth={2} />
          </button>
        )}
      </div>

      {watchCoins.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
            <Star size={18} strokeWidth={1.75} className="text-faint" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">Your watchlist is empty</p>
          <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-faint">
            Star any market to keep it here, in the watchlist and on your dashboard.
          </p>
          <Button size="sm" variant="secondary" className="mt-5" onClick={() => navigate('/markets')}>
            Explore Markets
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex-1">
          {watchCoins.map((coin) => (
            <CoinRow
              key={coin.id}
              coin={coin}
              favorited
              onToggleFavorite={toggleFavorite}
              dense
            />
          ))}
        </div>
      )}
    </GlassCard>
  )
}
