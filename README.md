# Forge

A premium crypto trading workspace. Calm, precise, liquid glass.

## Stack

- **React 19** + **TypeScript** (strict)
- **Vite 8**
- **Tailwind CSS v4** (CSS-first design tokens)
- **Framer Motion** (micro-interactions, page transitions)
- **React Router v7**
- **Lucide** icons
- **Inter Variable** (UI) + **JetBrains Mono** (data) via Fontsource

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
```

The app currently opens on the **design-system reference** (`/design-system`) — a living
showcase of the tokens and primitives. Product pages land next.

## Structure

```
src/
├── app/                 # App root, global layout, routes
│   ├── App.tsx
│   ├── router.tsx        # Route table + keyed page transitions
│   ├── app-shell.tsx     # Global layout: sidebar + top bar + main area
│   ├── sidebar.tsx       # Floating glass sidebar (collapse + mobile drawer)
│   ├── top-bar.tsx
│   ├── nav.ts            # Navigation config
│   ├── pages/            # Routed pages (placeholders today)
│   └── page-transition.tsx
├── components/
│   ├── brand.tsx         # Forge mark + wordmark
│   └── ui/               # Design-system primitives (Button, GlassCard, …)
├── design/
│   └── motion.ts         # Framer Motion tokens (easings, durations, variants)
├── features/
│   └── markets/          # The Markets workspace (types, data, hooks, components)
├── hooks/
│   └── use-media-query.ts
├── dev/
│   └── design-system.tsx # Design-system reference route
├── lib/
│   ├── cn.ts             # clsx + tailwind-merge
│   └── format.ts         # market-data number formatting
├── styles/
│   └── index.css         # Tailwind theme + tokens + glass utilities
└── main.tsx
```

Future product code should land in `src/features/` (markets, orders, positions, …) with each
feature owning its components, hooks and state. Cross-cutting UI goes in `components/ui/`.

## Design system

All tokens live in `src/styles/index.css` under `@theme inline` and are consumed as Tailwind
utilities — **never hardcode a color or radius in a component**.

| Token | Utilities |
| --- | --- |
| `background`, `surface-0…3`, `foreground`, `muted`, `faint` | `bg-surface-1`, `text-muted`, … |
| `tint` — neutral layer (white in dark, near-black in light) | `bg-tint/5`, `hover:bg-tint/6`, … |
| `positive`, `negative` | `text-positive`, `bg-positive/10`, … — market data only |
| `border`, `border-strong` | `border-border`, `border-border-strong` |
| `control/glass/panel/hero` radii | `rounded-control`, `rounded-panel`, … |
| `ambient`, `float`, `inset-top` shadows | `shadow-ambient`, `shadow-float`, … |
| `smooth`, `spring` easings | `ease-smooth` (CSS) · `ease.smooth` (Framer) |

Glass surfaces: `glass` and `glass-strong` utility classes, wrapped by the `GlassCard`
primitive. Framer Motion tokens live in `src/design/motion.ts`.

## Themes

Forge ships a complete **dark** (default) and **light** theme. Every color, shadow and glass
recipe is a runtime CSS variable defined on `:root` and overridden under `[data-theme='light']`
in `src/styles/index.css`. Components only consume tokens, so every future surface supports
both themes by construction.

- Toggle lives in the top bar (`ThemeToggle`) and is persisted to `localStorage`
  (`forge.theme`); first visit follows the system preference.
- A pre-paint script in `index.html` sets the theme before first render, so there is no flash.
- Switching enables a short-lived `theme-transitioning` class that glides all colors into place.
- `ThemeProvider` (`src/app/theme.tsx`) owns the state; `useTheme()` reads it anywhere.

### Conventions

- `cn()` for all class composition.
- Prices and percentages render in `font-mono tabular-nums`.
- Green/red reserved for market direction. Everything else is white-on-charcoal.
- Motion: `ease.smooth` for UI, `ease.spring` for overlays; durations from `duration`.
- Every route is wrapped in `PageTransition` for the shared enter/exit animation.

## Status

Foundations + global layout shell + the first real surface: the **Markets workspace** with
instant search, category filters, favorites, a two-pane desktop layout (list + selected-coin
preview) and a mobile workspace sheet. Other routes remain placeholders.
