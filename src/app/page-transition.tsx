import { motion, useReducedMotion } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

import { ease } from '@/design/motion'

/**
 * Signature enter/exit animation for routed content. Rendered once
 * per route — the keyed AnimatePresence in the router drives the exit.
 * Honors `prefers-reduced-motion` with a plain opacity fade.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  if (reduceMotion) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.45, ease: ease.smooth },
      }}
      exit={{
        opacity: 0,
        y: -8,
        filter: 'blur(4px)',
        transition: { duration: 0.25, ease: ease.smooth },
      }}
      // Any non-none filter value creates a containing block, which would
      // hijack position:fixed descendants (mobile composers, quick-action
      // bars) for the rest of the page's life. Strip it once the entrance
      // settles — the transient blur still plays, nothing lingers.
      onAnimationComplete={() => {
        ref.current?.style.removeProperty('filter')
      }}
    >
      {children}
    </motion.div>
  )
}
