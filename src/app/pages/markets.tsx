import { ChartCandlestick } from 'lucide-react'

import { PlaceholderPage } from './placeholder-page'

export function MarketsPage() {
  return (
    <PlaceholderPage
      icon={ChartCandlestick}
      title="Markets"
      description="Browse every market with live quotes, liquidity and depth."
      planned={['Instrument universe', 'Quote board', 'Order book depth']}
    />
  )
}
