import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

import { ease } from '@/design/motion'
import { cn } from '@/lib/cn'

interface RevealProps {
  children: ReactNode
  /** Stagger delay in seconds. */
  delay?: number
  className?: string
}

/**
 * Gentle fade-and-rise as a section enters the viewport. Fires once,
 * honors `prefers-reduced-motion` with no movement. The wrapper is the
 * grid child, so grid-placement classes land here.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-64px' }}
      transition={{ duration: 0.55, ease: ease.smooth, delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}
