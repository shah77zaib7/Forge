import { useEffect, useRef, useState } from 'react'

import { useTheme } from '@/app/theme'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * Official TradingView Advanced Chart embed — the documented free
 * integration. TradingView's embed-widget-advanced-chart.js is a
 * self-replacing loader: you place a <script> carrying the widget config as
 * its JSON body inside a .tradingview-widget-container element, and the
 * loader replaces that script with the chart. No API key or account is
 * required; TradingView hosts the full chart engine.
 *
 * The widget owns the professional chart experience (candles, zoom, pan,
 * crosshair, timeframes, chart types, price/time scales, fullscreen) — we
 * only configure it. Because the embed has no runtime theme API, the widget
 * is recreated when the theme flips; it is likewise recreated only when the
 * symbol or interval changes, never on live-price ticks or unrelated state.
 * Instances are torn down on unmount/navigation.
 */

interface TradingViewChartProps {
  /** TradingView symbol in EXCHANGE:SYMBOL form, or null when the asset has none. */
  symbol: string | null
  /** Default candle interval — the widget's toolbar lets the user switch. */
  interval?: string
  className?: string
}

const WIDGET_SCRIPT_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
/** Safety net — a blocked CDN must surface as a clean state, not a spinner. */
const MOUNT_TIMEOUT_MS = 20_000

/** Calm placeholder while the chart engine boots. */
function ChartSkeleton() {
  return (
    <div aria-hidden className="h-full w-full animate-pulse">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="h-2.5 w-40 rounded-full bg-tint/[0.06]" />
        <div className="h-6 w-48 rounded-full bg-tint/[0.05]" />
      </div>
      <div className="flex items-center gap-1.5 px-5 py-4">
        <div className="h-2 w-24 rounded-full bg-tint/[0.06]" />
        <div className="h-3.5 w-20 rounded-full bg-tint/[0.05]" />
      </div>
      <div className="h-px bg-border" />
      <div className="grid h-40 grid-cols-[0.4fr_0.6fr] gap-px bg-border sm:h-56">
        <div className="bg-background" />
        <div className="bg-background" />
      </div>
    </div>
  )
}

/**
 * The TradingView Advanced Chart as a native Forge component. Handles
 * symbol/interval/theme-driven recreation, a loading skeleton until the
 * chart iframe mounts, a clean failure state with retry, and a graceful
 * "no symbol" state for assets the registry maps to no TradingView
 * instrument.
 */
export function TradingViewChart({ symbol, interval = '60', className }: TradingViewChartProps) {
  // The widget replaces its own script tag, so the host is the
  // .tradingview-widget-container element the script lives inside.
  const hostRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!symbol) return
    let disposed = false
    let settled = false

    setPhase('loading')
    const host = hostRef.current
    if (host) host.innerHTML = ''

    // The official pattern: a script tag whose body is the widget config.
    // The loader replaces it in place with the chart iframe.
    const create = () => {
      if (disposed || !hostRef.current) return
      const el = hostRef.current
      el.innerHTML = ''
      const script = document.createElement('script')
      script.src = WIDGET_SCRIPT_SRC
      script.async = true
      script.type = 'text/javascript'
      script.text = JSON.stringify({
        autosize: true,
        symbol,
        interval,
        theme,
        style: '1',
        locale: 'en',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        gridColor: 'rgba(0, 0, 0, 0)',
        allow_symbol_change: false,
        enable_publishing: false,
        hide_side_toolbar: false,
        hide_top_toolbar: false,
        withdateranges: true,
        save_image: false,
      })
      script.onerror = () => {
        if (!disposed) setPhase('failed')
      }
      el.appendChild(script)

      // Flip to ready the moment the chart iframe lands.
      const observer = new MutationObserver(() => {
        if (disposed) return
        if (el.querySelector('iframe')) {
          settled = true
          setPhase('ready')
          observer.disconnect()
        }
      })
      observer.observe(el, { childList: true, subtree: true })
      window.setTimeout(() => {
        if (!disposed && !settled) {
          setPhase('failed')
          observer.disconnect()
        }
      }, MOUNT_TIMEOUT_MS)
    }

    create()

    return () => {
      disposed = true
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [symbol, interval, theme, retry])

  // No TradingView instrument for this asset — honest quiet state.
  if (!symbol) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <div className="max-w-sm px-6 text-center">
          <p className="text-sm font-medium text-foreground">Chart unavailable for this asset</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            This market has no TradingView symbol in Forge's asset registry. Live prices and
            statistics above stay current.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full', className)}>
      <div ref={hostRef} className="tradingview-widget-container absolute inset-0" />

      {phase !== 'ready' && (
        <div className="absolute inset-0 z-10">
          {phase === 'loading' ? (
            <ChartSkeleton />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium text-foreground">Chart temporarily unavailable</p>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted">
                Forge couldn't load the TradingView chart right now. Everything else on this page
                is unaffected.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setRetry((count) => count + 1)}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
