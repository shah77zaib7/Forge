import { cn } from '@/lib/cn'

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

/** A filter pill — All, Favorites, Trending, categories. */
export function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-9 items-center rounded-full border px-4 text-xs font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30',
        active
          ? 'border-border-strong bg-tint/[0.1] text-foreground'
          : 'border-border bg-tint/[0.02] text-muted hover:border-border-strong hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}
