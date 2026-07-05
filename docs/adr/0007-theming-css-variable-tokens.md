# Dark mode via CSS-variable design tokens

The app had a good start on theming — semantic color names (`surface`,
`text-muted`, `primary-light`, `status-*`) in `tailwind.config.ts` — but the
values were hardcoded light-mode hexes, and ~120 class usages bypassed the
tokens with raw palette colors (`border-black/10`, `bg-emerald-600`,
`bg-gray-100`, inline `#f0f0f0` gradients). Adding dark mode by sprinkling
`dark:` variants over every one of those would double the class noise and make
every future restyle a full-codebase sweep.

## Decisions

- **Tokens are CSS variables; components never name a raw color.**
  `app/globals.css` defines every color as an RGB triplet variable in two
  blocks: `:root` (light) and `.dark` (dark). `tailwind.config.ts` maps each
  token as `rgb(var(--c-x) / <alpha-value>)`, so all existing utilities —
  including opacity modifiers like `bg-primary/40` and `border-critical/25` —
  work unchanged in both themes. **Adding a theme or restyling = editing one
  CSS block.** No component changes, no `dark:` variants anywhere.
- **`darkMode: "class"`**, toggled as `.dark` on `<html>`. An inline script in
  `app/layout.tsx` applies the saved preference **before first paint** (no
  light flash); `<html>` has `suppressHydrationWarning` because that script
  legitimately mutates the class before React hydrates.
- **Preference is per-device, not per-account**: `localStorage["refill-theme"]`
  ∈ `light | system | dark` (default `system`). `components/ThemeToggle.tsx`
  (in the sidebar) owns the setting UI, persists it, and follows OS theme
  changes live while set to Auto. Theme is a device/eyes concern like OS dark
  mode itself, so it deliberately does not sync through Convex.
- **New tokens introduced during the sweep** so raw colors could die:
  - `border` (hairlines, was `black/5`–`/7`) and `border-strong` (input/card
    edges, was `black/10`–`/20`) — full rgba values, alpha baked in.
  - "black at N%" hovers/fills became `text`-token opacities (`bg-text/5`),
    which flip with the theme.
  - Restock's `emerald-*` accent → `primary`; its `amber-*` urgency → `low`.
  - `.img-placeholder` (checkerboard for missing product images) built from
    `--checker-a/b` variables, replacing inline hex gradients.
  - `--shadow-card` variable (shadows need to deepen in dark).
- **`color-scheme: light|dark`** is set per theme so native widgets (date
  pickers, scrollbars) match.
- **Deliberately not tokens**: modal scrims (`bg-black/40` works over both
  themes), `text-white` on solid primary buttons, person avatar gradients
  (data colors, not surfaces), and the canvas `#fff` fill in ImageUploader
  (image data, not UI).

## Rules for future code

Use token utilities only: `bg-surface`, `bg-surface-alt`, `text-text`,
`text-text-muted`, `border-border`, `border-border-strong`, `bg-primary`,
status tokens. If a design needs a color that doesn't exist yet, add a
variable to *both* blocks in `globals.css` and a mapping line in
`tailwind.config.ts` — never write `gray-100`, `black/10`, `emerald-600`, or a
hex literal in a component.
