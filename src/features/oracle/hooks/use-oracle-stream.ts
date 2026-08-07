import { useEffect, useState } from 'react'

/**
 * Drives a 0 → 1 progress value via requestAnimationFrame while `active`
 * is true. Oracle response cards feed this into their staggered sections
 * and char-level text reveal, so responses look like they stream in.
 * Settles instantly at 1 when inactive (post-stream or reduced motion).
 */
export function useProgressive(active: boolean, duration = 1600): number {
  const [progress, setProgress] = useState(active ? 0 : 1)

  useEffect(() => {
    if (!active) return
    setProgress(0)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / duration)
      setProgress(next)
      if (next < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, duration])

  return progress
}
