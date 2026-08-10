import { motion } from 'framer-motion'
import { Bell, BellPlus, ChartCandlestick, Orbit, Share, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { playForgeInteraction } from '@/lib/ui-sound'
import { useAlerts } from '@/store/alerts'

import { micro } from '@/design/motion'
import type { Coin } from '@/features/markets/types'
import { cn } from '@/lib/cn'

import { shareCoin } from '../lib/share'

interface QuickActionsProps {
  coin: Coin
  favorited: boolean
  onToggleFavorite: () => void
  onOpenAlert: () => void
}

function ActionButton({
  icon: Icon,
  label,
  active = false,
  activeClassName = 'text-foreground',
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  activeClassName?: string
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      transition={micro}
      onClick={() => {
        playForgeInteraction()
        onClick()
      }}
      aria-pressed={active || undefined}
      className="flex flex-col items-center gap-1 rounded-2xl py-1.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30"
    >
      <Icon
        size={19}
        strokeWidth={1.75}
        className={cn('transition-colors duration-200', active ? activeClassName : 'text-faint')}
      />
      <span className={cn('text-[10px] font-medium', active ? 'text-foreground' : 'text-faint')}>
        {label}
      </span>
    </motion.button>
  )
}

/** Mobile-only sticky action bar — everything you'd want within reach. */
export function QuickActions({
  coin,
  favorited,
  onToggleFavorite,
  onOpenAlert,
}: QuickActionsProps) {
  const navigate = useNavigate()
  const { alerts } = useAlerts()
  const hasAlert = alerts.some((alert) => alert.assetId === coin.id)

  const scrollToChart = () => {
    document.getElementById('forge-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const share = async () => {
    await shareCoin(coin)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="glass-strong rounded-t-hero border-x-0 border-b-0 px-3 pb-[max(env(safe-area-inset-bottom,0px),0.6rem)] pt-2">
        <div className="grid grid-cols-5">
          <ActionButton icon={Orbit} label="Ask Oracle" onClick={() => navigate('/oracle')} />
          <ActionButton icon={ChartCandlestick} label="Open Chart" onClick={scrollToChart} />
          <ActionButton
            icon={hasAlert ? Bell : BellPlus}
            label={hasAlert ? 'Alert Set' : 'Add Alert'}
            active={hasAlert}
            onClick={onOpenAlert}
          />
          <ActionButton icon={Share} label="Share" onClick={share} />
          <ActionButton
            icon={Star}
            label={favorited ? 'In Watchlist' : 'Favorite'}
            active={favorited}
            activeClassName="fill-foreground text-foreground"
            onClick={onToggleFavorite}
          />
        </div>
      </div>
    </div>
  )
}
