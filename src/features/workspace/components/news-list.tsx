import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import type { Coin } from '@/features/markets/types'

import { newsFor, type NewsItem } from '../data'
import { SectionHeading } from './section-heading'

function Thumb({ item, coin }: { item: NewsItem; coin: Coin }) {
  return (
    <span
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-glass border border-border text-sm font-semibold"
      style={{
        backgroundColor: `color-mix(in oklab, ${coin.color} 16%, transparent)`,
        color: `color-mix(in oklab, ${coin.color} 62%, var(--forge-foreground))`,
      }}
    >
      {item.source.slice(0, 1)}
    </span>
  )
}

/** A calm reading list — mock headlines, no live feed yet. */
export function NewsList({ coin }: { coin: Coin }) {
  const items = useMemo(() => newsFor(coin, 4), [coin])

  return (
    <section>
      <SectionHeading
        eyebrow="05 — News"
        title="Latest news"
        meta={<span className="font-mono text-[11px] text-faint">4 stories</span>}
      />
      <GlassCard className="mt-4 divide-y divide-border">
        {items.map((item) => (
          <button
            key={`${item.source}-${item.headline}`}
            type="button"
            className="group flex w-full items-center gap-4 px-5 py-4 text-left outline-none transition-colors duration-200 hover:bg-tint/[0.04] focus-visible:bg-tint/[0.04] sm:px-6"
          >
            <Thumb item={item} coin={coin} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted">{item.source}</span>
                <span className="text-[11px] text-faint">·</span>
                <span className="text-[11px] text-faint">{item.time}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-foreground transition-colors duration-200 group-hover:text-foreground/90">
                {item.headline}
              </span>
            </span>
            <ChevronRight
              size={15}
              strokeWidth={1.75}
              className="shrink-0 text-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            />
          </button>
        ))}
      </GlassCard>
    </section>
  )
}
