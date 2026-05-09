# empixel-builder — Breakpoint System

## Role
Allows editors to preview and style blocks at different screen widths. Per-breakpoint style overrides are stored separately from desktop styles and rendered as CSS media queries on the frontend.

## Files
- `src/types.ts` — `BreakpointId`, `BreakpointDef`, `BreakpointsConfig`, `BREAKPOINT_DEFS`, `DEFAULT_BREAKPOINTS_CONFIG`
- `src/admin/components/BreakpointSwitcher.tsx` — Topbar icon toggle
- `src/admin/components/BreakpointIcons.tsx` — SVG icons per breakpoint
- `src/admin/builder/Builder.tsx` — State + API fetch + canvas resize logic
- `src/admin/RightPanel.tsx` — Per-breakpoint style write logic
- `src/plugin.ts` — `breakpoints` route (GET/POST)

## Breakpoint Definitions

```ts
export type BreakpointId =
  | "desktop"
  | "laptop"
  | "tablet-landscape"
  | "tablet-portrait"
  | "mobile-landscape"
  | "mobile-portrait";

export const BREAKPOINT_DEFS: BreakpointDef[] = [
  { id: "desktop",          label: "Desktop",          defaultPx: null, removable: false },
  { id: "laptop",           label: "Laptop",           defaultPx: 1440, removable: true  },
  { id: "tablet-landscape", label: "Tablet Landscape", defaultPx: 1240, removable: true  },
  { id: "tablet-portrait",  label: "Tablet Portrait",  defaultPx: 992,  removable: false },
  { id: "mobile-landscape", label: "Mobile Landscape", defaultPx: 767,  removable: true  },
  { id: "mobile-portrait",  label: "Mobile Portrait",  defaultPx: 575,  removable: false },
];
```

`defaultPx: null` = Desktop (full width, no constraint).
Non-removable breakpoints (`desktop`, `tablet-portrait`, `mobile-portrait`) cannot be disabled and are always forced into the saved config by the backend.

## BreakpointsConfig

```ts
interface BreakpointsConfig {
  enabled: BreakpointId[];     // Which breakpoints are active
  overrides: BreakpointOverride[];  // Custom px values per breakpoint
}

interface BreakpointOverride {
  id: BreakpointId;
  px: number;
}

const DEFAULT_BREAKPOINTS_CONFIG: BreakpointsConfig = {
  enabled: ["desktop", "tablet-portrait", "mobile-portrait"],
  overrides: [],
};
```

## Editor UX

### BreakpointSwitcher (topbar right)
Icon buttons, one per enabled breakpoint. Active breakpoint highlighted.

Switching to a non-desktop breakpoint:
- Canvas inner wrapper gets `max-width: <px>` constraint
- Topbar shows current canvas width label
- Canvas has drag handle to resize within breakpoint bounds

Bounds for resize:
- Max = current breakpoint's px
- Min = next smaller enabled breakpoint's px (or 320)

### LeftPanel — Breakpoints Config
Shows all BREAKPOINT_DEFS. User can:
- Toggle optional breakpoints on/off
- Override px value per breakpoint
- Changes reflected in `breakpointsConfig` state → saved via `POST /breakpoints`

## Per-Breakpoint Style Editing

When `activeBreakpoint !== "desktop"`, RightPanel writes styles to breakpoint-specific keys:

```
block.config.styleBreakpoints = {
  "tablet-portrait": {
    _px: 992,           // Stored for media query generation
    paddingTop: "8px",
    ...
  }
}
```

Hover states at a breakpoint:
```
block.config.styleHoverBreakpoints = {
  "mobile-portrait": {
    _px: 575,
    backgroundColor: "#f00",
  }
}
```

**F4.5 — per-bp dark hover.** When the active state is `hover` AND
the active theme (driven by `config.theme` / `ThemeStyleToggle`) is
`dark` AND the active breakpoint is non-desktop, writes go to
`block.config.styleBreakpointsHoverDark[bpId]` instead. Same
`{ _px, ...cssProps }` shape as `styleHoverBreakpoints`. The
frontend renderer emits the matching CSS via
`buildBreakpointHoverDarkCss` — wraps `darkBlockHoverSelector` in
the appropriate `@media (max-width:N)` block. When the slot is
empty, the cascade falls back to `styleHoverBreakpoints` on dark
(byte-identical to pre-F4.5). See
[`prd-theme.md`](prd-theme.md) for the full theme × state ×
breakpoint matrix.

### Reading styles in RightPanel
For a non-desktop breakpoint, the effective style is the merge of base + breakpoint override:
```ts
const bpStyleRaw = styleBreakpoints[activeBreakpoint] ?? {};
const effectiveStyle = { ...activeStyle, ...bpStyleRaw };
```

The control reads from `effectiveStyle` and writes back only to `bpStyleRaw` (via `writeBpStyle()`).

## Frontend Rendering

Breakpoint styles are emitted as CSS media queries by `buildBreakpointCss(config, blockId, layoutSelector?)` in `styleUtils.ts`:

```css
@media (max-width: 992px) {
  [data-epx-block="<id>"] { padding-top: 8px; }
}
@media (max-width: 575px) {
  [data-epx-block="<id>"] { padding-top: 4px; }
}
```

Visual properties (border, radius, shadow, text color, typography, text-stroke, text-shadow) are written to the root `[data-epx-block="<id>"]` selector.
Layout / gap properties (`column-gap`, `row-gap`, `flex-direction`, `flex-wrap`, `justify-content`, `align-items`) are written to `layoutSelector` when provided — `SectionContainer.astro` passes `[data-epx-block="<id>"]>div` for video-background containers so layout targets the inner content wrapper, otherwise it merges into a single rule.

**Legacy spacing inline-resolve (F3.6.4)** — the per-breakpoint loop in
`buildBreakpointCss` applies the same `normalizeLegacySpacing` gate as the
desktop `buildStyleBodyFromObject` loop, scoped to padding/margin keys
listed in `LEGACY_SPACING_PROP_SET`. `BP_VISUAL_PROPS` doesn't currently
include padding/margin (it's the visual-only subset — radii / border
widths / typography / blend-mode / aspect-ratio / filter), so the gate
is a forward-compatibility measure: if a future change adds a spacing
prop to the breakpoint loop, symbolic values from pre-F3.6 layouts
inherit the same px translation as the desktop path. See
`prd-frontend.md § Legacy symbolic-spacing inline resolve (F3.6.4)` for
the full rationale.

Hover overrides per breakpoint go through `buildBreakpointHoverCss(config, blockId)` and emit `@media + :hover` rules with `!important`.

Both functions sort entries by `_px` descending so that smaller breakpoints win in cascade order. The returned strings are part of each block's `allCss` payload, which the block emits as its own inline `<style is:global set:html={allCss} />` after the JSX root (1.0.0 P0 fix; F4.1 reverted). A 30-block page with 5 active breakpoints therefore opens 30 × 5 = 150 `@media` blocks across 30+ inline `<style>` tags. F4.1's collect-then-coalesce mechanism (each block pushes into `Astro.locals.empixelLayoutCss`, `LayoutRenderer.astro` drains via post-iteration IIFE, coalesces identical `@media` queries, emits one `<style>`) didn't work because the parent's drain IIFE evaluated before child frontmatters had pushed their CSS — frontend pages rendered with zero plugin styling. `coalesceLayoutCss` stays exported in `styleUtils.ts` for a future redo with a reliable mechanism (likely a server-pre-pass walk in `LayoutRenderer.astro`'s own frontmatter that builds CSS for every block before any child renders). See `prd-frontend.md § CSS emission — per-block inline <style is:global> (1.0.0 P0 fix; F4.1 reverted)`.

## API

### GET /breakpoints
Returns current `BreakpointsConfig` from KV storage. Falls back to `DEFAULT_BREAKPOINTS_CONFIG`.

### POST /breakpoints
Body: `{ enabled: BreakpointId[], overrides: BreakpointOverride[] }`
Saves to KV. Always merges non-removable breakpoints into `enabled`.

## v0.6+ — config-level breakpoints

For block fields that aren't CSS-style (e.g. boolean toggles, select strings), per-breakpoint overrides live in a parallel map alongside `styleBreakpoints`:

```ts
block.config.configBreakpoints = {
  "tablet-portrait": { _px: 992, dropCap: false, columns: "2", columnsGap: "16px" },
};
```

Reader pattern in RightPanel:
```ts
const eff = isNonDesktop ? { ...config, ...bpConfigRaw } : config;
```

Writer:
```ts
function writeBpConfig(patch) {
  const px = getEffectiveBpPx(activeBreakpoint, breakpointsConfig);
  const current = configBreakpoints[activeBreakpoint] ?? {};
  onChange({ configBreakpoints: { ...configBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...patch } } });
}
```

Frontend emission walks the union of `styleBreakpoints` + `configBreakpoints` keys, emits `@media(max-width:_px){...}` rules per bp. Canvas previews receive `activeBreakpoint` via `PreviewProps` and merge for the active bp.

Currently used by: `text-editor` block (`dropCap`, `columns`, `columnsCustom`, `columnsGap`).

## Active-breakpoint preview on Canvas (F3.6.3)

`buildBreakpointCss` and `buildBreakpointHoverCss` emit `@media(max-width:Xpx)`
queries that gate the per-bp overrides. On the frontend that's exactly right —
the host site's viewport IS the user's viewport, so `@media` fires naturally.

On Canvas the situation is different: the canvas viewport is the actual
browser window (the `.epx-canvas--preview` frame just visually constrains the
preview via `max-width`, but `@media` still checks the WINDOW width). So when
the editor switches to `mobile-portrait` (575px), the underlying `@media(max-width:575px)`
rule does NOT fire on a 1920px laptop screen, even though the preview frame
is 575px wide.

F3.6.3 resolves this with a **stacked preview overlay**: Canvas emits the
exact same frontend bundle (so drift dies — `buildBlockChromeCss` is the same
helper Astro components call), then layers a non-`@media` duplicate of the
active bp's declarations AFTER the bundle. Selector specificity is identical
(both rules target `[data-epx-block="<id>"]`), so cascade order picks the
later rule — the overlay wins.

Mechanism (in `src/admin/Canvas.tsx`):

```ts
function buildActiveBpPreviewCss(block, activeBreakpoint): string {
  if (activeBreakpoint === "desktop") return "";
  const styleBp      = config.styleBreakpoints?.[activeBreakpoint];
  const styleHoverBp = config.styleHoverBreakpoints?.[activeBreakpoint];
  if (!styleBp && !styleHoverBp) return "";

  // Pseudo-merge the active bp into a synthetic config, then call the same
  // `buildBlockCss` / `buildHoverCss` (+ image-visual variants when
  // `imgScoped`) helpers the frontend uses. The result is a non-`@media`
  // rule that matches what the frontend's @media query would render at this
  // width.
  const cfg = {
    ...config,
    style:      { ...config.style,      ...styleBp      },
    styleHover: { ...config.styleHover, ...styleHoverBp },
  };
  return buildBlockCss(cfg, blockId, opts) + buildHoverCss(cfg, blockId, opts) + …;
}

export function buildCanvasBlockCss(block, activeBreakpoint): string {
  const chrome  = buildBlockChromeCss(config, blockId, opts);   // FULL frontend bundle
  const preview = buildActiveBpPreviewCss(block, activeBreakpoint);
  return chrome + preview;                                       // overlay wins cascade
}
```

Why not `@container` queries (spec option a)?
- Would require rewriting `buildBreakpointCss` to emit `@container` instead
  of `@media`. That helper is in Agent B's column (`src/components/styleUtils.ts`)
  — out of scope for an Agent C task.
- Would also force every host site to opt into a `container-type: inline-size`
  ancestor, which is a frontend behavior change beyond F3.6's "drift fix"
  scope. F4 can revisit.

Why not CSS variable + `:where(...)` (spec option b)?
- CSS variables can't gate `@media` evaluation. The browser checks the actual
  viewport regardless of an author CSS var. There's no `@media(--epx-active-bp-width <= 575px)`
  syntax.
- A `:where(...)` shim wrapper would have the same problem — selector
  conditions don't trigger `@media`.

Trade-off: when active-bp overrides exist, the resulting stylesheet contains
two rules with the same declarations (one inside the `@media` query, one
outside). Stylesheet size grows by the active-bp's declaration footprint
per block, but the canvas is admin-only and the duplication is one rule
per block — negligible impact.

## Breakpoint indicator — convention

Bp-aware controls render the `breakpointIndicator` (`<span class="epx-bp-label-icon">…<getBpIcon(activeBreakpoint)/></span>`) on every breakpoint, including `desktop`. Do NOT gate on `isNonDesktop`. Icon doubles as a "this control is bp-aware" affordance.

The indicator is a sibling of the label span (NOT nested inside) — placed immediately after `.epx-side-input__label`. CSS: `.epx-bp-label-icon { margin-right: auto; padding-left: 2px; }` keeps it left-anchored next to the label.

## TODO

- [x] Implement breakpoint CSS generation in `styleUtils.ts` (`buildBreakpointCss` / `buildBreakpointHoverCss`)
- [x] Render breakpoint style tags in `BlockRenderer.astro` / `SectionContainer.astro`
- [x] Render hover styles as `:hover` pseudo-selector CSS (`buildHoverCss`)
- [x] Render `styleDark` (merged via `getEffectiveStyle` when `theme === "dark"`)
- [ ] Allow per-page breakpoint overrides (currently global only)
