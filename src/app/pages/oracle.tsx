import { Orbit } from 'lucide-react'

import { PlaceholderPage } from './placeholder-page'

export function OraclePage() {
  return (
    <PlaceholderPage
      icon={Orbit}
      title="Oracle"
      description="Market signals and on-chain intel, distilled into one calm surface."
      planned={['Signal feed', 'On-chain metrics', 'Alert streams']}
    />
  )
}
