import { cn } from '@/lib/cn'

interface BrandProps {
  /** Icon-only mode for the collapsed sidebar. */
  compact?: boolean
  className?: string
}

export function Brand({ compact = false, className }: BrandProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="shrink-0">
        <rect width="32" height="32" rx="9" fill="#14141A" />
        <rect x="6" y="15" width="5" height="11" rx="2.5" fill="#FAFAFA" />
        <rect x="13.5" y="9" width="5" height="17" rx="2.5" fill="#FAFAFA" opacity="0.78" />
        <rect x="21" y="5" width="5" height="21" rx="2.5" fill="#FAFAFA" opacity="0.55" />
      </svg>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Forge</span>
      )}
    </div>
  )
}
