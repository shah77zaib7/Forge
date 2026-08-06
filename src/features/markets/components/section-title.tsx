import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface SectionTitleProps {
  title: string
  meta?: ReactNode
  className?: string
}

export function SectionTitle({ title, meta, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      {meta && <span className="font-mono text-[11px] text-faint">{meta}</span>}
    </div>
  )
}
