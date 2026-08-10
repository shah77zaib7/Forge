import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/lib/cn'
import { playForgeInteraction } from '@/lib/ui-sound'

export interface SelectOption {
  value: string
  label: string
}

interface SelectControlProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  'aria-label': string
  className?: string
}

/**
 * A hairline glass select built on the native element — full keyboard and
 * screen-reader support with the Forge surface treatment. The chevron is
 * purely decorative; the real popup stays native.
 */
export function SelectControl({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  className,
}: SelectControlProps) {
  const id = useId()

  return (
    <div className={cn('relative inline-flex', className)}>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          playForgeInteraction()
          onChange(event.target.value)
        }}
        aria-label={ariaLabel}
        className={cn(
          'h-9 w-full cursor-pointer appearance-none rounded-control border border-border bg-tint/[0.04] pl-3.5 pr-9 text-xs font-medium text-foreground outline-none transition-colors duration-200',
          'hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-surface-0 text-foreground">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={2}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
}
