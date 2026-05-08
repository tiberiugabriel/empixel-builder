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

Hover overrides per breakpoint go through `buildBreakpointHoverCss(config, blockId)` and emit `@media + :hover` rules with `!important`.

Both functions sort entries by `_px` descending so that smaller breakpoints win in cascade order. CSS is concatenated and injected via `<style set:html={...} is:global />` in `BlockRenderer.astro` / `SectionContainer.astro`.

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

## Breakpoint indicator — convention

Bp-aware controls render the `breakpointIndicator` (`<span class="epx-bp-label-icon">…<getBpIcon(activeBreakpoint)/></span>`) on every breakpoint, including `desktop`. Do NOT gate on `isNonDesktop`. Icon doubles as a "this control is bp-aware" affordance.

The indicator is a sibling of the label span (NOT nested inside) — placed immediately after `.epx-side-input__label`. CSS: `.epx-bp-label-icon { margin-right: auto; padding-left: 2px; }` keeps it left-anchored next to the label.

## TODO

- [x] Implement breakpoint CSS generation in `styleUtils.ts` (`buildBreakpointCss` / `buildBreakpointHoverCss`)
- [x] Render breakpoint style tags in `BlockRenderer.astro` / `SectionContainer.astro`
- [x] Render hover styles as `:hover` pseudo-selector CSS (`buildHoverCss`)
- [x] Render `styleDark` (merged via `getEffectiveStyle` when `theme === "dark"`)
- [ ] Render `styleAccent` via `data-theme="accent"` attribute / selector
- [ ] Allow per-page breakpoint overrides (currently global only)
