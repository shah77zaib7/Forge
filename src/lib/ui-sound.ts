/**
 * Forge's single UI-sound controller — the ONLY place that plays the Forge
 * click. The sound is the exact recording the user provided, trimmed to the
 * click and served from /public/sounds/forge-click.wav.
 *
 * Design goals: premium-terminal feel, not gaming. One shared Audio element
 * (never one per click), no overlapping/stacking under rapid taps, haptic
 * feedback first on supported devices, and every failure swallowed so an
 * audio problem can never break the UI interaction it accompanies.
 *
 * A global "UI Sounds" setting can be wired later via isForgeSoundEnabled /
 * setForgeSoundEnabled without touching any caller.
 */

/** Master volume for the click — tune this one number, nowhere else. */
export const FORGE_UI_SOUND_VOLUME = 0.35

const SOUND_URL = '/sounds/forge-click.wav'
/** Subtle, premium tap pulse — not a game-style buzz. */
const HAPTIC_MS = 10
/** Minimum gap between plays — a safety net against nested-handler double fires. */
const MIN_INTERVAL_MS = 30
const ENABLED_KEY = 'forge.ui-sounds'

// One element for the whole app. Created eagerly so the tiny asset is
// preloaded and the first tap feels instant; mobile browsers still require
// play() to happen inside a user gesture, which every caller satisfies.
let audio: HTMLAudioElement | null = null
let lastPlayedAt = 0

function getAudio(): HTMLAudioElement | null {
  if (audio) return audio
  try {
    const element = new Audio(SOUND_URL)
    element.preload = 'auto'
    element.volume = FORGE_UI_SOUND_VOLUME
    audio = element
  } catch {
    audio = null
  }
  return audio
}

/** Whether UI sounds are enabled (defaults to on; a future Settings toggle writes here). */
export function isForgeSoundEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Enable/disable UI sounds — reserved for a future Settings integration. */
export function setForgeSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off')
  } catch {
    /* storage unavailable — in-memory only */
  }
}

/** Short subtle haptic pulse on devices that support it; no-op elsewhere. */
export function triggerForgeHaptic(): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(HAPTIC_MS)
    }
  } catch {
    /* vibration unsupported or blocked — ignore */
  }
}

/**
 * Play the Forge click. Safe to call from any interaction handler: it is
 * debounced, uses one shared element, never throws, and never lets an audio
 * failure affect the UI action it accompanies.
 */
export function playForgeClick(): void {
  try {
    if (!isForgeSoundEnabled()) return
    const now = Date.now()
    if (now - lastPlayedAt < MIN_INTERVAL_MS) return
    const element = getAudio()
    if (!element) return
    // Restart from the top on rapid taps — one sound at a time, never stacking.
    element.currentTime = 0
    void element.play().catch(() => {})
    lastPlayedAt = now
  } catch {
    /* never break the interaction over sound */
  }
}

/**
 * The full Forge interaction cue — haptic first, then the exact click —
 * timed so the haptic leads the sound, matching the tap → tick feel.
 */
export function playForgeInteraction(): void {
  triggerForgeHaptic()
  playForgeClick()
}
