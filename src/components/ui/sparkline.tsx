import { motion } from 'framer-motion'
import { useId } from 'react'

import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'

export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  tone?: 'positive' | 'negative' | 'neutral'
  animated?: boolean
  className?: string
}

function buildPath(data: number[], width: number, height: number): string {
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const step = (width - pad * 2) / (data.length - 1)
  return data
    .map((value, i) => {
      const x = pad + i * step
      const y = pad + (height - pad * 2) * (1 - (value - min) / range)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

/**
 * Minimal sparkline — pure SVG, no dependencies.
 * Draws itself in on mount via path-length animation.
 */
export function Sparkline({
  data,
  width = 96,
  height = 32,
  tone = 'positive',
  animated = true,
  className,
}: SparklineProps) {
  const rawId = useId()
  const gradientId = `spark-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const path = buildPath(data, width, height)
  const color =
    tone === 'positive'
      ? 'var(--forge-positive)'
      : tone === 'negative'
        ? 'var(--forge-negative)'
        : 'var(--forge-muted)'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className={cn('overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={path}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: ease.smooth }}
      />
      {path && <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />}
    </svg>
  )
}
