import { Check, X } from 'lucide-react'

import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
  /** Unique id for the underlying checkbox — required when several toggles share a page. */
  id?: string
  disabled?: boolean
  className?: string
}

/**
 * Forge toggle — a refined check/X switch.
 *
 * A visually-hidden native checkbox (not display:none) keeps full keyboard
 * and screen-reader support: Tab focuses it, Space toggles it, and the
 * label paints the switch. The thumb glides with a smooth 200ms ease, the
 * check/X icons cross-fade inside it, and the whole control nudges down on
 * press. ON uses the positive green token; OFF stays soft and neutral.
 * All motion is disabled under prefers-reduced-motion.
 */
export function Toggle({ checked, onChange, 'aria-label': ariaLabel, id, disabled, className }: ToggleProps) {
  return (
    <label
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer select-none transition-transform duration-150 ease-smooth active:scale-95 motion-reduce:transition-none',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <input
        type="checkbox"
        id={id}
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={ariaLabel}
        disabled={disabled}
      />
      <span
        aria-hidden="true"
        className={cn(
          'relative h-7 w-12 rounded-full border transition-colors duration-200 ease-smooth motion-reduce:transition-none',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-tint/30 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background',
          checked ? 'border-positive/40 bg-positive' : 'border-border bg-tint/[0.05]',
        )}
      >
        <span
          className={cn(
            'absolute left-[3px] top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border bg-surface-0 shadow-ambient',
            'transition-transform duration-200 ease-smooth motion-reduce:transition-none',
            checked ? 'translate-x-5 border-positive/30' : 'translate-x-0 border-border',
          )}
        >
          <Check
            strokeWidth={3}
            className={cn(
              'absolute size-3 text-positive transition-all duration-150 ease-smooth motion-reduce:transition-none',
              checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
          />
          <X
            strokeWidth={3}
            className={cn(
              'absolute size-3 text-faint transition-all duration-150 ease-smooth motion-reduce:transition-none',
              checked ? 'scale-50 opacity-0' : 'scale-100 opacity-100',
            )}
          />
        </span>
      </span>
    </label>
  )
}
