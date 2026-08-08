import { Eye, Orbit, Star, Target, type LucideIcon } from 'lucide-react'

import { GlassCard } from '@/components/ui/glass-card'
import { SectionTitle } from '@/features/markets/components/section-title'

import { recentActivity, type ActivityKind } from '../data'

const kindMeta: Record<ActivityKind, { icon: LucideIcon; label: string }> = {
  analysis: { icon: Orbit, label: 'Analysis' },
  viewed: { icon: Eye, label: 'Viewed' },
  setup: { icon: Target, label: 'Setup' },
  watchlist: { icon: Star, label: 'Watchlist' },
}

/** A compact stream of what happened in the workspace. */
export function RecentActivity() {
  const items = recentActivity()

  return (
    <GlassCard padding="md">
      <SectionTitle title="Recent Activity" meta="Forge" />

      <ul className="mt-2 divide-y divide-border/60">
        {items.map((item) => {
          const meta = kindMeta[item.kind]
          const Icon = meta.icon
          return (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-tint/[0.04]">
                <Icon size={13} strokeWidth={1.75} className="text-faint" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-faint">{item.detail}</p>
              </div>
              <span className="shrink-0 text-[10px] tabular-nums text-faint">{item.time}</span>
            </li>
          )
        })}
      </ul>
    </GlassCard>
  )
}
