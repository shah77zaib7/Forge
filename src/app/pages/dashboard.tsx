import { LayoutDashboard } from 'lucide-react'

import { PlaceholderPage } from './placeholder-page'

export function DashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Dashboard"
      description="A single view of everything moving — positions, exposure and market pulse."
      planned={['Portfolio overview', 'Open positions', 'Market pulse feed']}
    />
  )
}
