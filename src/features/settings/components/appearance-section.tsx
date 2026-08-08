import { SegmentedControl } from '@/components/ui/segmented-control'
import { useTheme, type ThemeMode } from '@/app/theme'

import { SectionCard, SettingRow } from './setting-row'

const themeOptions = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** Appearance — the System / Light / Dark theme preference. */
export function AppearanceSection() {
  const { themeMode, setThemeMode } = useTheme()

  return (
    <SectionCard overline="General" title="Appearance">
      <SettingRow
        label="Theme"
        description="Follows your device by default; pick a fixed theme to override it."
        control={
          <SegmentedControl
            size="sm"
            options={themeOptions}
            value={themeMode}
            onChange={(value) => setThemeMode(value as ThemeMode)}
            aria-label="Theme"
          />
        }
        last
      />
    </SectionCard>
  )
}
