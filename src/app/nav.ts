import { Bell, ChartCandlestick, LayoutDashboard, Orbit, Settings, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Primary workspace destinations. */
export const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: ChartCandlestick },
  { to: '/oracle', label: 'Oracle', icon: Orbit },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/alerts', label: 'Alerts', icon: Bell },
]

/** Pinned to the bottom of the sidebar. */
export const settingsItem: NavItem = { to: '/settings', label: 'Settings', icon: Settings }
