import { Star } from 'lucide-react'

import { PlaceholderPage } from './placeholder-page'

export function WatchlistPage() {
  return (
    <PlaceholderPage
      icon={Star}
      title="Watchlist"
      description="Your curated set of instruments, synced across every surface."
      planned={['Smart groups', 'Price alerts', 'Sync & share']}
    />
  )
}
