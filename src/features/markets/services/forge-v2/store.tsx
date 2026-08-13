/**
 * Forge V2 config store — the live configuration context for the
 * deterministic Liquidity Model. ONE copy of the active config drives the
 * engine everywhere (Workspace Setup card, Oracle payload, Settings panel).
 * Changes persist to localStorage and re-run the analysis on the next
 * render, so editing a parameter immediately affects Forge's output.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_V2_CONFIG, mergeV2Config, type ForgeV2Config, type V2ConfigPatch } from './config'

const STORAGE_KEY = 'forge.v2.config'

function loadStoredConfig(): ForgeV2Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_V2_CONFIG
    const parsed = JSON.parse(raw) as V2ConfigPatch
    return mergeV2Config(parsed)
  } catch {
    return DEFAULT_V2_CONFIG
  }
}

export interface ForgeV2ContextValue {
  /** The active, fully-merged config (always valid — clamped). */
  config: ForgeV2Config
  /** Merge a partial config over the active one and persist. */
  updateConfig: (patch: V2ConfigPatch) => void
  /** Reset to defaults and clear the persisted copy. */
  resetConfig: () => void
}

const ForgeV2Context = createContext<ForgeV2ContextValue | null>(null)

export function ForgeV2Provider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<ForgeV2Config>(loadStoredConfig)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      /* storage unavailable — config stays in memory for the session */
    }
  }, [config])

  const updateConfig = useCallback((patch: V2ConfigPatch) => {
    setConfig(() => mergeV2Config(patch))
  }, [])

  const resetConfig = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    setConfig(DEFAULT_V2_CONFIG)
  }, [])

  const value = useMemo(
    () => ({ config, updateConfig, resetConfig }),
    [config, updateConfig, resetConfig],
  )

  return <ForgeV2Context.Provider value={value}>{children}</ForgeV2Context.Provider>
}

export function useForgeV2(): ForgeV2ContextValue {
  const value = useContext(ForgeV2Context)
  if (!value) throw new Error('useForgeV2 must be used within ForgeV2Provider')
  return value
}
