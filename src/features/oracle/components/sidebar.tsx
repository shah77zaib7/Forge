import type { Coin } from '@/features/markets/types'
import type { LiquidityTimeframeId } from '@/features/workspace/data'

import type { MarketHealth } from '../data'
import { ContextPanel } from './context-panel'

interface OracleSidebarProps {
  coin: Coin
  timeframeId: LiquidityTimeframeId
  onTimeframeChange: (id: LiquidityTimeframeId) => void
  health: MarketHealth
}

/** The sticky right rail — live context, hidden below desktop width. */
export function OracleSidebar(props: OracleSidebarProps) {
  return (
    <aside aria-label="Oracle context" className="hidden lg:block">
      <div className="sticky top-24">
        <ContextPanel {...props} />
      </div>
    </aside>
  )
}
