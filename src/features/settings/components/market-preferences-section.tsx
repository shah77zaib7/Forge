import { SegmentedControl } from '@/components/ui/segmented-control'
import { SelectControl } from '@/components/ui/select-control'
import type { LiquidityTimeframeId } from '@/features/workspace/data'
import { usePreferences, currencyOptions, type CurrencyId } from '@/store/preferences'

import { SectionCard, SettingRow } from './setting-row'

export const timeframeOptions = [
  { value: '1M', label: '1 minute' },
  { value: '5M', label: '5 minutes' },
  { value: '15M', label: '15 minutes' },
  { value: '1H', label: '1 hour' },
  { value: '4H', label: '4 hours' },
  { value: '1D', label: '1 day' },
  { value: '1W', label: '1 week' },
]

const modeOptions = [
  { value: 'trader', label: 'Trader' },
  { value: 'teacher', label: 'Teacher' },
]

/** Market preferences — default window, currency and analyst persona. */
export function MarketPreferencesSection() {
  const { preferences, updatePreferences } = usePreferences()

  return (
    <SectionCard overline="Market" title="Market Preferences">
      <SettingRow
        label="Default timeframe"
        description="The window market surfaces open on."
        control={
          <SelectControl
            value={preferences.defaultTimeframe}
            onChange={(value) => updatePreferences({ defaultTimeframe: value as LiquidityTimeframeId })}
            options={timeframeOptions}
            aria-label="Default timeframe"
            className="w-40"
          />
        }
      />
      <SettingRow
        label="Default currency"
        description="How prices and balances are quoted."
        control={
          <SelectControl
            value={preferences.currency}
            onChange={(value) => updatePreferences({ currency: value as CurrencyId })}
            options={currencyOptions}
            aria-label="Default currency"
            className="w-44"
          />
        }
      />
      <SettingRow
        label="Oracle mode"
        description="The analyst persona Oracle opens with."
        control={
          <SegmentedControl
            size="sm"
            options={modeOptions}
            value={preferences.defaultOracleMode}
            onChange={(value) => updatePreferences({ defaultOracleMode: value as 'trader' | 'teacher' })}
            aria-label="Oracle mode"
          />
        }
        last
      />
    </SectionCard>
  )
}
