import { motion } from 'framer-motion'
import { useId, useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}

const trackSize = {
  sm: 'h-8 text-[11px]',
  md: 'h-10 text-xs',
} as const

/**
 * Glass pill control with an animated thumb. Used for timeframes,
 * intervals and any small mutually-exclusive choice.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const thumbId = useId()
  const trackRef = useRef<HTMLDivElement>(null)

  function moveFocusTo(index: number) {
    trackRef.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)
      ?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + direction + options.length) % options.length
    onChange(options[next].value)
    moveFocusTo(next)
  }

  return (
    <div
      ref={trackRef}
      role="tablist"
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-tint/[0.04] p-1 backdrop-blur-xl',
        trackSize[size],
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-index={index}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'relative rounded-full px-4 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-tint/30',
              selected ? 'text-foreground' : 'text-muted hover:text-foreground/80',
            )}
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                transition={{ type: 'spring', bounce: 0.16, duration: 0.5 }}
                className="absolute inset-0 rounded-full border border-border-strong bg-tint/[0.1] shadow-inset-top"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
