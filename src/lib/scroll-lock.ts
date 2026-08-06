/**
 * Ref-counted body scroll lock.
 *
 * Multiple overlays (the mobile nav drawer, the coin workspace sheet)
 * can hold the lock at once. `overflow: hidden` is applied only for
 * the first request and cleared only when the last lock is released.
 *
 * This is required because overlays overlap during exit animations:
 * AnimatePresence keeps a closing sheet mounted while a new one opens,
 * and the naive capture-then-restore pattern ("remember the previous
 * overflow, restore it on cleanup") races — the second overlay captures
 * the first one's `hidden` as its "previous" value and restores it after
 * everything closed, permanently locking page scroll.
 */
let lockCount = 0
let previousOverflow = ''

/** Acquire the scroll lock. Returns a release function (idempotent). */
export function lockBodyScroll(): () => void {
  lockCount += 1
  if (lockCount === 1) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  let released = false
  return () => {
    if (released) return
    released = true
    lockCount -= 1
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow
      previousOverflow = ''
    }
  }
}

/** Whether any overlay currently holds the scroll lock. */
export function isBodyScrollLocked(): boolean {
  return lockCount > 0
}
