import type { SavedAnalysis } from '../types'

const STORAGE_KEY = 'forge.oracle.history'

/**
 * Local persistence for saved analyses — this device only, no backend.
 * The load/persist pair is the whole surface area: a real sync layer can
 * replace these two functions later without touching the UI.
 */
export function loadSavedAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedAnalysis[]) : []
  } catch {
    return []
  }
}

export function persistSavedAnalyses(items: SavedAnalysis[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable — history stays in-memory for this session */
  }
}
