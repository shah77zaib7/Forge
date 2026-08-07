import { useEffect, useState } from 'react'

import { GlassCard } from '@/components/ui/glass-card'
import type { Coin } from '@/features/markets/types'

import { SectionHeading } from './section-heading'

const storageKey = (id: string) => `forge.notes.${id}`

function load(id: string): string {
  try {
    return localStorage.getItem(storageKey(id)) ?? ''
  } catch {
    return ''
  }
}

/** A private scratchpad for market observations — saved on this device. */
export function NotesCard({ coin }: { coin: Coin }) {
  const [value, setValue] = useState(() => load(coin.id))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(coin.id), value)
    } catch {
      /* storage unavailable — ignore */
    }
  }, [coin.id, value])

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0

  return (
    <section>
      <SectionHeading
        eyebrow="07 — Notes"
        title="Notes"
        meta={<span className="font-mono text-[11px] text-faint">{wordCount} words</span>}
      />
      <GlassCard className="mt-4">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Write your market observations…"
          rows={6}
          className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-faint"
        />
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
          <span className="text-[11px] text-faint">Private — stored on this device</span>
          {value && (
            <span className="font-mono text-[11px] text-faint">{value.length} chars</span>
          )}
        </div>
      </GlassCard>
    </section>
  )
}
