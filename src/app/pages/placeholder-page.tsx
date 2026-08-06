import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { GlassCard } from '@/components/ui/glass-card'

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
  planned: string[]
}

/**
 * Temporary surface used by every product route until real
 * features land. Composed from design-system primitives so the
 * layout frame itself is production-grade.
 */
export function PlaceholderPage({ icon: Icon, title, description, planned }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-6xl">
      <header className="pb-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">
          Workspace
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard
          variant="strong"
          padding="lg"
          className="flex min-h-72 flex-col items-center justify-center text-center lg:col-span-2"
        >
          <div className="flex size-14 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
            <Icon size={22} strokeWidth={1.5} className="text-muted" />
          </div>
          <h2 className="mt-5 text-lg font-medium tracking-tight text-foreground">
            This surface is next
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            The layout frame is ready — content lands here as the workspace takes shape.
          </p>
          <Badge className="mt-6" variant="neutral" size="sm">
            In progress
          </Badge>
        </GlassCard>

        <GlassCard padding="lg" className="flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
              Planned
            </p>
            <ul className="mt-4 space-y-4">
              {planned.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-muted">
                  <span className="size-1.5 shrink-0 rounded-full bg-tint/[0.2]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 space-y-3" aria-hidden>
            <div className="h-2.5 w-full rounded-full bg-tint/[0.06]" />
            <div className="h-2.5 w-3/4 rounded-full bg-tint/[0.05]" />
            <div className="h-2.5 w-1/2 rounded-full bg-tint/[0.04]" />
          </div>
        </GlassCard>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {['Surface hierarchy', 'Responsive breakpoints', 'Motion rhythm'].map((label, index) => (
          <GlassCard key={label} padding="md">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
              0{index + 1}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{label}</p>
            <div className="mt-4 space-y-2" aria-hidden>
              <div className="h-2 w-full rounded-full bg-tint/[0.06]" />
              <div className="h-2 w-2/3 rounded-full bg-tint/[0.05]" />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
