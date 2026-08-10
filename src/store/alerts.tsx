import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ASSET_REGISTRY } from '@/features/markets/data'

import { getCoins, subscribeMarketData } from './market-data'
import { usePreferences } from './preferences'

const STORAGE_KEY = 'forge.alerts'

export type AlertCondition = 'above' | 'below'
export type AlertStatus = 'active' | 'inactive' | 'triggered'

export interface PriceAlert {
  /** Stable id — used for keys, deletes and toggles. */
  id: string
  /** Canonical asset id from the asset registry (e.g. "bitcoin", "gold"). */
  assetId: string
  /** The level the price must cross to fire. */
  targetPrice: number
  condition: AlertCondition
  createdAt: number
  status: AlertStatus
  /** Set the moment the alert fires — an alert fires exactly once. */
  triggeredAt?: number
  /** The live price observed when it fired. */
  triggeredPrice?: number
}

/** A transient in-app notification pushed when an alert fires. */
export interface AlertToast {
  alertId: string
  assetId: string
  targetPrice: number
  condition: AlertCondition
  triggeredPrice: number
}

function load(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPriceAlert)
  } catch {
    return []
  }
}

function isPriceAlert(value: unknown): value is PriceAlert {
  if (typeof value !== 'object' || value === null) return false
  const alert = value as Record<string, unknown>
  return (
    typeof alert.id === 'string' &&
    typeof alert.assetId === 'string' &&
    typeof alert.targetPrice === 'number' &&
    Number.isFinite(alert.targetPrice) &&
    alert.targetPrice > 0 &&
    (alert.condition === 'above' || alert.condition === 'below') &&
    typeof alert.createdAt === 'number' &&
    (alert.status === 'active' || alert.status === 'inactive' || alert.status === 'triggered')
  )
}

interface AlertsContextValue {
  alerts: PriceAlert[]
  /** Transient in-app notifications for alerts that just fired. */
  toasts: AlertToast[]
  createAlert: (input: { assetId: string; targetPrice: number; condition: AlertCondition }) => boolean
  deleteAlert: (id: string) => void
  /** Toggle an alert between active and paused (re-arms triggered alerts). */
  toggleAlert: (id: string) => void
  dismissToast: (alertId: string) => void
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Forge's price-alert engine — the single source of truth for alerts.
 *
 * Alerts persist locally (same pattern as favorites/preferences; a profile
 * backend can replace the load/persist pair later). The engine does NOT
 * poll: it subscribes to the canonical market-data store and evaluates
 * every active alert whenever that store emits a fresh price update — the
 * same 60s cycle the rest of Forge already runs on, nothing extra.
 *
 * Trigger semantics: an "above" alert fires when price >= target, "below"
 * when price <= target. Firing flips the alert to `triggered` and pushes a
 * toast, so the same alert can never fire twice; the user re-arms it with
 * the toggle. The settings "Price alerts" preference only suppresses the
 * toast — the alert still records its trigger.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(load)
  const [toasts, setToasts] = useState<AlertToast[]>([])
  const alertsRef = useRef(alerts)
  const { preferences } = usePreferences()
  const notificationsRef = useRef(preferences.notifications)

  // Every mutation funnels through here so the ref mirrors state
  // synchronously — the engine (subscription + post-create microtask) must
  // always see the latest alerts without waiting for a render.
  const updateAlerts = useCallback((updater: (previous: PriceAlert[]) => PriceAlert[]) => {
    setAlerts((previous) => {
      const next = updater(previous)
      alertsRef.current = next
      return next
    })
  }, [])

  useEffect(() => {
    notificationsRef.current = preferences.notifications
  }, [preferences.notifications])

  // Persist on every change — same try/catch shape as favorites.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
    } catch {
      /* storage unavailable — session-only */
    }
  }, [alerts])

  const evaluate = useCallback(() => {
    const coins = new Map(getCoins().map((coin) => [coin.id, coin]))
    const current = alertsRef.current
    const fired: PriceAlert[] = []
    const next = current.map((alert) => {
      // Only active alerts are watched; triggered stays fired, paused stays quiet.
      if (alert.status !== 'active') return alert
      const price = coins.get(alert.assetId)?.price
      // Missing/invalid price (feed down, no data yet) — defer, never guess.
      if (typeof price !== 'number' || !Number.isFinite(price)) return alert
      const hit = alert.condition === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice
      if (!hit) return alert
      const firedAlert: PriceAlert = {
        ...alert,
        status: 'triggered',
        triggeredAt: Date.now(),
        triggeredPrice: price,
      }
      fired.push(firedAlert)
      return firedAlert
    })
    if (fired.length === 0) return
    updateAlerts(() => next)
    if (!notificationsRef.current.priceAlerts) return
    setToasts((previous) =>
      [
        ...previous,
        ...fired.map((alert) => ({
          alertId: alert.id,
          assetId: alert.assetId,
          targetPrice: alert.targetPrice,
          condition: alert.condition,
          triggeredPrice: alert.triggeredPrice as number,
        })),
      ].slice(-4),
    )
  }, [updateAlerts])

  // The engine lives for the app's lifetime: subscribe to the market-data
  // store and evaluate on every emission (each real refresh). No timers,
  // no duplicate polling — one subscription, cleaned up on unmount.
  useEffect(() => {
    const unsubscribe = subscribeMarketData(evaluate)
    // Catch up once on mount so alerts that should have fired while the app
    // was closed (or whose price crossed during a load) resolve promptly.
    evaluate()
    return unsubscribe
  }, [evaluate])

  const createAlert = useCallback(
    (input: { assetId: string; targetPrice: number; condition: AlertCondition }): boolean => {
      const { assetId, targetPrice, condition } = input
      if (!Number.isFinite(targetPrice) || targetPrice <= 0) return false
      if (!ASSET_REGISTRY.some((asset) => asset.id === assetId)) return false
      updateAlerts((previous) => [
        ...previous,
        {
          id: createId(),
          assetId,
          targetPrice,
          condition,
          createdAt: Date.now(),
          status: 'active',
        },
      ])
      // Evaluate immediately so an alert created against the current price
      // (e.g. "above" with a target below spot) fires on the next tick
      // rather than waiting for the next poll — via a microtask so the new
      // alert is visible to the ref before evaluation.
      queueMicrotask(evaluate)
      return true
    },
    [evaluate],
  )

  const deleteAlert = useCallback((id: string) => {
    updateAlerts((previous) => previous.filter((alert) => alert.id !== id))
    setToasts((previous) => previous.filter((toast) => toast.alertId !== id))
  }, [updateAlerts])

  const toggleAlert = useCallback(
    (id: string) => {
      let becameActive = false
      updateAlerts((previous) =>
        previous.map((alert) => {
          if (alert.id !== id) return alert
          const next = alert.status === 'active' ? 'inactive' : 'active'
          if (next === 'active') becameActive = true
          return { ...alert, status: next }
        }),
      )
      // Re-armed alerts re-enter the watch immediately (evaluated on the
      // next real price update — no extra polling).
      if (becameActive) queueMicrotask(evaluate)
    },
    [evaluate, updateAlerts],
  )

  const dismissToast = useCallback((alertId: string) => {
    setToasts((previous) => previous.filter((toast) => toast.alertId !== alertId))
  }, [])

  const value = useMemo(
    () => ({ alerts, toasts, createAlert, deleteAlert, toggleAlert, dismissToast }),
    [alerts, toasts, createAlert, deleteAlert, toggleAlert, dismissToast],
  )

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export function useAlerts(): AlertsContextValue {
  const context = useContext(AlertsContext)
  if (!context) throw new Error('useAlerts must be used within an AlertsProvider')
  return context
}
