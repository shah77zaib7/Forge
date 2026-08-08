import { SegmentedControl } from '@/components/ui/segmented-control'
import { SelectControl } from '@/components/ui/select-control'
import type { LiquidityTimeframeId } from '@/features/workspace/data'
import { responseDetailOptions, usePreferences, type ResponseDetail } from '@/store/preferences'

import { SectionCard, SettingRow } from './setting-row'
import { timeframeOptions } from './market-preferences-section'

/** Oracle preferences — how new conversations are framed. */
export function OraclePreferencesSection() {
  const { preferences, updatePreferences } = usePreferences()

  return (
    <SectionCard overline="Oracle" title="Oracle Preferences">
      <SettingRow
        label="Default analysis timeframe"
        description="The window Oracle reads when a conversation starts."
        control={
          <SelectControl
            value={preferences.defaultAnalysisTimeframe}
            onChange={(value) =>
              updatePreferences({ defaultAnalysisTimeframe: value as LiquidityTimeframeId })
            }
            options={timeframeOptions}
            aria-label="Default analysis timeframe"
            className="w-40"
          />
        }
      />
      <SettingRow
        label="Response detail"
        description="How verbose Oracle's reads should be."
        control={
          <SegmentedControl
            size="sm"
            options={responseDetailOptions}
            value={preferences.responseDetail}
            onChange={(value) => updatePreferences({ responseDetail: value as ResponseDetail })}
            aria-label="Response detail"
          />
        }
        last
      />
    </SectionCard>
  )
}
