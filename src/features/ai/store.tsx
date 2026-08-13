import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { AI_MODELS, loadSelectedModel, persistSelectedModel } from './models'
import type { AiModelId, OracleModelAvailability } from './types'

/**
 * The Oracle model store — one source of truth for which model Oracle uses,
 * persisted to localStorage. Availability comes from the server's key-free
 * report (GET /api/oracle): the server knows which keys are configured,
 * the client never sees them. When the report is unreachable (e.g. local
 * dev with no API server) only the Local engine is available — honest,
 * never a fake enabled state.
 */

type FetchState = 'idle' | 'loading' | 'ready' | 'error'

interface AiContextValue {
  /** Selected workspace model id (persisted). */
  modelId: AiModelId
  setModelId: (id: AiModelId) => void
  models: typeof AI_MODELS
  /** Key-free availability, by model id. */
  available: (id: AiModelId) => boolean
  /** Which gateway would serve the model (only 'Gemini' for server models). */
  gatewayOf: (id: AiModelId) => string | null
  /** Key NAMES the model requires (never values). */
  requiresOf: (id: AiModelId) => string[]
  fetchState: FetchState
  refreshAvailability: () => void
}

const AiContext = createContext<AiContextValue | null>(null)

/** Availability map — only local is guaranteed without a server report. */
const DEFAULT_AVAILABLE: Record<AiModelId, boolean> = {
  local: true,
  gemini: false,
}

export function AiProvider({ children }: { children: ReactNode }) {
  const [modelId, setModelIdState] = useState<AiModelId>(loadSelectedModel)
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [report, setReport] = useState<OracleModelAvailability | null>(null)

  const refreshAvailability = useCallback(() => {
    setFetchState((state) => (state === 'idle' ? 'loading' : state))
    void fetch('/api/oracle', { headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Availability report failed (${response.status})`)
        const data = (await response.json()) as OracleModelAvailability
        if (!Array.isArray(data.models)) throw new Error('Malformed availability report')
        setReport(data)
        setFetchState('ready')
      })
      .catch(() => {
        // Local dev has no API server — only the Local engine is honest here.
        setReport(null)
        setFetchState('error')
      })
  }, [])

  useEffect(() => {
    refreshAvailability()
  }, [refreshAvailability])

  const availability = useMemo(() => {
    const map: Record<AiModelId, boolean> = { ...DEFAULT_AVAILABLE }
    if (report) {
      for (const entry of report.models) {
        if (entry.id in map) map[entry.id as AiModelId] = entry.available
      }
    }
    return map
  }, [report])

  const setModelId = useCallback((id: AiModelId) => {
    setModelIdState(id)
    persistSelectedModel(id)
  }, [])

  const value = useMemo<AiContextValue>(
    () => ({
      modelId,
      setModelId,
      models: AI_MODELS,
      available: (id) => availability[id] ?? false,
      gatewayOf: (id) => report?.models.find((entry) => entry.id === id)?.gateway ?? null,
      requiresOf: (id) => report?.models.find((entry) => entry.id === id)?.requires ?? [],
      fetchState,
      refreshAvailability,
    }),
    [modelId, setModelId, availability, report, fetchState, refreshAvailability],
  )

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>
}

export function useAi(): AiContextValue {
  const context = useContext(AiContext)
  if (!context) throw new Error('useAi must be used within an AiProvider')
  return context
}
