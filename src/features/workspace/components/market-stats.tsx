import { useMemo } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import type { Coin } from '@/features/markets/types'

import { marketStats } from '../data'
import { SectionHeading } from './section-heading'
import { Stat } from './stat'

/** Core market metrics in a calm, responsive grid. */
export function MarketStats({ coin }: { coin: Coin }) {
  const stats = useMemo(() => marketStats(coin), [coin])

  return (
    <section>
      <SectionHeading
        eyebrow="03 — Fundamentals"
        title="Market stats"
        meta={
          <span className="font-mono text-[11px] text-faint">{stats.length} metrics</span>
        }
      />
      <GlassCard className="mt-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 p-6 sm:grid-cols-4 lg:grid-cols-2">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </GlassCard>
    </section>
  )
}
