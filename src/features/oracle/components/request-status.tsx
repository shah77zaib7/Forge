import { motion } from 'framer-motion'
import { Activity, XCircle } from 'lucide-react'

import type { LastRequestInfo } from '@/features/ai/types'
import { cn } from '@/lib/cn'

/* ------------------------------------------------------------------ */
/* Last-request status — a quiet key-free line above the composer      */
/* ------------------------------------------------------------------ */

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.max(1, Math.round(ms))}ms`
}

function formatCost(usd: number | null): string | null {
  if (usd === null) return null
  if (usd >= 0.01) return `~$${usd.toFixed(3)}`
  return `~$${usd.toFixed(4)}`
}

/** One quiet line with the last request's model, provider, status,
 *  latency and estimated cost — the key-free confirmation that a real
 *  server model answered (or failed) instead of silently falling back. */
export function RequestStatusStrip({ info }: { info: LastRequestInfo | null }) {
  if (!info) return null

  const ok = info.status === 'ok'
  const cost = formatCost(info.estimatedCostUsd)
  const tokens =
    info.promptTokens !== null && info.completionTokens !== null
      ? `${info.promptTokens} in · ${info.completionTokens} out`
      : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center justify-center gap-2 px-1 pb-2"
    >
      <span className="flex items-center gap-1.5 rounded-full border border-border bg-tint/[0.03] px-2.5 py-0.5 text-[10px] font-medium tabular-nums text-faint">
        <Activity size={9} strokeWidth={2} className="text-faint" />
        Last request · {info.modelLabel} · {info.provider} ·{' '}
        <span
          className={cn(
            'inline-flex items-center gap-1 font-semibold',
            ok ? 'text-positive' : 'text-negative',
          )}
        >
          {ok ? (
            <>
              <span className="size-1.5 rounded-full bg-positive" aria-hidden />
              ok
            </>
          ) : (
            <>
              <XCircle size={9} strokeWidth={2} aria-hidden />
              {info.code ?? 'error'}
            </>
          )}
        </span>{' '}
        · {formatLatency(info.latencyMs)}
        {cost && <> · {cost}</>}
        {tokens && (
          <span className="text-faint/60" title={`Tokens — ${tokens}`}>
            {' '}
            · {tokens}
          </span>
        )}
      </span>
    </motion.div>
  )
}
