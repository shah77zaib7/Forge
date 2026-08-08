import { Orbit } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ConfidenceMeter } from '@/features/oracle/components/confidence-meter'
import { coins } from '@/features/markets/data'
import { SectionTitle } from '@/features/markets/components/section-title'
import { usePreferences } from '@/store/preferences'
import { liquidityTimeframes, type LiquidityTimeframeId } from '@/features/workspace/data'

import { oracleBrief } from '../data'

/** Oracle's read of the lead market on the user's default window. */
export function OracleBrief() {
  const navigate = useNavigate()
  const { preferences } = usePreferences()
  const coin = coins.find((market) => market.id === 'bitcoin') ?? coins[0]
  const timeframe =
    liquidityTimeframes.find(
      (tf) => tf.id === (preferences.defaultAnalysisTimeframe as LiquidityTimeframeId),
    ) ?? liquidityTimeframes[0]
  const brief = oracleBrief(coin, timeframe)

  return (
    <GlassCard padding="md" className="flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle title="Oracle Brief" meta={brief.timeframe} />
        <Badge variant={brief.tone} size="sm">
          {brief.bias}
        </Badge>
      </div>

      <p className="mt-3.5 flex-1 text-[13px] leading-relaxed text-muted">{brief.observation}</p>

      <div className="mt-5 border-t border-border pt-4">
        <ConfidenceMeter value={brief.confidence} tone={brief.tone} className="w-full" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] tabular-nums text-faint">
            {coin.name} · {brief.windowReturn} window read
          </span>
          <Button size="sm" variant="secondary" onClick={() => navigate('/oracle')}>
            <Orbit size={13} strokeWidth={1.75} />
            Ask Oracle
          </Button>
        </div>
      </div>
    </GlassCard>
  )
}
