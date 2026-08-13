import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { SelectControl } from '@/components/ui/select-control'
import { aiProviders, connectedServices, marketDataProviders } from '../data'

import { SectionCard, SettingRow } from './setting-row'

/**
 * Masked credentials row — secrets never render, only a secure-looking
 * placeholder. Real env/config integration slots in later without
 * changing the surface.
 */
function MaskedField({ label, masked }: { label: string; masked: string }) {
  return (
    <div className="flex h-9 min-w-44 items-center gap-2 rounded-control border border-border bg-tint/[0.04] px-3.5">
      <KeyRound size={12} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden />
      <span className="font-mono text-xs text-faint">{masked}</span>
      <span className="ml-1 text-[10px] uppercase tracking-[0.12em] text-faint">{label}</span>
    </div>
  )
}

/** Account & API — profile, provider configuration and connected services. */
export function AccountSection() {
  // V1 placeholder selections — the mock feed stays active until real
  // provider/config integration lands; no claim of live connectivity.
  const [aiProvider, setAiProvider] = useState('gemini')
  const [marketProvider, setMarketProvider] = useState('mock')

  return (
    <SectionCard overline="Account & API" title="Connections">
      <SettingRow
        label="AI provider"
        description="The model Oracle uses for reads and lessons. V1 demo selection — real providers connect later."
        control={
          <SelectControl
            value={aiProvider}
            onChange={setAiProvider}
            options={aiProviders}
            aria-label="AI provider"
            className="w-44"
          />
        }
      />
      <SettingRow
        label="AI API key"
        description="Configured in environment config — never stored in the UI."
        control={<MaskedField label="set" masked="sk-••••••••••••••••" />}
      />
      <SettingRow
        label="Market-data API"
        description="The feed behind prices, depth and liquidity. V1 runs the mock feed."
        control={
          <SelectControl
            value={marketProvider}
            onChange={setMarketProvider}
            options={marketDataProviders}
            aria-label="Market data provider"
            className="w-44"
          />
        }
      />
      <SettingRow
        label="Market-data key"
        description="Configured in environment config — never stored in the UI."
        control={<MaskedField label="set" masked="live-••••••••••••••••" />}
      />
      {connectedServices.map((service, index) => (
        <SettingRow
          key={service.id}
          label={service.name}
          description={service.description}
          control={
            <Badge variant={service.connected ? 'positive' : 'neutral'} dot size="sm">
              {service.connected ? 'Connected' : 'Not connected'}
            </Badge>
          }
          last={index === connectedServices.length - 1}
        />
      ))}
    </SectionCard>
  )
}
