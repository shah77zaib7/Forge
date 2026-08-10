import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { DesignSystem } from '@/dev/design-system'

import { AlertsPage } from '@/features/alerts'
import { MarketsPage } from '@/features/markets'
import { WorkspacePage } from '@/features/workspace'

import { DashboardPage } from './pages/dashboard'
import { OraclePage } from './pages/oracle'
import { SettingsPage } from './pages/settings'
import { WatchlistPage } from './pages/watchlist'
import { AppShell } from './app-shell'
import { PageTransition } from './page-transition'

/**
 * Route table. The shell persists across navigations; only the routed
 * content re-mounts, keyed by pathname for the exit/enter transition.
 */
export function AppRouter() {
  const location = useLocation()

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/markets/:coinId" element={<WorkspacePage />} />
            <Route path="/oracle" element={<OraclePage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/design-system" element={<DesignSystem />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>
    </AppShell>
  )
}
