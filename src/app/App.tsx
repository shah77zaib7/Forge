import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { FavoritesProvider } from '@/store/favorites'
import { MarketDataProvider } from '@/store/market-data'
import { PreferencesProvider } from '@/store/preferences'
import { ProfileProvider } from '@/store/profile'
import { AlertsProvider } from '@/store/alerts'

import { ToastViewport } from '@/components/ui/toasts'
import { AmbientBackground } from './ambient-background'
import { AppRouter } from './router'
import { ThemeProvider } from './theme'

export function App() {
  return (
    <ThemeProvider>
      <FavoritesProvider>
        <PreferencesProvider>
          {/* The alert engine subscribes to the canonical market-data store
              and needs preferences (notification toggles) — nested here. */}
          <AlertsProvider>
          <ProfileProvider>
          {/* One canonical market-data source for the whole app — the
              provider owns the single CoinGecko polling loop. */}
          <MarketDataProvider>
          <BrowserRouter>
          {/* With reducedMotion="user", transform & layout animations are
              skipped for users who prefer reduced motion — opacity fades
              remain so content never pops abruptly. */}
          <MotionConfig reducedMotion="user">
            <AmbientBackground />
            <AppRouter />
            <ToastViewport />
          </MotionConfig>
          </BrowserRouter>
          </MarketDataProvider>
          </ProfileProvider>
          </AlertsProvider>
        </PreferencesProvider>
      </FavoritesProvider>
    </ThemeProvider>
  )
}
