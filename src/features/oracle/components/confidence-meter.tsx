import { motion } from 'framer-motion'

import { ease } from '@/design/motion'
import type { Tone } from '@/features/workspace/data'
import { cn } from '@/lib/cn'

const colorFor = (tone: Tone) =>
  tone === 'positive'
    ? 'var(--forge-positive)'
    : tone === 'negative'
      ? 'var(--forge-negative)'
      : 'var(--forge-muted)'

interface ConfidenceMeterProps {
  value: number
  tone?: Tone
  /** 0–1 streaming progress — the number counts up and the bar fills. */
  progress?: number
  label?: string
  className?: string
}

/** Label, live percentage and a filling bar — one glance at conviction. */
export function ConfidenceMeter({
  value,
  tone = 'neutral',
  progress = 1,
  label = 'Confidence',
  className,
}: ConfidenceMeterProps) {
  const shown = Math.round(value * progress)

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">{shown}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-tint/[0.06]">
        <motion.div
          initial={false}
          animate={{ width: `${Math.max(shown, progress < 1 ? 2 : 0)}%` }}
          transition={{ duration: 0.45, ease: ease.smooth }}
          className="h-full rounded-full"
          style={{ backgroundColor: colorFor(tone) }}
        />
      </div>
    </div>
  )
}
