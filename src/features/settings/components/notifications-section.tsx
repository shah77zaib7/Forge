import { Toggle } from '@/components/ui/toggle'
import { usePreferences } from '@/store/preferences'

import { SectionCard, SettingRow } from './setting-row'

/** Notifications — quiet push toggles for V1. */
export function NotificationsSection() {
  const { preferences, updatePreferences } = usePreferences()
  const notifications = preferences.notifications

  function set(key: 'priceAlerts' | 'watchlistAlerts' | 'oracleUpdates', checked: boolean) {
    updatePreferences({ notifications: { ...notifications, [key]: checked } })
  }

  return (
    <SectionCard overline="Notifications" title="Alerts">
      <SettingRow
        label="Price alerts"
        description="Alerts when a watched asset crosses a level you care about."
        control={
          <Toggle
            checked={notifications.priceAlerts}
            onChange={(checked) => set('priceAlerts', checked)}
            aria-label="Price alerts"
          />
        }
      />
      <SettingRow
        label="Watchlist alerts"
        description="Notices when an asset on your watchlist makes a significant move."
        control={
          <Toggle
            checked={notifications.watchlistAlerts}
            onChange={(checked) => set('watchlistAlerts', checked)}
            aria-label="Watchlist alerts"
          />
        }
      />
      <SettingRow
        label="Oracle updates"
        description="A nudge when a fresh Oracle read is ready for your markets."
        control={
          <Toggle
            checked={notifications.oracleUpdates}
            onChange={(checked) => set('oracleUpdates', checked)}
            aria-label="Oracle updates"
          />
        }
        last
      />
    </SectionCard>
  )
}
