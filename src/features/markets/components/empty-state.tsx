import { motion } from 'framer-motion'

import { GlassCard } from '@/components/ui/glass-card'
import { ease } from '@/design/motion'

/** Minimal orbit illustration — calm, monochrome, no clichés. */
function OrbitMark() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
      <circle cx="36" cy="36" r="15" stroke="var(--forge-line-strong)" strokeWidth="1.5" />
      <circle
        cx="36"
        cy="36"
        r="25"
        stroke="var(--forge-line)"
        strokeWidth="1.5"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
      <circle cx="36" cy="36" r="4" fill="var(--forge-muted)" />
      <circle cx="61" cy="36" r="3" fill="var(--forge-foreground)" />
      <circle cx="11" cy="36" r="2.5" fill="var(--forge-faint)" />
    </svg>
  )
}

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: ease.smooth }}
      className="flex h-full min-h-[24rem] items-center justify-center"
    >
      <GlassCard variant="strong" padding="lg" className="w-full text-center">
        <div className="flex flex-col items-center px-4 py-12">
          <div className="flex size-24 items-center justify-center rounded-hero border border-border bg-tint/[0.03]">
            <OrbitMark />
          </div>
          <h2 className="mt-8 text-lg font-medium tracking-tight text-foreground">
            Select a market to begin analysis.
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            Pick a market from the list to open its workspace — price, liquidity and supply at a
            glance.
          </p>
        </div>
      </GlassCard>
    </motion.div>
  )
}
