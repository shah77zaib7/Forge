import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  meta?: ReactNode
  className?: string
}

/** Numbered eyebrow + title used to open every workspace section. */
export function SectionHeading({ eyebrow, title, meta, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-faint">{eyebrow}</p>
        <h2 className="mt-1.5 text-base font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {meta && <div className="shrink-0 pb-0.5">{meta}</div>}
    </div>
  )
}
