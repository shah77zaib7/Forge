import type { ReactNode } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/cn'

/** A labeled row with a control — the settings building block. */
export function SettingRow({
  label,
  description,
  control,
  last = false,
}: {
  label: string
  description?: string
  control: ReactNode
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-4',
        !last && 'border-b border-border/60',
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-faint">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** A settings group — overline, title and rows on one surface. */
export function SectionCard({
  overline,
  title,
  children,
}: {
  overline: string
  title: string
  children: ReactNode
}) {
  return (
    <GlassCard padding="md">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">{overline}</p>
      <p className="mt-1 text-sm font-semibold tracking-tight text-foreground">{title}</p>
      <div className="mt-1">{children}</div>
    </GlassCard>
  )
}
