import { History, Trash2 } from 'lucide-react'

import { useCoins } from '@/store/market-data'

import { formatSavedDate } from '../data'
import type { SavedAnalysis } from '../types'
import { cardKindIcon } from './card-icon'
import { SheetShell } from './sheet-shell'

interface HistorySheetProps {
  open: boolean
  onClose: () => void
  items: SavedAnalysis[]
  /** Reopen a saved analysis — returns it to the conversation. */
  onOpen: (item: SavedAnalysis) => void
  onDelete: (id: string) => void
}

/**
 * Saved Oracle analyses — a quiet library of past reads. Bottom sheet on
 * mobile, right-side panel on desktop. Stored locally on this device.
 */
export function HistorySheet({ open, onClose, items, onOpen, onDelete }: HistorySheetProps) {
  const coins = useCoins()
  return (
    <SheetShell
      open={open}
      onClose={onClose}
      label="Oracle history"
      title={
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">Oracle History</p>
          <p className="mt-0.5 text-[11px] text-faint">
            {items.length === 0 ? 'No saved analyses yet' : `${items.length} saved ${items.length === 1 ? 'analysis' : 'analyses'}`}
          </p>
        </div>
      }
    >
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-glass border border-border bg-tint/[0.05]">
            <History size={18} strokeWidth={1.75} className="text-faint" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">Nothing saved yet</p>
          <p className="mt-1 max-w-[17rem] text-xs leading-relaxed text-faint">
            Tap <span className="text-muted">Save analysis</span> on any Oracle read and it will live here on this
            device.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = cardKindIcon(item.card.kind)
            const coin = coins.find((market) => market.id === item.coinId)
            return (
              <div
                key={item.id}
                className="group flex items-center gap-2 rounded-panel border border-border bg-tint/[0.03] p-3 transition-colors duration-200 hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  aria-label={`Reopen ${item.prompt}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-tint/[0.05]">
                    <Icon size={14} strokeWidth={1.75} className="text-muted" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {item.prompt}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">
                      {coin ? `${coin.name} · ${coin.ticker}` : item.coinId} · {item.timeframeId} ·{' '}
                      {formatSavedDate(item.createdAt)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.prompt}`}
                  title="Delete"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors duration-200 hover:bg-negative/10 hover:text-negative active:scale-90"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            )
          })}
          <p className="pt-3 text-center text-[10px] text-faint">Saved on this device · no account needed</p>
        </div>
      )}
    </SheetShell>
  )
}
