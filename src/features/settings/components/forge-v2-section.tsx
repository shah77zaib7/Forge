import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

import { SelectControl, type SelectOption } from '@/components/ui/select-control'
import { useForgeV2 } from '@/features/markets/services/forge-v2/store'
import { Toggle } from '@/components/ui/toggle'
import { cn } from '@/lib/cn'

import { SectionCard } from './setting-row'

const timeframeOptions: SelectOption[] = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
  { value: '1w', label: '1w' },
]

interface ParamRowProps {
  label: string
  description?: string
  value: number | boolean
  step?: number
  onNumberChange?: (value: number) => void
  onBoolChange?: (value: boolean) => void
  format?: (value: number) => string
}

/** One tunable parameter — a native number input or toggle, live-bound. */
function ParamRow({ label, description, value, step = 1, onNumberChange, onBoolChange, format }: ParamRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground/90">{label}</p>
        {description && <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{description}</p>}
      </div>
      {typeof value === 'boolean' && onBoolChange ? (
        <Toggle checked={value} onChange={onBoolChange} aria-label={label} className="shrink-0" />
      ) : (
        <label className="flex shrink-0 items-center gap-1.5">
          <input
            type="number"
            value={value as number}
            step={step}
            onChange={(event) => onNumberChange?.(Number(event.target.value))}
            aria-label={label}
            className={cn(
              'h-8 w-24 rounded-control border border-border bg-tint/[0.04] px-2.5 text-right font-mono text-xs tabular-nums text-foreground outline-none',
              'hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-tint/30',
            )}
          />
          {format && <span className="w-10 text-[10px] text-faint">{format(value as number)}</span>}
        </label>
      )}
    </div>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-4">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">{title}</p>
      <div className="rounded-xl border border-border/70 bg-tint/[0.02] px-3 py-1">{children}</div>
    </div>
  )
}

/**
 * Forge V2 — the LIVE configuration of the deterministic Liquidity Model.
 * Every control here writes straight into the shared V2 config store, which
 * the Workspace Setup card and Oracle payload both read. Changing a value
 * re-runs the analysis immediately — no restart, no separate panel.
 */
export function ForgeV2Section() {
  const { config, updateConfig, resetConfig } = useForgeV2()
  const [dirty, setDirty] = useState(false)

  const patch = (
    group: 'liquidity' | 'sweep' | 'displacement' | 'pullback' | 'confirmation' | 'context' | 'scoring',
    partial: Record<string, number | boolean | string>,
  ) => {
    setDirty(true)
    updateConfig({ [group]: partial } as never)
  }

  return (
    <SectionCard overline="Forge V2" title="Liquidity Model — Configurable Parameters">
      <p className="mt-1 text-xs leading-relaxed text-muted">
        One centralized configuration drives the deterministic engine everywhere. Every value below
        is consumed by the analysis — change a weight or threshold and the next setup read reflects it.
      </p>

      <Group title="Liquidity">
        <ParamRow
          label="Equal-high weight"
          description="Extra importance for equal-high pools vs ordinary swings."
          value={config.liquidity.equalHighWeight}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onNumberChange={(v) => patch('liquidity', { equalHighWeight: v })}
        />
        <ParamRow
          label="Equal-low weight"
          description="Extra importance for equal-low pools vs ordinary swings."
          value={config.liquidity.equalLowWeight}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onNumberChange={(v) => patch('liquidity', { equalLowWeight: v })}
        />
        <ParamRow
          label="Swing weight"
          description="Baseline weight for ordinary swing highs/lows."
          value={config.liquidity.swingWeight}
          step={0.05}
          format={(v) => `×${v.toFixed(2)}`}
          onNumberChange={(v) => patch('liquidity', { swingWeight: v })}
        />
        <ParamRow
          label="Merge tolerance (ATR)"
          description="How close levels must be to merge into an equal/cluster pool."
          value={config.liquidity.toleranceAtp}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onNumberChange={(v) => patch('liquidity', { toleranceAtp: v })}
        />
        <ParamRow
          label="Max candidates / side"
          value={config.liquidity.maxCandidatesPerSide}
          onNumberChange={(v) => patch('liquidity', { maxCandidatesPerSide: v })}
        />
      </Group>

      <Group title="Sweep">
        <ParamRow
          label="Min penetration (ATR)"
          description="Trade-through must cross this far past the level to count."
          value={config.sweep.minimumPenetrationAtp}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onNumberChange={(v) => patch('sweep', { minimumPenetrationAtp: v })}
        />
        <ParamRow
          label="Max penetration (ATR)"
          description="Beyond this the sweep reads as over-extended — weaker."
          value={config.sweep.maximumPenetrationAtp}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onNumberChange={(v) => patch('sweep', { maximumPenetrationAtp: v })}
        />
        <ParamRow
          label="Wick-only qualifies"
          description="A wick through the level counts as a sweep even without a body close."
          value={config.sweep.wickOnlyQualifies}
          onBoolChange={(v) => patch('sweep', { wickOnlyQualifies: v })}
        />
        <ParamRow
          label="Close-back-through credit"
          description="Price must close back through the level for the reclaim credit."
          value={config.sweep.closeBackThrough}
          onBoolChange={(v) => patch('sweep', { closeBackThrough: v })}
        />
        <ParamRow
          label="Recent window (candles)"
          description="A sweep counts as actionable within this many candles."
          value={config.sweep.recentCandles}
          onNumberChange={(v) => patch('sweep', { recentCandles: v })}
        />
      </Group>

      <Group title="Displacement">
        <ParamRow
          label="Min net move (ATR)"
          description="A leg must move at least this many ATRs net."
          value={config.displacement.minNetMoveAtp}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onNumberChange={(v) => patch('displacement', { minNetMoveAtp: v })}
        />
        <ParamRow
          label="Range expansion (×ATR)"
          value={config.displacement.minRangeExpansion}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onNumberChange={(v) => patch('displacement', { minRangeExpansion: v })}
        />
        <ParamRow
          label="Body ratio"
          value={config.displacement.minBodyRatio}
          step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onNumberChange={(v) => patch('displacement', { minBodyRatio: v })}
        />
        <ParamRow
          label="Consecutive candles"
          value={config.displacement.consecutiveCandles}
          onNumberChange={(v) => patch('displacement', { consecutiveCandles: v })}
        />
        <ParamRow
          label="Time window (candles)"
          value={config.displacement.timeWindow}
          onNumberChange={(v) => patch('displacement', { timeWindow: v })}
        />
      </Group>

      <Group title="Pullback">
        <ParamRow
          label="Min retracement"
          value={config.pullback.minimumRetracement}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onNumberChange={(v) => patch('pullback', { minimumRetracement: v })}
        />
        <ParamRow
          label="Max retracement"
          description="Beyond this the pullback is over-retraced — weakens the setup."
          value={config.pullback.maximumRetracement}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onNumberChange={(v) => patch('pullback', { maximumRetracement: v })}
        />
        <ParamRow
          label="Max candles for pullback"
          value={config.pullback.maximumCandles}
          onNumberChange={(v) => patch('pullback', { maximumCandles: v })}
        />
        <ParamRow
          label="Must stay in zone"
          description="Price must remain inside the displacement range for the setup."
          value={config.pullback.mustStayInZone}
          onBoolChange={(v) => patch('pullback', { mustStayInZone: v })}
        />
      </Group>

      <Group title="Confirmation">
        <div className="flex items-center justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground/90">Confirmation timeframe</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
              Primary execution confirmation timeframe (1m by default) — independent of the
              liquidity window.
            </p>
          </div>
          <SelectControl
            value={config.confirmation.confirmationTimeframe}
            onChange={(value) => {
              setDirty(true)
              updateConfig({ confirmation: { confirmationTimeframe: value } })
            }}
            options={timeframeOptions}
            aria-label="Confirmation timeframe"
            className="w-24 shrink-0"
          />
        </div>
        <ParamRow
          label="Engulfing weight"
          value={config.confirmation.engulfingWeight}
          step={0.1}
          format={(v) => `×${v.toFixed(1)}`}
          onNumberChange={(v) => patch('confirmation', { engulfingWeight: v })}
        />
        <ParamRow
          label="Rejection weight"
          value={config.confirmation.rejectionWeight}
          step={0.1}
          format={(v) => `×${v.toFixed(1)}`}
          onNumberChange={(v) => patch('confirmation', { rejectionWeight: v })}
        />
        <ParamRow
          label="Min body (ATR)"
          value={config.confirmation.minBodyAtp}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onNumberChange={(v) => patch('confirmation', { minBodyAtp: v })}
        />
        <ParamRow
          label="Rejection wick ratio"
          value={config.confirmation.rejectionWickRatio}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onNumberChange={(v) => patch('confirmation', { rejectionWickRatio: v })}
        />
        <ParamRow
          label="Check candles"
          value={config.confirmation.checkCandles}
          onNumberChange={(v) => patch('confirmation', { checkCandles: v })}
        />
      </Group>

      <Group title="Context & Scoring">
        <ParamRow
          label="Structure contribution"
          description="Points when higher-timeframe structure aligns with the setup."
          value={config.context.structureContribution}
          onNumberChange={(v) => patch('context', { structureContribution: v })}
        />
        <ParamRow
          label="Opposing liquidity bonus"
          description="Points when there is room to the opposing liquidity."
          value={config.context.opposingLiquidityBonus}
          onNumberChange={(v) => patch('context', { opposingLiquidityBonus: v })}
        />
        <ParamRow
          label="Volatility penalty"
          value={config.context.volatilityPenalty}
          onNumberChange={(v) => patch('context', { volatilityPenalty: v })}
        />
        <ParamRow
          label="Strong threshold"
          value={config.scoring.strongThreshold}
          onNumberChange={(v) => patch('scoring', { strongThreshold: v })}
        />
        <ParamRow
          label="Moderate threshold"
          value={config.scoring.moderateThreshold}
          onNumberChange={(v) => patch('scoring', { moderateThreshold: v })}
        />
        <ParamRow
          label="No-confirmation cap"
          value={config.scoring.noConfirmationCap}
          onNumberChange={(v) => patch('scoring', { noConfirmationCap: v })}
        />
        <ParamRow
          label="Confluence bonus"
          value={config.scoring.confluenceBonus}
          onNumberChange={(v) => patch('scoring', { confluenceBonus: v })}
        />
      </Group>

      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
          Config v{config.version}
          {dirty ? ' · edited' : ''}
        </p>
        <button
          type="button"
          onClick={() => {
            resetConfig()
            setDirty(false)
          }}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-medium text-muted transition-colors duration-200 hover:bg-tint/[0.05] hover:text-foreground"
        >
          <RotateCcw size={12} strokeWidth={2} />
          Reset to defaults
        </button>
      </div>
    </SectionCard>
  )
}
