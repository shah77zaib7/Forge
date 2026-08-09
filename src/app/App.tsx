import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'

import { FavoritesProvider } from '@/store/favorites'
import { MarketDataProvider } from '@/store/market-data'
import { PreferencesProvider } from '@/store/preferences'
import { ProfileProvider } from '@/store/profile'

import { AmbientBackground } from './ambient-background'
import { AppRouter } from './router'
import { ThemeProvider } from './theme'

export function App() {
  return (
    <ThemeProvider>
      <FavoritesProvider>
        <PreferencesProvider>
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
          </MotionConfig>
          </BrowserRouter>
          </MarketDataProvider>
          </ProfileProvider>
        </PreferencesProvider>
      </FavoritesProvider>
    </ThemeProvider>
  )
}
