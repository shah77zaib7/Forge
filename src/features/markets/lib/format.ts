/** Adaptive ticker formatting — more decimals for smaller prices. */
export function formatMarketPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (value >= 0.01) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 })
}
