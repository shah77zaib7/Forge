import type { Transition, Variants } from 'framer-motion'

/** Signature cubic-bezier easing used across the product. */
export type Ease = [number, number, number, number]

export const ease: Record<'smooth' | 'spring', Ease> = {
  /** Linear-style glide — UI, panels, hovers. */
  smooth: [0.32, 0.72, 0, 1],
  /** Quick settle with a hint of life — overlays, thumbnails. */
  spring: [0.16, 1, 0.3, 1],
}

export const duration = {
  fast: 0.18,
} as const

/** Default transition for micro-interactions (buttons, chips). */
export const micro: Transition = {
  duration: duration.fast,
  ease: ease.smooth,
}

/** Shared enter animation — fade, rise, de-blur. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: ease.smooth },
  },
}
