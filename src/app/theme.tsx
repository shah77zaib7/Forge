import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** The user's stated preference. */
export type ThemeMode = 'system' | 'dark' | 'light'
/** The resolved, active theme. */
export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'forge.theme'

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Mirrors the pre-paint resolution in index.html (keep both in sync):
 * stored mode first ('system' | 'dark' | 'light'), then the system
 * preference when unset.
 */
function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    /* storage unavailable — fall through to system */
  }
  return 'system'
}

/**
 * Owns the active theme and the user's System/Light/Dark preference.
 * Writes `data-theme` on <html>, persists the mode to localStorage and
 * follows OS changes while in System mode. `toggleTheme` (used by the
 * top-bar quick switch) sets an explicit preference opposite the current
 * resolved theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialMode)
  const [systemThemeState, setSystemThemeState] = useState<Theme>(systemTheme)

  // Follow OS changes while in System mode.
  useEffect(() => {
    if (themeMode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (event: MediaQueryListEvent) =>
      setSystemThemeState(event.matches ? 'light' : 'dark')
    setSystemThemeState(mql.matches ? 'light' : 'dark')
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [themeMode])

  const theme: Theme = themeMode === 'system' ? systemThemeState : themeMode

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.add('theme-transitioning')
    const timer = window.setTimeout(() => root.classList.remove('theme-transitioning'), 480)

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#09090B' : '#F4F4F5')

    try {
      localStorage.setItem(STORAGE_KEY, themeMode)
    } catch {
      /* storage unavailable — ignore */
    }
    return () => window.clearTimeout(timer)
  }, [theme, themeMode])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeModeState((current) => {
      const resolved: Theme = current === 'system' ? systemTheme() : current
      return resolved === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const value = useMemo(
    () => ({ theme, themeMode, setThemeMode, toggleTheme }),
    [theme, themeMode, setThemeMode, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
