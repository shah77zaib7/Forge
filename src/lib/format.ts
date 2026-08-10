/**
 * Number formatting for market data.
 * Prices always render in tabular figures via the `tabular-nums`
 * utility — digits must never jitter while they update.
 *
 * Nullable market fields (change, cap, volume, supply) render an honest
 * em dash — a provider gap must never masquerade as a zero.
 */

export function formatPrice(value: number, digits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatCompact(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatChange(value: number | null): string {
  if (value === null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Direction tone for a change figure. Null (no provider data) reads as
 * neutral so a missing field never colors a surface positive or negative.
 */
export function changeTone(value: number | null): 'positive' | 'negative' | 'neutral' {
  if (value === null || value === 0) return 'neutral'
  return value > 0 ? 'positive' : 'negative'
}
