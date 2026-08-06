import { motion, type Easing, type Variants } from 'framer-motion'
import { ArrowUpRight, Bitcoin } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control'
import { Sparkline } from '@/components/ui/sparkline'
import { fadeUp } from '@/design/motion'
import { cn } from '@/lib/cn'
import { formatChange, formatCompact, formatPrice } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Shared motion variants                                              */
/* ------------------------------------------------------------------ */

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/* ------------------------------------------------------------------ */
/* Local building blocks for this reference page                       */
/* ------------------------------------------------------------------ */

function Section({
  overline,
  title,
  description,
  children,
  last = false,
}: {
  overline: string
  title: string
  description?: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <section className={cn('border-t border-border pt-14', !last && 'pb-24')}>
      <div className="mb-10 max-w-2xl">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-faint">{overline}</p>
        <h2 className="mb-3 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function useCssVar(name: string): string {
  const [value, setValue] = useState('')

  useEffect(() => {
    const read = () =>
      setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim())
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [name])

  return value
}

function Swatch({ name, className }: { name: string; className?: string }) {
  const value = useCssVar(`--forge-${name}`)
  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn('h-16 rounded-glass border border-border shadow-inset-top', className)} />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <span className="font-mono text-[11px] text-faint">{value || name}</span>
      </div>
    </div>
  )
}

function TypeRow({ sample, meta, className }: { sample: string; meta: string; className?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-border py-5">
      <span className={cn('text-foreground', className)}>{sample}</span>
      <span className="shrink-0 font-mono text-[11px] text-faint">{meta}</span>
    </div>
  )
}

function ShapeSample({ name, className }: { name: string; className?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn('h-20 border border-border bg-tint/[0.04]', className)} />
      <span className="font-mono text-[11px] text-faint">{name}</span>
    </div>
  )
}

const easingOptions: { key: 'smooth' | 'spring' | 'linear'; label: string; value: Easing }[] = [
  { key: 'smooth', label: 'Smooth', value: [0.32, 0.72, 0, 1] },
  { key: 'spring', label: 'Spring', value: [0.16, 1, 0.3, 1] },
  { key: 'linear', label: 'Linear', value: 'linear' },
]

function describeEasing(value: Easing): string {
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function EaseDemo() {
  const [active, setActive] = useState(easingOptions[0])
  const [run, setRun] = useState(0)

  return (
    <GlassCard padding="lg" className="max-w-xl">
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {easingOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              setActive(option)
              setRun((r) => r + 1)
            }}
            className={cn(
              'rounded-full border px-4 py-1.5 text-xs font-medium transition-colors duration-200',
              active.key === option.key
                ? 'border-border-strong bg-tint/[0.1] text-foreground'
                : 'border-border bg-tint/[0.03] text-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative h-1 rounded-full bg-tint/[0.07]">
        <motion.span
          key={run}
          className="absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_24px_color-mix(in_oklab,var(--forge-foreground)_35%,transparent)]"
          initial={{ left: '0%' }}
          animate={{ left: '100%' }}
          transition={{ duration: 1.1, ease: active.value }}
        />
      </div>

      <p className="mt-7 font-mono text-xs text-faint">
        --ease-{active.key}: {describeEasing(active.value)}
      </p>
    </GlassCard>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="font-mono text-sm tabular-nums text-foreground">{value}</span>
    </div>
  )
}

type Timeframe = '1H' | '4H' | '1D' | '1W'

const timeframeOptions: SegmentedOption<Timeframe>[] = [
  { value: '1H', label: '1H' },
  { value: '4H', label: '4H' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
]

const sparkData = [
  52, 54, 53, 57, 56, 60, 58, 62, 65, 63, 66, 64, 68, 71, 69, 72, 75, 73, 76, 78, 80, 79, 82, 84,
]

function MarketCard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')

  return (
    <GlassCard variant="strong" padding="lg" className="max-w-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-control border border-border bg-tint/[0.05]">
            <Bitcoin size={18} strokeWidth={1.75} className="text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Bitcoin <span className="text-faint">/ USDT</span>
            </p>
            <p className="font-mono text-[11px] text-faint">binance · spot</p>
          </div>
        </div>
        <Badge variant="neutral" dot>
          Live
        </Badge>
      </div>

      <div className="mt-8 flex items-end justify-between gap-8">
        <div>
          <p className="font-mono text-4xl font-medium tabular-nums tracking-tight">
            67,431.25
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="positive" dot>
              {formatChange(2.34)}
            </Badge>
            <span className="text-xs text-faint">24h</span>
          </div>
        </div>
        <Sparkline data={sparkData} width={132} height={40} tone="positive" />
      </div>

      <SegmentedControl
        className="mt-8"
        size="sm"
        options={timeframeOptions}
        value={timeframe}
        onChange={setTimeframe}
      />

      <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6">
        <Stat label="24h High" value={formatPrice(68420.1)} />
        <Stat label="24h Low" value={formatPrice(64112.8)} />
        <Stat label="24h Volume" value={formatCompact(28_400_000_000)} />
      </div>
    </GlassCard>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DesignSystem() {
  const [demoTimeframe, setDemoTimeframe] = useState<Timeframe>('1D')

  return (
    <div className="mx-auto max-w-5xl px-8 pb-32 pt-16 sm:px-12 sm:pt-20">
      {/* Masthead */}
      <motion.div variants={container} initial="hidden" animate="visible">
        <motion.div variants={fadeUp} className="mt-4 max-w-2xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-faint">
            Foundations
          </p>
          <h1 className="text-5xl font-semibold leading-[1.04] tracking-tight text-foreground sm:text-6xl">
            A calm, precise workspace for serious markets.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            Liquid-glass surfaces, quiet typography and motion that stays out of the way. Near-black
            by default, white as the accent — green and red appear only where the market lives.
          </p>
        </motion.div>
      </motion.div>

      {/* Color */}
      <Section
        overline="Color"
        title="Monochrome, with white as the accent."
        description="A ramp of five surfaces builds depth without color. Green and red are reserved exclusively for market direction — nothing else in the product earns them. Toggle the theme in the top bar to see both palettes live."
      >
        <div className="grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-6">
          <Swatch name="background" className="bg-background" />
          <Swatch name="surface-0" className="bg-surface-0" />
          <Swatch name="surface-1" className="bg-surface-1" />
          <Swatch name="surface-2" className="bg-surface-2" />
          <Swatch name="surface-3" className="bg-surface-3" />
          <Swatch name="foreground" className="bg-foreground" />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="faint" className="bg-faint" />
          <Swatch name="tint" className="bg-tint/10" />
          <Swatch name="line" className="border-2 border-border" />
          <Swatch name="positive" className="bg-positive" />
          <Swatch name="negative" className="bg-negative" />
        </div>
      </Section>

      {/* Typography */}
      <Section
        overline="Typography"
        title="Inter, set quietly. JetBrains Mono for numbers."
        description="UI type is Inter Variable; every number that can move — prices, volumes, percentages — is JetBrains Mono with tabular figures so digits never shift while updating."
      >
        <TypeRow
          sample="A workspace that stays out of the way."
          meta="Display · 56/1.04 · -0.03em"
          className="text-5xl font-semibold tracking-tight"
        />
        <TypeRow
          sample="The quiet luxury of numbers."
          meta="Heading · 30/1.15 · -0.02em"
          className="text-3xl font-semibold tracking-tight"
        />
        <TypeRow
          sample="Precision, without the noise."
          meta="Title · 20/1.25 · -0.01em"
          className="text-xl font-medium tracking-tight"
        />
        <TypeRow sample="Body — readable, calm, precise." meta="Body · 14/1.6" className="text-sm text-muted" />
        <TypeRow sample="67,431.25  +2.34%" meta="Data · Mono · 14 · tabular" className="font-mono text-sm tabular-nums" />
        <TypeRow sample="Label" meta="Overline · 11 · +0.18em" className="text-[11px] font-medium uppercase tracking-[0.18em] text-faint" />
      </Section>

      {/* Shape */}
      <Section
        overline="Shape"
        title="Rounded, softly."
        description="A tight radius ladder from controls to hero surfaces. Nothing sharp, nothing squishy."
      >
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <ShapeSample name="control · 14" className="rounded-control" />
          <ShapeSample name="glass · 24" className="rounded-glass" />
          <ShapeSample name="panel · 28" className="rounded-panel" />
          <ShapeSample name="hero · 32" className="rounded-hero" />
        </div>
      </Section>

      {/* Motion */}
      <Section
        overline="Motion"
        title="Fast in, calm out."
        description="Two signature curves cover the whole product. Click a curve to feel it — the marker always covers the same distance in the same time."
      >
        <EaseDemo />
      </Section>

      {/* Glass surfaces */}
      <Section
        overline="Surfaces"
        title="Liquid glass."
        description="Every surface shares the same recipe: a 1px hairline, a top-edge highlight and a soft backdrop blur. Three densities for three levels of emphasis."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <GlassCard>
            <p className="text-sm font-medium text-foreground">Glass</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              The standard surface — cards, panels, settings.
            </p>
          </GlassCard>
          <GlassCard variant="strong">
            <p className="text-sm font-medium text-foreground">Strong</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Elevated moments — the watchlist hero, the order ticket.
            </p>
          </GlassCard>
          <GlassCard variant="inset">
            <p className="text-sm font-medium text-foreground">Inset</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Recessed wells — input fields, code, quiet zones.
            </p>
          </GlassCard>
        </div>
      </Section>

      {/* Components */}
      <Section
        overline="Components"
        title="Primitives, not pages."
        description="A small set of composable primitives. Each one owns its hover, focus and disabled states so product screens stay consistent by construction."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button disabled>Disabled</Button>
          <Button>
            Trade
            <ArrowUpRight size={15} strokeWidth={2} />
          </Button>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Badge variant="neutral" dot>
            Idle
          </Badge>
          <Badge variant="positive" dot>
            +2.34%
          </Badge>
          <Badge variant="negative" dot>
            -1.08%
          </Badge>
          <Badge variant="neutral">Spot · 24h</Badge>
        </div>

        <div className="mt-10">
          <SegmentedControl
            size="sm"
            options={timeframeOptions}
            value={demoTimeframe}
            onChange={setDemoTimeframe}
          />
        </div>
      </Section>

      {/* Composition */}
      <Section
        overline="Composition"
        title="The language, together."
        description="A single surface demonstrating how the tokens and primitives compose — the template for every market card in the product."
        last
      >
        <MarketCard />
      </Section>

      <footer className="mt-24 border-t border-border pt-8">
        <p className="text-xs leading-relaxed text-faint">
          Forge · Foundations only. Built on React, Tailwind CSS v4 and Framer Motion. Product
          surfaces land next.
        </p>
      </footer>
    </div>
  )
}
