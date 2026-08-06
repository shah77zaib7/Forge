import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const STORAGE_KEY = 'forge.theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Mirrors the pre-paint resolution in index.html (keep both in sync):
 * stored preference first, then the system preference.
 */
function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* storage unavailable — fall through to system preference */
  }
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Owns the active theme. Writes `data-theme` on <html>, keeps the
 * preference in localStorage and briefly enables the global
 * color-transition class so the switch feels like one smooth glide.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.add('theme-transitioning')
    const timer = window.setTimeout(() => root.classList.remove('theme-transitioning'), 480)

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#09090B' : '#F4F4F5')

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage unavailable — ignore */
    }
    return () => window.clearTimeout(timer)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
