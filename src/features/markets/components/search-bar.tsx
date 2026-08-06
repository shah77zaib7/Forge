import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

/** Glass search field — filters the market list as you type. */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="flex h-11 items-center gap-2 rounded-full border border-border bg-tint/[0.04] px-4 transition-colors duration-200 focus-within:border-border-strong focus-within:bg-tint/[0.06]">
      <Search size={16} strokeWidth={1.75} className="shrink-0 text-faint" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search BTC, ETH, SOL..."
        aria-label="Search markets"
        className="h-full w-full bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-tint/[0.08] hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
