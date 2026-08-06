import { Settings } from 'lucide-react'

import { PlaceholderPage } from './placeholder-page'

export function SettingsPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Settings"
      description="Workspace preferences, accounts and API keys."
      planned={['Appearance', 'Accounts & keys', 'Notifications']}
    />
  )
}
