import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { LiquidityTimeframeId } from '@/features/workspace/data'
import type { OracleMode } from '@/features/oracle/types'

export type CurrencyId = 'USD' | 'EUR' | 'GBP' | 'JPY'
export type ResponseDetail = 'concise' | 'balanced' | 'detailed'

export const currencyOptions: Array<{ value: CurrencyId; label: string }> = [
  { value: 'USD', label: 'USD · US Dollar' },
  { value: 'EUR', label: 'EUR · Euro' },
  { value: 'GBP', label: 'GBP · British Pound' },
  { value: 'JPY', label: 'JPY · Japanese Yen' },
]

export const responseDetailOptions: Array<{ value: ResponseDetail; label: string }> = [
  { value: 'concise', label: 'Concise' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
]

export interface Preferences {
  /** Default window for market surfaces. */
  defaultTimeframe: LiquidityTimeframeId
  /** Display currency — formatting hooks land with real market data. */
  currency: CurrencyId
  /** The analyst persona Oracle opens with. */
  defaultOracleMode: OracleMode
  /** Window Oracle reads when a conversation starts. */
  defaultAnalysisTimeframe: LiquidityTimeframeId
  /** How verbose Oracle's reads should be. */
  responseDetail: ResponseDetail
  notifications: {
    priceAlerts: boolean
    watchlistAlerts: boolean
    oracleUpdates: boolean
  }
}

const DEFAULTS: Preferences = {
  defaultTimeframe: '1H',
  currency: 'USD',
  defaultOracleMode: 'trader',
  defaultAnalysisTimeframe: '1H',
  responseDetail: 'balanced',
  notifications: {
    priceAlerts: true,
    watchlistAlerts: true,
    oracleUpdates: true,
  },
}

const STORAGE_KEY = 'forge.preferences'

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      ...DEFAULTS,
      ...parsed,
      notifications: { ...DEFAULTS.notifications, ...(parsed.notifications ?? {}) },
    }
  } catch {
    return DEFAULTS
  }
}

interface PreferencesContextValue {
  preferences: Preferences
  updatePreferences: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

/**
 * User preferences for Forge V1 — persisted locally so Settings choices
 * survive refresh. Settings writes here; surfaces (Oracle mode, default
 * windows) read here. A real profile/account layer can replace the
 * load/persist pair later without touching consumers.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
    } catch {
      /* storage unavailable — session-only */
    }
  }, [preferences])

  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferences((previous) => ({ ...previous, ...patch }))
  }, [])

  const value = useMemo(() => ({ preferences, updatePreferences }), [preferences, updatePreferences])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider')
  return context
}
