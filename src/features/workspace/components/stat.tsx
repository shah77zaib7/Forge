/** A quiet label/value cell used by the chart OHLCV row and market stats. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="mt-1.5 truncate font-mono text-sm tabular-nums text-foreground">{value}</p>
    </div>
  )
}
