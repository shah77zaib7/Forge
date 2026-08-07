import type { Coin } from '@/features/markets/types'

import { formatMarketPrice } from '@/features/markets/lib/format'
import { formatChange } from '@/lib/format'

/**
 * Share the coin through the native share sheet when available, falling
 * back to copying a summary to the clipboard. Resolves 'shared' when the
 * system sheet was used (even if the user dismissed it) and 'copied'
 * when the clipboard fallback actually ran.
 */
export async function shareCoin(coin: Coin): Promise<'shared' | 'copied'> {
  const text = `${coin.name} (${coin.ticker}) — ${formatMarketPrice(coin.price)} (${formatChange(coin.change24h)} 24h)`

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `${coin.name} (${coin.ticker})`,
        text,
        url: window.location.href,
      })
      return 'shared'
    } catch {
      return 'shared'
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${window.location.href}`)
    return 'copied'
  } catch {
    return 'copied'
  }
}
