# empixel-builder — Block System

## Role
Define all block types, their configuration schemas, and metadata. Single source of truth for editor UI and frontend rendering.

## ⚠️ Status (v0.6) — manual QA pending

All 10 blocks (container, text, image, text-editor, video, button, icon, html, divider-spacer, field-binding) and their canvas previews + frontend Astro components require **manual testing and improvement**:

- Drag each block from the palette into a container; confirm it accepts drops only inside containers (except container itself).
- Edit every Field-tab control; confirm canvas reflects in real-time.
- Edit every Style-tab control (theme, hover, breakpoint variants); confirm canvas + frontend match exactly.
- Test breakpoint overrides (configBreakpoints + styleBreakpoints) at each enabled bp — desktop, tablet-portrait, mobile-portrait.
- Test hover state per stateful control.
- Test Advanced tab (position, z-index, cssId, cssClasses, customCss with `selector` keyword).
- Render on frontend; verify produced HTML/CSS matches canvas; check responsive behavior in browser DevTools.
- Iterate per-block: tighten defaults, fix edge cases, polish missing features. Improvements are EXPECTED — first pass is functional but not battle-tested.

Update this section as blocks are vetted.

## Files
- `src/types.ts` — TypeScript `BlockType` union + all config interfaces
- `src/admin/blockDefinitions.ts` — `BLOCK_DEFINITIONS: BlockDef[]` array

## Type model (audit M4)

`types.ts` exposes two block shapes:

| Type | Use for |
|------|---------|
| `SectionBlock` (broad) | Tree utilities, reducer, storage, anything that mutates blocks generically. `config: BaseBlockConfig` (open index signature). |
| `TypedSectionBlock` (discriminated union) | Code that switches on `block.type` and wants `block.config` typed precisely. Convert via `asTyped(block)`. |

`BaseBlockConfig` lifts every cross-cutting key (`theme`, `style`, `styleDark`,
`styleHover`, `styleBreakpoints`, `styleHoverBreakpoints`, `advanced`,
`configBreakpoints`) to one place; every per-block `*Config` interface
extends it. New per-block keys go on the matching specific interface.

`ContainerConfig` is the new specific interface for `type: "container"`
(layout / flex / grid / htmlTag / link). Previously containers had no typed
config — every read was `(config.foo as string)`. New consumers that read
container fields should prefer `TypedSectionBlock` narrowing.

Migration plan: move one consumer at a time from `SectionBlock` →
`TypedSectionBlock`. Natural first targets are RightPanel per-block branches
and BlockRenderer dispatch. Existing `as` casts keep compiling against the
broad shape, so migration is incremental and non-blocking.

## Block Definition Schema

### BlockDef interface
```ts
interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  defaultConfig: Record<string, any>;
  // F3.5.1: legacy fields kept as deprecated aliases through the F3.5 transition
  fields: FieldDef[];                 // @deprecated — use fieldsTab
  styleFields?: FieldDef[];           // @deprecated — folded into styleTab as a leading custom entry
  // F3.5.1: new declarative schema (replaces imperative branching in RightPanel)
  fieldsTab?: FieldDef[];
  styleTab?: StyleSection[];
}
```

### `defaultConfig` structure (F3.6.1)

Every `BlockDef.defaultConfig` carries the **full structural shape** of the
block's config. Every key the panel + frontend will ever read is present on
the freshly-added block — empty strings (`""`) for string-typed CSS keys,
empty objects (`{}`) for nested map placeholders. F3.6.1 invents NO design
values; the user populates aesthetics later.

Why this matters:
- **Canvas / RightPanel don't need defensive checks.** Every `block.config.style.fontSize` read returns either a real value or `""` — never `undefined`.
- **F3.6.2 builds a load-time fill helper** (`getDefaultBlockConfig(type)`) on top of the same shape, applied to legacy layouts that pre-date F3.6.
- **F3.6.3 unifies CSS generation** between Canvas (`epxStyleString`) and frontend (`buildBlockChromeCss`) by relying on the keys always being present.

```ts
// Canonical shape produced by every BlockDef.defaultConfig today.
{
  // block-specific fields (e.g. `content: ""`, `theme: "light"`,
  // `aspectRatio: "16:9"`, `divider: { ... }`) keep their existing values.
  ...blockSpecificFields,

  // F3.6.1: full structural placeholders (always present).
  style: { ...EMPTY_STYLE_DEFAULTS },        // every key in STYLE_PROPS, "" by default
  styleHover: {},                            // populated when user toggles a hover state
  styleDark: {},                             // ditto for dark variant
  styleHoverDark: {},                        // F4.5 — hover-on-dark-mode override (optional; cascade falls back to styleHover when empty)
  styleBreakpoints: {},                      // { [bpId]: { _px, ...keys } }
  styleHoverBreakpoints: {},                 // { [bpId]: { _px, ...keys } }
  styleBreakpointsHoverDark: {},             // F4.5 — per-bp hover-on-dark-mode override (optional)
  advanced: { ...EMPTY_ADVANCED_DEFAULTS },  // cssId / cssClasses / customCss / position / top / right / bottom / left / zIndex, all ""
}
```

**F4.5 — theme × state matrix completion.** `styleHoverDark` and
`styleBreakpointsHoverDark` close the dark-hover gap. Authors can now
declare a different hover treatment on dark theme; selector specificity
(`darkBlockSelector + :hover` > `darkBlockSelector` > `:hover` > base)
makes the cascade work without `!important`. See
[`prd-theme.md`](prd-theme.md) for the full cascade table, tie-break
audit, and authoring workflows.

`EMPTY_STYLE_DEFAULTS` and `EMPTY_ADVANCED_DEFAULTS` are exported from `src/admin/blockDefinitions.ts`. `EMPTY_STYLE_DEFAULTS` mirrors the canonical `STYLE_PROPS` array in `src/components/styleUtils.ts` (Agent B's column — local `const`, not exported, so we replicate the key set as a contract). The 36 keys cover padding/margin/sizing/border-radius/border-width/overflow/typography/blend-mode/aspect-ratio/filter — every CSS property the plugin's render pipeline knows about.

Pre-existing design defaults still survive the F3.6.1 merge:
- `container.style` retains `paddingTop/Right/Bottom/Left = "12px"` and `columnGap/rowGap = "6px"` (the merge spreads `EMPTY_STYLE_DEFAULTS` first, then design overrides win).
- `text-editor.defaultConfig` retains `columns: "1"`, `columnsGap: "0px"`, `dropCap: false`.
- `video.defaultConfig` retains `aspectRatio: "16:9"` and the `video.{src,autoplay,mute,...}` group.
- `divider-spacer.defaultConfig` retains the full `divider: { style, width, length, color, colorAlpha, align }` group.

If `STYLE_PROPS` in `styleUtils.ts` ever gains a new entry, mirror it
in BOTH `EMPTY_STYLE_DEFAULTS` (in `blockDefinitions.ts`) and the
`STYLE_PROPS_SNAPSHOT` array in `tests/blockDefinitions.test.ts`. The
test asserts both lists agree and will fail loudly until they do.

### F3.6.7 — parity snapshot guard (`tests/parity/all.test.ts`)

A second guard exists at the CSS-output level. `tests/parity/all.test.ts`
holds 9 fixtures (one per block type) plus inline
`toMatchInlineSnapshot()` assertions on
`buildBlockChromeCss(config, blockId, opts)`. Each fixture starts from
`getDefaultBlockConfig(<type>)` so every structural key is present, then
layers aesthetic values on top to exercise the relevant CSS code paths
(background / border / radius / shadow / typography / breakpoints /
hover / dark / advanced). The `container` fixture carries the
**exhaustive** "every `STYLE_PROPS` entry non-empty" config so the
snapshot pins the full chrome bundle; the other 8 fixtures cover
representative per-block subsets.

One additional assertion (`text` block, desktop) locks
`buildCanvasBlockCss(block, "desktop")` against
`buildBlockChromeCss(block.config, block.id)` at the chrome-CSS level.
This is a string-equality check, not a snapshot — extends F3.6.3's
"both call the same helper" beyond unit-level into a snapshot-level
contract. If a future Canvas refactor splits the path the equality
breaks before the snapshots even surface the drift.

**When `styleUtils.ts` changes:**

1. Run `npm test` once. Vitest reports the snapshot diff for every
   fixture whose CSS output shifted.
2. Inspect each diff. If the change was intentional, regenerate with
   `npx vitest -u tests/parity/all.test.ts` (or `npx vitest -u` for
   everything) and commit the regenerated snapshots in the SAME PR
   that edited `styleUtils.ts`. The CI history then records what
   shifted alongside the code change that caused the shift.
3. If a diff appears that you did NOT intend, that's parity drift
   — either Canvas / frontend silently stopped agreeing, or a
   refactor leaked a behavior change. Fix the code. Do NOT
   regenerate the snapshot.

Inline snapshots (not separate `.snap` files) keep assertion +
expected output co-located in `tests/parity/all.test.ts` so reviewers
can read the diff inline without bouncing to a separate file.

### `getDefaultBlockConfig(type)` + `BASE_DEFAULTS` (F3.6.2)

F3.6.2 builds the **load-time fill helper** on top of the F3.6.1 schema. Two new exports from `src/admin/blockDefinitions.ts`:

- **`BASE_DEFAULTS`** — shared shape inherited by every block. Contains `theme: "light"` plus the F3.6.1 empty structural placeholders (`style: { ...EMPTY_STYLE_DEFAULTS }`, `styleHover: {}`, `styleDark: {}`, `styleBreakpoints: {}`, `styleHoverBreakpoints: {}`, `advanced: { ...EMPTY_ADVANCED_DEFAULTS }`) **plus the F4.5 hover-on-dark slots (`styleHoverDark: {}`, `styleBreakpointsHoverDark: {}`)**. Centralises the contract so legacy layouts saved before the F3.6.1 / F4.5 BlockDef edits still backfill correctly.
- **`getDefaultBlockConfig(type: BlockType)`** — pure function returning a deep-cloned full-shape config. Internally:

  ```ts
  // Pseudocode — see blockDefinitions.ts for the implementation.
  function getDefaultBlockConfig(type) {
    const def = BLOCK_DEFINITIONS.find(d => d.type === type);
    if (!def) return structuredClone(BASE_DEFAULTS);     // unknown type
    const merged = structuredClone(BASE_DEFAULTS);
    for (const [key, value] of Object.entries(structuredClone(def.defaultConfig))) {
      if (isPlainObject(value) && isPlainObject(merged[key])) {
        merged[key] = { ...merged[key], ...value };       // deep-merge nested
      } else {
        merged[key] = value;                              // BlockDef overrides
      }
    }
    return merged;
  }
  ```

  Two calls return **independent object references** — `structuredClone` (or a JSON round-trip on older runtimes) deep-copies every level, so mutating `a.style.fontSize` doesn't bleed into a second call's return. The reducer fills its way through this helper at every mount path so callers never share a structure with the source BlockDef.

Pre-existing design defaults survive intact: `container.style.paddingTop = "12px"` (and the rest of the padding/gap group) is preserved because the BlockDef's nested `style` object is deep-merged on top of `EMPTY_STYLE_DEFAULTS`, not assigned on top of it. Unknown block types receive a deep-cloned `BASE_DEFAULTS` so the helper never returns `undefined`.

Wired into the reducer in F3.6.2:
- **`ADD_BLOCK`** — deep-merges `action.block.config` over `getDefaultBlockConfig(block.type)`. Action's explicit values win on overlap; missing keys are backfilled. Same fill applies to `ADD_TO_CONTAINER` and `INSERT_AFTER` so any path that lands a fresh block in state goes through the same pipeline. Builder.tsx and `useDragHandlers.ts` shallow-spread `def.defaultConfig` when crafting the action — the reducer's fill is the safety net.
- **`LOAD_SUCCESS`** — walks the loaded section tree (recursing into `children` and `slots`) and backfills missing keys per node. Existing values are never overwritten. Old layouts saved before F3.6.1 / F3.6.2 upgrade transparently the first time the panel reads them.

The helper is the foundation F3.6.3 builds on — Canvas (`epxStyleString`) and frontend (`buildBlockChromeCss`) can drop their defensive `?? ""` checks for style keys because every key is guaranteed present.

### StyleSection (declarative Style tab — F3.5.1)

Replaces the ~9 imperative `block.type === "..."` branches in `RightPanel.tsx`. Each entry maps to one section the panel knows how to render. F3.5.1 introduces the type only — F3.5.2 populates `styleTab` per block, F3.5.3 + F3.5.4 land the `SectionRenderer` / `TabRenderer`, F3.5.6 deletes the imperative branches.

```ts
type StyleSection =
  | { kind: "theme" }
  | { kind: "spacing"; targets?: ("padding" | "margin")[] }
  | { kind: "background"; modes?: BackgroundMode[] }   // BackgroundMode = BackgroundType from BackgroundControl
  | { kind: "border" }
  | { kind: "borderRadius" }
  | { kind: "boxShadow" }
  | { kind: "typography"; props?: TypographyProp[] }   // TypographyProp = keyof TypographyValue
  | { kind: "textStroke" }
  | { kind: "textShadow" }
  | { kind: "alignment" }
  | { kind: "blendMode" }
  | { kind: "filter" }
  | { kind: "overflow" }
  | { kind: "opacity" }
  | { kind: "imgVisual" }            // image-only — width/height/objectFit/objectPosition/imgStyle
  | { kind: "videoSource" }          // video-only — aspect-ratio + filter group
  | { kind: "iconGroup" }            // icon / button / divider — collapsible icon-picker section
  | { kind: "dividerLine" }          // divider-spacer-only — divider style/width/length/color/align
  | { kind: "custom"; render: (props: SectionRenderProps) => ReactNode };

interface SectionRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}
```

Backwards-compat strategy: `fields` is the alias source — `getBlockDef` returns `def.fieldsTab ?? def.fields` so new declarative consumers can read `def.fieldsTab` directly while old callers keep working unchanged. `styleTab` is opt-in until F3.5.6 (no auto-alias from `styleFields` because the shapes differ — `FieldDef[]` vs `StyleSection[]`).

Deprecation timeline:
- **F3.5.1** — types added, no instances migrated
- **F3.5.2** (shipped) — 9 BlockDef instances populate `fieldsTab` + `styleTab` directly. Custom Style logic extracted into `src/admin/right-panel/sections/`. Imperative `block.type ===` branches in `RightPanel.tsx` still own rendering until F3.5.6.
- **F3.5.3 + .4** — `SectionRenderer.tsx` + `TabRenderer.tsx` consume the declarative lists
- **F3.5.5** (shipped) — universal `<AdvancedTab />` extracted; wired into `TabRenderer`.
- **F3.5.6** (shipped) — `RightPanel.tsx` rewrites onto the declarative pipeline (1671 LOC → 162). All 9 imperative `block.type ===` branches deleted; tab visibility driven by `getVisibleTabs(block)`. `FieldDef` extended with `kind: "custom"` so `container` and `video` (and the per-block extras for `text` / `image` / `text-editor` / `button` / `icon`) declare their Fields tabs through `fieldsTab`. `fields` / `styleFields` aliases kept for one more release; F3.5.7 / .8 retire them.

### F3.5.2 — migrated instance shapes

Each of the 9 entries now declares its Fields and Style tabs through the new schema. Per-block summary (length × kind, where applicable):

| Block | `fieldsTab` | `styleTab` |
|-------|-------------|------------|
| `text` | `[content]` (1) | `[alignment, typography, textStroke, textShadow, blendMode]` (5) |
| `image` | `[caption]` (1) | `[imgVisual, alignment, opacity, borderRadius, border, boxShadow]` (6) |
| `text-editor` | `[content]` (1) | `[alignment, typography, textShadow, custom(TextEditorDropCapSection)]` (4) |
| `video` | `[custom(VideoFieldsSection)]` (1) — F3.5.6 routes the imperative `VideoSourceControl` + overlay group through `kind: "custom"` | `[custom(VideoSourceSection)]` (1) |
| `button` | `[text, icon, custom(LinkFieldsSection)]` (3) — F3.5.6 adds the link entry as `kind: "custom"` | `[typography, background, borderRadius, border, boxShadow]` (5) — F3.5.6 follow-up dropped the redundant leading `theme` entry (Background already renders `<ThemeStyleToggle />` inline) |
| `icon` | `[icon, custom(LinkFieldsSection)]` (2) | `[alignment, custom(IconBlockStyleSection)]` (2) |
| `html` | `[code]` (1) | absent — `html` block hides the Style tab entirely (`getVisibleTabs` returns `["fields", "advanced"]`) |
| `divider-spacer` | `[space]` (1) | `[custom(DividerLineSection)]` (1) — divider-line picker lifted from Fields → Style |
| `container` | `[custom(ContainerLayoutPicker)]` (1) — F3.5.6 routes `LayoutControl` / `GapControl` / `OverflowControl` / HTML Tag / `LinkControl` through `kind: "custom"` | `[background, borderRadius, border, boxShadow]` (4) — F3.5.6 follow-up dropped the redundant leading `theme` entry (Background already renders `<ThemeStyleToggle />` inline) |

Two example shapes:

```ts
// text — pure built-in stack
{
  type: "text",
  fieldsTab: [
    { key: "content", label: "Content", type: "textarea", labelClassName: "epx-row-label--section" },
  ],
  styleTab: [
    { kind: "alignment" },
    { kind: "typography" },
    { kind: "textStroke" },
    { kind: "textShadow" },
    { kind: "blendMode" },
  ],
}

// html — Style tab absent (RightPanel `hideStyleTab`)
{
  type: "html",
  fieldsTab: [
    { key: "code", label: "HTML", type: "code", language: "html", labelClassName: "epx-row-label--section" },
  ],
  // styleTab intentionally undefined
}
```

Custom renderers live under `src/admin/right-panel/sections/`:
- `TextEditorDropCapSection.tsx` — paragraph spacing + (conditional) drop-cap subgroup.
- `VideoSourceSection.tsx` — aspect ratio + `CssFiltersControl`.
- `DividerLineSection.tsx` — full divider-line picker (~300 LOC, lifted verbatim with bp routing intact).
- `IconBlockStyleSection.tsx` — icon color (Normal/Hover) + size + rotate.

`SectionRenderProps` (`{ block, onChange, activeBreakpoint }`) does not yet carry `breakpointsConfig`, so custom renderers fall back to `BREAKPOINT_DEFS[bp].defaultPx` for the `_px` field on `styleBreakpoints[bpId]` writes — F3.5.4's `TabRenderer.tsx` may extend the prop shape if host-customised breakpoints need to flow in.

### FieldDef interface

F3.5.6 widened `FieldDef` into a discriminated union of two variants:
the existing standard input-driven shape and a new `kind: "custom"`
escape hatch for bespoke renderers (used by `container`, `video`, etc.).

```ts
type FieldDef = StandardFieldDef | CustomFieldDef;

interface StandardFieldDef {
  kind?: "standard";   // optional — defaults to "standard"
  key: string;
  label: string;
  type:
    | "text" | "url" | "textarea" | "number" | "select" | "toggle"
    | "json-array" | "link"
    | "rich-text" | "code" | "number-units" | "icon-group";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  labelClassName?: string;
  showWhen?: { key: string; value: string };  // Conditional render
  itemFields?: FieldDef[];   // For json-array: sub-field schema
  language?: "html" | "css" | "js";              // For type='code'
  showPosition?: boolean;                         // For type='icon-group'
  units?: Array<"px"|"rem"|"em"|"%"|"vh"|"vw"|"deg"|"turn">; // For type='number-units'
}

interface CustomFieldDef {
  kind: "custom";
  key: string;
  render: (props: FieldRenderProps) => ReactNode;
  showWhen?: { key: string; value: string };
}

interface FieldRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}
```

`FieldRenderer` dispatches on `kind` first: `kind === "custom"` calls
the renderer's `render({ block, onChange, activeBreakpoint })` with
the panel's context (passed through as `customCtx`); standard entries
keep their `(value, onChange)` flow. `JsonArrayField` filters out
`kind: "custom"` entries from `itemFields` — sub-fields inside a
JSON-array item must be standard `StandardFieldDef`.

### FieldType values
| Type | Rendered as | Value stored |
|------|-------------|--------------|
| `text` | `<input type="text">` | string |
| `url` | `<input type="url">` | string |
| `textarea` | `<textarea rows=3>` | string |
| `number` | `<input type="number">` | number |
| `select` | `<select>` | string |
| `toggle` | checkbox + inline label | boolean |
| `json-array` | JsonArrayField | array |
| `link` | LinkControl | `{ href, newTab, nofollow, customAttr }` |
| `rich-text` | RichTextField (PortableTextEditor lazy-loaded from `@emdash-cms/admin`) | Portable Text JSON array |
| `code` | CodeEditor (html/css/js modes, autocomplete on html) | string |
| `number-units` | NumberWithUnits (px/rem/em/%/vh/vw/deg/turn) | string (e.g. `"24px"`) |
| `icon-group` | IconGroup (src/size/color/shadow/position) | `IconGroupValue` object |

## Current Blocks (v0.6.0)

### BlockType union (src/types.ts)
```ts
export type BlockType =
  | "container"
  | "text"
  | "image"
  | "text-editor"     // v0.6
  | "video"           // v0.6
  | "button"          // v0.6
  | "icon"            // v0.6
  | "html"            // v0.6
  | "divider-spacer"  // v0.6 (replaces "spacer")
  | "field-binding";  // F4.4 — reads entry.data[config.field]
```

> Removed post-v0.6: `testimonials`, `faq`, `pricing`. Variant B — no DB
> migration. Old layouts containing these types load successfully but render
> nothing on the frontend and show "Unknown block" in the canvas.

### 1. container
- Category: core
- Fields: none (layout-only block)
- Default: `{ theme: "light", layout: "flex", style: { paddingTop/Right/Bottom/Left: "12px", columnGap/rowGap: "6px" } }`
- Holds: `children: SectionBlock[]`
- Extra fields tab controls: LayoutControl, GapControl, OverflowControl, HTML Tag, LinkControl (if tag = "a")

### 2. text
- Category: general
- Fields: content (textarea), HTML Tag selector (default `p`; supports h1–h6, span, div, a), LinkControl (if tag = "a")
- Default: `{ content: "", theme: "light" }`
- **Style tab is custom**: Align / Typography / TextStroke / TextShadow / BlendMode (no Background/Border/Shadow sections)
- Config: `TextConfig` — `content`, `htmlTag`, `linkHref`, `linkNewTab`, `linkNofollow`, `linkCustomAttr`, `theme`

### 3. image
- Category: general
- Fields: caption (textarea), MediaPicker thumbnail row, Resolution selector (full / thumbnail / medium / large), LinkControl (always available)
- Default: `{ theme: "light", resolution: "full" }`
- **Style tab is custom**: Width/Height (writes to `imgStyle`, not `style`), Object Fit, Object Position, Align, Opacity (normal/hover) — no Background/Border/Shadow sections at root (border/radius/shadow target inner `<img>` via `imgStyle`-equivalent CSS)
- Config: `ImageConfig` — `image: ImageMediaRef`, `resolution`, `caption`, `linkHref`, `linkNewTab`, `linkNofollow`, `linkCustomAttr`, `theme`, `imgStyle: ImageElementStyle`

```ts
interface ImageMediaRef {
  id: string;
  storageKey: string;
  alt?: string;
  filename?: string;
}

type ImageResolution = "thumbnail" | "medium" | "large" | "full";

interface ImageElementStyle {
  width?: string; minWidth?: string; maxWidth?: string;
  height?: string; minHeight?: string; maxHeight?: string;
  objectFit?: string;
  objectPosition?: string;
}
```

### text-editor (v0.6) — current shape

- Fields in `def.fields`: `content` (rich-text only). Other fields rendered via custom branch in [RightPanel.tsx](../src/admin/RightPanel.tsx) so they support per-breakpoint overrides through `configBreakpoints[bpId]`.
- Custom Fields-tab branch (bp-aware via `configBreakpoints`): Drop Cap (switch), Columns (SelectRow with pen-icon "custom" option, scrubable label, leftAddon number input), Columns Gap (SideInput inside FieldGroup, default `0px`).
- Style tab: Align (bp), Typography (base only — no bp), TextShadow (bp; default color `#000000` on canvas + frontend), Paragraph Spacing (bp), Drop Cap section (visibility from effective bp dropCap; Size/Lines/MarginRight all bp-aware via `writeBpStyle`).
- Frontend `TextEditor.astro` emits per-bp `@media(max-width:_px){...}` rules walking the union of `configBreakpoints` + `styleBreakpoints` for `column-count`, `column-gap`, and ::first-letter rule (drop cap on/off + size/lines/margin-right). Image inserts in PortableText render via `PortableTextImage.astro` (custom `components.type.image`). Defaults: `columns="1"`, `columnsGap="0px"`, `dropCap=false`. `column-count` + `column-gap` always emitted (also at 1/0px) so DevTools shows the rule.
- Canvas preview ([TextEditorPreview.tsx](../src/admin/previews/TextEditorPreview.tsx)) receives `activeBreakpoint` via `PreviewProps` and bp-merges before rendering. Renders Portable Text via mini renderer (paragraphs, headings, marks, image type).

### 4. text-editor (v0.6)
- Category: general
- Fields: content (rich-text → Portable Text JSON), dropCap toggle, columns (1/2/3/custom), columnsCustom, columnsGap (number-units)
- Default: `{ content: [], theme: "light", columns: "1", columnsGap: "32px", dropCap: false }`
- **Style tab is custom**: Align, Typography (with linkColor), TextShadow, ParagraphSpacing, DropCap group (Size/Lines/MarginRight when `dropCap=true`)
- Frontend: renders Portable Text via `<PortableText>` from `emdash/ui` (lazy-imported, falls back to plain text)

### 5. video (v0.6)
- Category: general
- Fields tab (custom): VideoSourceControl (Media | URL with provider auto-detect: YT/Vimeo/mp4/webm/mov), Image Overlay group (image, resolution, size, position, IconGroup)
- Default: `{ theme: "light", video: { src: "url", controls: true, lazyLoad: true, mute: true }, aspectRatio: "16:9" }`
- **Style tab**: AspectRatio (1:1, 3:2, 4:3, 16:9, 21:9, 9:16, custom W/H), CssFiltersControl (blur/brightness/contrast/saturate/hue-rotate/grayscale/sepia/invert)
- Frontend: provider switch builds embed URL with selected params; image overlay → click-to-play swaps `data-epx-src` into iframe/video src

### 6. button (v0.6)
- Category: general
- Fields: text (textarea), LinkControl (custom branch), IconGroup (with showPosition: left/right/top/bottom)
- Default: `{ theme: "light", text: "Click me", icon: { iconPosition: "left", iconSize: "16px" } }`
- **Style tab**: TypographyControl + Background + Border + BorderRadius (uses default style branch + Typography prepended)
- Frontend: renders `<a>` when `linkHref` set, else `<button type="button">`. Icon positioning via flex-direction.

### 7. icon (v0.6)
- Category: general
- Fields: IconGroup (showPosition: false), LinkControl (custom branch)
- Default: `{ theme: "light", icon: { iconSize: "32px" } }`
- **Style tab is custom**: Align, ColorNormalHover (Normal/Hover toggle), Size (NumberWithUnits), Rotate (deg/turn)
- Frontend: SVG → CSS-mask block (so `iconColor` recolors); PNG → `<img>` (color ignored, admin shows note). Wrap in `<a>` when link set. Rotate via transform.

### 8. html (v0.6)
- Category: core
- Fields: code (CodeEditor with `language="html"` — token coloring + tag/attr autocomplete)
- Default: `{ theme: "light", code: "" }`
- **No Style tab** — placeholder message instead.
- Frontend: `<div data-epx-block ... set:html={code}>`. SECURITY: trusted user input, not sanitized (raw-html block intent).

### 9. divider-spacer (v0.6, replaces `spacer`)
- Category: core
- Fields: space (number-units; vertical height of the block), Divider sub-group (collapsible) — style (none/solid/dashed/dotted/double/groove/ridge/gradient/wavy/zigzag), width (NumberWithUnits), length (NumberWithUnits — % of container or absolute), color, align (left/center/right), IconGroup with showPosition (left/right/center/above/below)
- Default: `{ theme: "light", space: "48px", divider: { style: "none", width: "1px", length: "100%", color: "#000000", colorAlpha: 0.12, align: "center" } }`
- **No Style tab** — all knobs in Fields.
- Frontend: fixed-height block; if divider enabled, inline-flex with line(s) + optional centered icon. SVG mask drives `wavy`/`zigzag` styles. `gradient` style → `linear-gradient(transparent → color → transparent)`.

### 10. field-binding (F4.4)
- Category: core
- Fields: `field` (free-text — pre-filled by the LeftPanel "Bound to this entry" palette on drag, but rebindable to any entry key), `as` (HTML tag select — whitelisted to `p`, `h1`–`h6`, `span`, `div`)
- Default: `{ field: "", as: "p", theme: "light" }` (plus the canonical `style`/`styleHover`/`styleDark`/`styleHoverDark`/`styleBreakpoints`/`styleHoverBreakpoints`/`styleBreakpointsHoverDark`/`advanced` shape every block carries since F3.6.1)
- **Not root-allowed** — must live inside a container (matches every leaf except `container` / `html` / `divider-spacer`).
- **Style tab — same shape as `text`**: Alignment + Typography + TextStroke + TextShadow + BlendMode (no Background/Border/Shadow — bound element is plain inline-or-paragraph chrome).
- Canvas preview ([FieldBindingPreview.tsx](../src/admin/previews/FieldBindingPreview.tsx)) renders a small badge naming the bound field — `<bound: title>` when `config.field` is set, italic `<unbound>` otherwise. Canvas can't resolve the actual entry value at preview time (no host `entry` in scope), so the badge is the documented preview surface.
- Frontend ([FieldBinding.astro](../src/components/FieldBinding.astro)) reads `entry?.data?.[config.field]` (string/number/boolean only — object-shaped values fall through to `""` and a future PR adds image-binding via `<Image image={...} />`), spreads `entry.edit?.[config.field]` onto the rendered tag for EmDash live-edit reattach, clamps `config.as` against the same tag whitelist as the BlockDef (anti-XSS), pushes per-block CSS into `Astro.locals.empixelLayoutCss` (F4.1 coalescing). Plumbed through `BlockRenderer.astro` via an optional `entry` prop — F4.4-impl wires the dispatch + accepts the prop; the upstream plumb-through from `BuilderWrapper.astro` → `LayoutRenderer.astro` is a future Agent B PR (those files are not in F4.4's documented cross-domain exception list). Until that lands, hosts can use the block — it just renders an empty element.
- LeftPanel "Bound to this entry" palette: `BuilderPage.tsx` seeds the field list with `["title", "slug", "id"]` (the writable scalars the `/entries` route exposes today). Each card is a draggable `useDraggable` with data `{ kind: "new-block", blockType: "field-binding", field }`. Drop / click pre-fills `config.field = field` + `config.as = defaultAsForField(field)` (title→h1, excerpt→p, default→p). Authors can rebind via the Fields tab.

### Migrated from v0.5
- Old `spacer` blocks are rewritten to `divider-spacer` once on plugin init via `runSpacerMigration` in `plugin.ts`. Flag stored in `empixel_builder_meta` table (key `migration_spacer_v1`). Mapping: `height: sm/md/lg/xl → 32/64/96/128px`; `showDivider: true → divider.style = "solid"`.

### IconGroupValue (shared)
```ts
interface IconGroupValue {
  iconSrc?: ImageMediaRef;       // SVG or PNG via MediaPicker
  iconSize?: string;              // px/rem/em/%
  iconColor?: string; iconColorAlpha?: number;
  iconShadowX?, iconShadowY?, iconShadowBlur?: string;
  iconShadowColor?: string; iconShadowAlpha?: number;
  iconPosition?: "left"|"right"|"top"|"bottom"|"center"|"above"|"below";
}
```

## SectionBlock (Tree Node)

```ts
interface SectionBlock {
  id: string;                    // UUID
  type: BlockType;
  config: Record<string, any>;   // Flat config object
  children?: SectionBlock[];     // Container: child blocks
  slots?: SectionBlock[][];      // Columns: col arrays
}
```

### Container types
```ts
export const CONTAINER_TYPES: BlockType[] = ["container"];
export function isContainerType(type: BlockType): boolean;
```

Only container types can be placed at the top level of the canvas.
Leaf blocks must be dropped inside a container.

## Config Structure Conventions

Each block's config may contain any combination of:
- Block-specific keys (e.g. `items`, `tiers`, `layout`)
- `theme` — "light" | "dark" (authoring marker — drives RightPanel routing, not rendering)
- `style` — CSS properties for normal/light state
- `styleDark` — CSS properties for dark theme
- `styleHover` — CSS properties for hover state
- `styleHoverDark` — F4.5 — CSS properties for hover on dark theme. Optional; cascade falls back to `styleHover` when empty. Selector: `darkBlockHoverSelector(<id>)`
- `styleBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` breakpoint overrides
- `styleHoverBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` hover breakpoint overrides
- `styleBreakpointsHoverDark` — F4.5 — `{ [bpId]: { _px, ...cssProps } }` per-bp hover-on-dark overrides. Optional; cascade falls back to `styleHoverBreakpoints` when empty.
- `advanced` — `{ position, top, right, bottom, left, zIndex, cssId, cssClasses, customCss }`
- `htmlTag` — semantic HTML element for container
- `linkHref`, `linkTarget` — for `<a>` containers

## Helpers

```ts
export function parseItems<T>(json: unknown, fallback: T[] = []): T[]
```
Safely parses JSON array from DB (may be string or already array).

## Rules

- **Every `BlockType` in `types.ts` must have a matching `BlockDef` in `blockDefinitions.ts`**
- **defaults must match type interface exactly**
- **Shared field objects** (like a THEME_FIELD) should be factored out, not duplicated
- **Preview component** must exist for every block
- **Astro frontend component** must exist for every block

## Adding a new block type — author guide (F3.5.8)

After F3.5.6 the right-panel is fully declarative: every Fields / Style / Advanced surface renders from data on the matching `BlockDef`. **Adding a new block type is a 3-file task**. You should NOT need to touch `RightPanel.tsx`, `SectionRenderer.tsx`, `TabRenderer.tsx`, `AdvancedTab.tsx`, or `src/types.ts` (orchestrator-owned).

The orchestrator-owned exception: a new `BlockType` literal does need to land in `src/types.ts` via the `types-proposals.md` flow. Append a proposal there (block name, default config interface, expected union slot) and wait for the orchestrator's type PR. Once the type ships, the rest of the block is admin-UI + frontend work and stays inside Agent C / Agent B columns.

### Step-by-step recipe

#### Step 1 — declare the `BlockDef`

File: `src/admin/blockDefinitions.ts`. Add an entry to the exported `BLOCK_DEFINITIONS` array. Use existing block declarations as templates (`text` for the simplest stack; `container` for full-custom Fields; `image` for full-custom Style).

```ts
// src/admin/blockDefinitions.ts
const QUOTE_FIELDS: FieldDef[] = [
  { key: "quote", label: "Quote", type: "textarea", placeholder: "Enter quote…", labelClassName: "epx-row-label--section" },
  { key: "citation", label: "Citation", type: "text", placeholder: "Author or source", labelClassName: "epx-row-label--section" },
];

export const BLOCK_DEFINITIONS: BlockDef[] = [
  // … existing entries …
  {
    type: "quote",
    label: "Quote",
    icon: "❝",
    description: "A blockquote with optional citation",
    category: "general",
    defaultConfig: { quote: "", citation: "", theme: "light" },
    fields: QUOTE_FIELDS,           // alias kept until F3.5.6+1 retires it
    fieldsTab: QUOTE_FIELDS,
    styleTab: [
      { kind: "alignment" },
      { kind: "typography" },
      { kind: "background" },
      { kind: "borderRadius" },
      { kind: "border" },
      { kind: "boxShadow" },
    ],
  },
];
```

KISS rules:

- `fields` and `fieldsTab` MUST point at the same array literal so the alias contract holds.
- `defaultConfig` matches the per-block config interface 1:1 — every key the panel writes should have a default (or be intentionally absent).
- Pull `FieldDef[]` and `StyleSection[]` schemas from the references below.
- A block with no Style tab (`html`-style) simply omits `styleTab`. The panel auto-hides Style via `getVisibleTabs(block)`; no other change needed.

#### Step 2 — add a preview component

Files:
- New: `src/admin/previews/<NewBlock>Preview.tsx`
- Register: `src/admin/previews/index.ts` — append to `PREVIEW_COMPONENTS`.

Previews are React components that render inside the Canvas (`src/admin/Canvas.tsx`). They receive `PreviewProps` (`{ config, children?, slots?, activeBreakpoint? }`) and should:

- Render a faithful, responsive approximation of the frontend output.
- Read `config` keys with `as` casts (the surface is `Record<string, unknown>` to keep the registry single-typed) — narrow per-key, not the whole `config`.
- Treat empty values as "show muted placeholder" (italic gray text). See `TextPreview.tsx` for the canonical placeholder pattern.
- Wrap in `React.memo` so dragging unrelated blocks doesn't re-render this preview.

Skeleton:

```tsx
// src/admin/previews/QuotePreview.tsx
import React, { memo } from "react";

export const QuotePreview = memo(function QuotePreview({ config }: { config: Record<string, unknown> }) {
  const quote = (config.quote as string) || "";
  const citation = (config.citation as string) || "";
  if (!quote) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Quote block</span>;
  }
  return (
    <blockquote style={{ margin: 0, fontStyle: "italic" }}>
      <p>{quote}</p>
      {citation && <footer style={{ fontStyle: "normal", fontSize: 12, opacity: 0.7 }}>— {citation}</footer>}
    </blockquote>
  );
});
```

Then register:

```ts
// src/admin/previews/index.ts
import { QuotePreview } from "./QuotePreview.js";

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  // …
  quote: QuotePreview as React.ComponentType<PreviewProps>,
};
```

The `PREVIEW_COMPONENTS` map is keyed by `BlockType` — `Record<BlockType, …>` — so once `quote` lands in the `BlockType` union (orchestrator step), TypeScript will fail this map until the entry is added. That's intentional.

#### Step 3 — add the Astro frontend component

Files:
- New: `src/components/<NewBlock>.astro`
- Register: `src/components/index.ts` (the `blockComponents` map).
- Register: `src/components/BlockRenderer.astro` (one dispatch branch).

Frontend components are server-rendered Astro components that emit the actual HTML the user's site ships. Contract:

- Take `Props = { value: <BlockConfig>; blockId?: string }`.
- Emit `data-epx-block={blockId || undefined}` on the root tag (so per-block CSS scoping works).
- Honor `advanced.cssId` and `advanced.cssClasses`.
- Build the chrome CSS via `buildBlockChromeCss(config, blockId, { resolveMediaUrl })` from `styleUtils.js` and emit it inside `<style set:html={allCss} is:global />`.
- Use `<Image image={…} />` from `"emdash/ui"` for image fields, never raw `<img>` (per global CLAUDE.md rule).

Skeleton:

```astro
---
// src/components/Quote.astro
import { buildBlockChromeCss } from "./styleUtils.js";
import { resolveMediaUrl } from "./media.js";

interface Props {
  value: { quote?: string; citation?: string; theme?: "light" | "dark" } & Record<string, unknown>;
  blockId?: string;
}

const { value, blockId } = Astro.props;
const { quote = "", citation = "" } = value;

const advanced = (value as Record<string, unknown>).advanced as Record<string, string> | undefined;
const cssId      = advanced?.cssId      || undefined;
const cssClasses = advanced?.cssClasses || undefined;

const config = value as Record<string, unknown>;
const resolver = (key: string) => resolveMediaUrl(key, { locals: Astro.locals });
const allCss = buildBlockChromeCss(config, blockId, { resolveMediaUrl: resolver });
---

<blockquote
  data-epx-block={blockId || undefined}
  id={cssId}
  class={cssClasses || undefined}
>
  <p>{quote}</p>
  {citation && <footer>— {citation}</footer>}
</blockquote>

{allCss && <style set:html={allCss} is:global />}
```

Then register:

```ts
// src/components/index.ts
import Quote from "./Quote.astro";

export const blockComponents: Record<string, unknown> = {
  // …
  quote: Quote,
};
```

```astro
---
// src/components/BlockRenderer.astro
import Quote from "./Quote.astro";
---

{block.type === "quote" && (
  <Quote value={block.config} blockId={block.id} />
)}
```

That's it. Run `npm run lint && npm run typecheck && npm test && npm run build`. The block now appears in the LeftPanel palette (categorised by `def.category`), drops into containers, takes its Fields / Style / Advanced surfaces from the declarative pipeline, renders in the Canvas via the new preview, and renders on the frontend via the new Astro component.

### `BlockDef` reference

Defined in `src/admin/blockDefinitions.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `BlockType` | Discriminator. Must match an entry in the `BlockType` union (`src/types.ts`). |
| `label` | `string` | Human label shown in the LeftPanel palette and the RightPanel header. |
| `icon` | `string` | Single emoji or short string. Rendered as text in the palette / header. |
| `description` | `string` | One-line tagline shown under the header in the panel. |
| `category` | `"core" \| "general"` | Palette grouping. `core` is structural (container, html, divider-spacer); `general` is content. |
| `defaultConfig` | `Record<string, any>` | Initial `block.config` produced when the block is dropped on the canvas. Should mirror the per-block config interface. |
| `fields` | `FieldDef[]` | **@deprecated alias** — keep pointing at the same array as `fieldsTab` until F3.5.6+1 retires it. Existing callers (reducer ADD_BLOCK defaults, tests) still read `def.fields`. |
| `fieldsTab` | `FieldDef[]` | **Canonical Fields-tab schema.** Iterated by `TabRenderer` → `FieldRenderer`. Empty array → empty Fields tab. |
| `styleFields` | `FieldDef[]?` | **@deprecated alias** — folded into `styleTab` as a leading `kind: "custom"` entry when needed. New blocks should never set this. |
| `styleTab` | `StyleSection[]?` | **Canonical Style-tab schema.** Iterated by `TabRenderer` → `SectionRenderer`. Omitting the property entirely auto-hides the Style tab (used by `html`). |

Look-up helper: `getBlockDef(type: BlockType): BlockDef | undefined`. It aliases `fieldsTab` from `fields` for any def that omits the new key — so even legacy registrations expose `def.fieldsTab` to new consumers.

### `FieldDef` reference

Discriminated union. The `kind` property selects the variant; standard inputs may omit `kind` (defaults to `"standard"`).

#### `StandardFieldDef`

Use for simple input-driven fields. `FieldRenderer` dispatches on `field.type`:

| `type` | When to use | Required props | Writes to |
|--------|-------------|----------------|-----------|
| `text` | Single-line string (titles, identifiers) | `key`, `label` | `block.config[key]: string` |
| `url` | URL string with browser validation | `key`, `label` | `block.config[key]: string` |
| `textarea` | Multi-line string (captions, body copy) | `key`, `label` | `block.config[key]: string` |
| `number` | Numeric scalar | `key`, `label` | `block.config[key]: number` |
| `select` | Constrained string choice | `key`, `label`, `options: Array<{value, label}>` | `block.config[key]: string` |
| `toggle` | Boolean switch | `key`, `label` | `block.config[key]: boolean` |
| `link` | URL + newTab + nofollow + custom attrs | `key`, `label` | `block.config[key]: { href, newTab, nofollow, customAttr }` |
| `json-array` | Repeating list of sub-records | `key`, `label`, `itemFields: FieldDef[]` (sub-fields must be `StandardFieldDef`) | `block.config[key]: any[]` |
| `rich-text` | Portable Text body (lazy editor) | `key`, `label` | `block.config[key]: PortableTextBlock[]` |
| `code` | Code editor (html / css / js) | `key`, `label`, `language?: "html" \| "css" \| "js"` | `block.config[key]: string` |
| `number-units` | Number with unit picker (px/rem/em/%/vh/vw/deg/turn) | `key`, `label`, `units?: string[]` | `block.config[key]: string` (e.g. `"24px"`) |
| `icon-group` | Icon picker (src / size / color / shadow / position) | `key`, `label`, `showPosition?: boolean` | `block.config[key]: IconGroupValue` |

Optional props on every `StandardFieldDef`:

- `placeholder?: string` — input placeholder text.
- `required?: boolean` — visual asterisk; not enforced at save.
- `labelClassName?: string` — set to `"epx-row-label--section"` to match the rest of the panel (label-left, control-right with bg + border + reset). DO NOT skip this for normal fields — it's the standard styling, not a special variant.
- `showWhen?: { key: string; value: string }` — conditional render. The Fields-tab dispatcher in `TabRenderer.tsx` filters fields whose `showWhen` doesn't match the current `block.config`.

#### `CustomFieldDef`

Escape hatch for Fields-tab content that doesn't fit the standard input shape (e.g. `container`'s `LayoutControl + GapControl + OverflowControl + HTML tag + LinkControl` group). Use SPARINGLY — prefer composing standard fields when possible.

```ts
interface CustomFieldDef {
  kind: "custom";
  key: string;                                // stable React key
  render: (props: FieldRenderProps) => ReactNode;
  showWhen?: { key: string; value: string };
}

interface FieldRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}
```

Custom Fields renderers handle their own breakpoint routing (read/write `configBreakpoints[bpId]` and `styleBreakpoints[bpId]`). They dispatch `onChange` patches that merge into `block.config`. See `src/admin/right-panel/sections/ContainerLayoutPicker.tsx`, `VideoFieldsSection.tsx`, `LinkFieldsSection.tsx`, `TextFieldsExtras.tsx`, `TextEditorFieldsSection.tsx`, `ImageFieldsSection.tsx` for working examples.

`JsonArrayField` filters out `kind: "custom"` entries from `itemFields` — sub-fields inside a JSON-array item must be `StandardFieldDef`.

### `StyleSection` reference

Discriminated union driving the Style tab. Each variant maps to one branch in `src/admin/right-panel/SectionRenderer.tsx`:

| `kind` | Renders | File | Notes |
|--------|---------|------|-------|
| `theme` | `ThemeStyleToggle` (Light / Dark / Accent) | `controls/ThemeStyleToggle.tsx` | Avoid declaring this leading a `background` section — `BackgroundSection` already includes the toggle inline (F3.5.6 follow-up Bug 2). |
| `spacing` | Padding / Margin `SpacingControl` pair | `right-panel/sections/BpAwareStyleSections.tsx` | Optional `targets?: ("padding" \| "margin")[]` to restrict. |
| `background` | Normal/Hover toggle + `ThemeStyleToggle` + `BackgroundControl` | `right-panel/sections/BackgroundSection.tsx` | Optional `modes?: BackgroundMode[]` (= `BackgroundType[]`) to restrict. |
| `border` | Normal/Hover toggle + `BorderControl` | `right-panel/sections/StatefulStyleSection.tsx` | |
| `borderRadius` | Normal/Hover toggle + `BorderRadiusControl` | `right-panel/sections/StatefulStyleSection.tsx` | |
| `boxShadow` | Normal/Hover toggle + `BoxShadowControl` | `right-panel/sections/StatefulStyleSection.tsx` | |
| `typography` | `TypographyControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` | Optional `props?: TypographyProp[]` (= `keyof TypographyValue`) to restrict. Subset filter is reserved — currently renders the full stack. |
| `textStroke` | `TextStrokeControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` | |
| `textShadow` | `TextShadowControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` | |
| `alignment` | `AlignControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` | Writes `style.textAlign`. |
| `blendMode` | `BlendModeControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` | |
| `filter` | `CssFiltersControl` (blur/brightness/contrast/saturate/hue/grayscale/sepia/invert) | `right-panel/sections/BpAwareStyleSections.tsx` | |
| `overflow` | `OverflowControl` (overflow-x / overflow-y) | `right-panel/sections/BpAwareStyleSections.tsx` | |
| `opacity` | Normal/Hover toggle + `NumberRow` | `right-panel/sections/OpacitySection.tsx` | Image-only today; reusable. |
| `imgVisual` | Width / Height / Object Fit / Object Position / Align | `right-panel/sections/ImgVisualSection.tsx` | Image-only — writes to `block.config.imgStyle.*`, not `style.*`. |
| `videoSource` | Aspect ratio (with custom W/H) + `CssFiltersControl` | `right-panel/sections/VideoSourceSection.tsx` | Video-only. |
| `iconGroup` | `IconGroup` reading `block.config.icon` | `controls/IconGroup.tsx` | Reserved for future icon/button/divider Style-tab pickers. |
| `dividerLine` | Full divider-line picker (style/width/length/color/gradient/align/IconGroup) | `right-panel/sections/DividerLineSection.tsx` | Used today by `divider-spacer` declared via `kind: "custom"`. |
| `custom` | `section.render({ block, onChange, activeBreakpoint })` | declared per-block in `blockDefinitions.ts` | Escape hatch — see below. |

`SectionRenderer.tsx` ends each switch with `assertNever(section)` so adding a new variant to the `StyleSection` union forces a TypeScript error here until you add a matching case.

### Worked example — adding a `quote` block

Hypothetical `quote` block: a blockquote with optional citation. Goal — three file touches plus the `BlockType` proposal.

#### Pre-step (orchestrator) — extend `BlockType` in `src/types.ts`

Append a proposal to `.claude/coordination/types-proposals.md` with the new union member and a draft `QuoteConfig` interface. Wait for the orchestrator's type PR. Once merged:

```ts
// src/types.ts (orchestrator-owned)
export type BlockType =
  | "container" | "text" | "image" | "text-editor" | "video"
  | "button" | "icon" | "html" | "divider-spacer"
  | "quote"; // ← new

export interface QuoteConfig extends BaseBlockConfig {
  quote?: string;
  citation?: string;
}
```

Now the rest is admin + frontend work.

#### File touch 1 — `src/admin/blockDefinitions.ts`

```ts
const QUOTE_FIELDS: FieldDef[] = [
  { key: "quote", label: "Quote", type: "textarea", placeholder: "Enter quote…", labelClassName: "epx-row-label--section" },
  { key: "citation", label: "Citation", type: "text", placeholder: "Author or source", labelClassName: "epx-row-label--section" },
];

// inside BLOCK_DEFINITIONS:
{
  type: "quote",
  label: "Quote",
  icon: "❝",
  description: "A blockquote with optional citation",
  category: "general",
  defaultConfig: { quote: "", citation: "", theme: "light" },
  fields: QUOTE_FIELDS,
  fieldsTab: QUOTE_FIELDS,
  styleTab: [
    { kind: "alignment" },
    { kind: "typography" },
    { kind: "background" },
    { kind: "borderRadius" },
    { kind: "border" },
    { kind: "boxShadow" },
  ],
},
```

#### File touch 2 — preview component

```tsx
// src/admin/previews/QuotePreview.tsx
import React, { memo } from "react";

export const QuotePreview = memo(function QuotePreview({ config }: { config: Record<string, unknown> }) {
  const quote = (config.quote as string) || "";
  const citation = (config.citation as string) || "";
  if (!quote) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Quote block</span>;
  }
  return (
    <blockquote style={{ margin: 0, fontStyle: "italic" }}>
      <p style={{ margin: 0 }}>{quote}</p>
      {citation && <footer style={{ marginTop: 6, fontStyle: "normal", fontSize: 12, opacity: 0.7 }}>— {citation}</footer>}
    </blockquote>
  );
});
```

```ts
// src/admin/previews/index.ts (one-line addition)
import { QuotePreview } from "./QuotePreview.js";

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  // …
  quote: QuotePreview as React.ComponentType<PreviewProps>,
};
```

#### File touch 3 — Astro frontend component

```astro
---
// src/components/Quote.astro
import { buildBlockChromeCss } from "./styleUtils.js";
import { resolveMediaUrl } from "./media.js";

interface Props {
  value: { quote?: string; citation?: string; theme?: "light" | "dark" } & Record<string, unknown>;
  blockId?: string;
}

const { value, blockId } = Astro.props;
const { quote = "", citation = "" } = value;

const advanced = (value as Record<string, unknown>).advanced as Record<string, string> | undefined;
const cssId      = advanced?.cssId      || undefined;
const cssClasses = advanced?.cssClasses || undefined;

const config = value as Record<string, unknown>;
const resolver = (key: string) => resolveMediaUrl(key, { locals: Astro.locals });
const allCss = buildBlockChromeCss(config, blockId, { resolveMediaUrl: resolver });
---

<blockquote
  data-epx-block={blockId || undefined}
  id={cssId}
  class={cssClasses || undefined}
>
  <p>{quote}</p>
  {citation && <footer>— {citation}</footer>}
</blockquote>

{allCss && <style set:html={allCss} is:global />}
```

```ts
// src/components/index.ts (one-line addition)
import Quote from "./Quote.astro";

export const blockComponents: Record<string, unknown> = {
  // …
  quote: Quote,
};
```

```astro
---
// src/components/BlockRenderer.astro (one branch)
import Quote from "./Quote.astro";
---

{block.type === "quote" && (
  <Quote value={block.config} blockId={block.id} />
)}
```

That's everything. Run the pipeline (`npm run lint && npm run typecheck && npm test && npm run build`). The new block:

- Appears in the LeftPanel palette under "general" with the `❝` icon.
- Drops into containers (root-allowed list is `container` / `html` / `divider-spacer` only — see `isRootAllowedType` in `src/types.ts`; non-root leaves go inside containers).
- Renders `quote` and `citation` text inputs in the Fields tab (auto-styled with section labels because `labelClassName` is set).
- Renders Alignment / Typography / Background / Border Radius / Border / Box Shadow in the Style tab via `SectionRenderer`.
- Renders the universal Width / Height / Padding / Margin / Position / Z-Index / CSS ID / CSS Classes / Custom CSS in the Advanced tab via `AdvancedTab`.
- Reflects edits live on the Canvas via `QuotePreview`.
- Renders to the frontend via `Quote.astro` with `data-epx-block` scoping, `cssId` / `cssClasses` honored, and the chrome CSS bundle injected.

No edits to `RightPanel.tsx`, `SectionRenderer.tsx`, `TabRenderer.tsx`, or `AdvancedTab.tsx`.

### What NOT to touch

Adding a new block should NEVER require editing these files. If you find yourself needing to, stop and reconsider — chances are the existing schema covers your case via a `kind: "custom"` entry, or you're missing a default in `defaultConfig`.

| File | Why off-limits |
|------|----------------|
| `src/admin/RightPanel.tsx` | Thin shell only — header + tab dispatch + unknown-block placeholder. Has no per-block branching. The only reasons to edit it are top-shell concerns (header chrome, breakpoint indicator, hover toggle) — not block additions. |
| `src/admin/right-panel/SectionRenderer.tsx` | Pure dispatch on `StyleSection.kind`. Add a new variant ONLY when introducing a new type of Style section that's reusable across multiple blocks (rare) — otherwise use `kind: "custom"` from the BlockDef. |
| `src/admin/right-panel/TabRenderer.tsx` | Tab visibility + Fields/Style/Advanced dispatch. Driven by `getVisibleTabs(block)` which reads only from `BlockDef`. |
| `src/admin/right-panel/AdvancedTab.tsx` | Universal — every block uses the same Advanced tab. There is no per-block branching here, by design. If a block needs different Advanced behavior, that's an architecture conversation, not a block-author task. |
| `src/admin/right-panel/sections/*` | Existing custom renderers. Only add a new file here when introducing a NEW reusable `kind: "custom"` renderer that multiple blocks can share — and put it in `right-panel/sections/`, not inline in `blockDefinitions.ts`. Single-block custom renderers can live there too if they're complex; very small ones can be defined inline in the BlockDef. |
| `src/types.ts` | Orchestrator-owned. Append to `.claude/coordination/types-proposals.md` and wait for the type PR — never edit directly from an agent branch. |

### Custom-section escape hatch

When the existing `StyleSection` kinds don't fit (or when a Fields-tab UI doesn't compose from the standard FieldDef types), use the `kind: "custom"` entry. There's a Style-tab variant on `StyleSection` and a Fields-tab variant on `FieldDef` (introduced in F3.5.6). Both take a `render` prop that receives the panel's `block` / `onChange` / `activeBreakpoint` context.

```ts
// Style-tab custom — mounted by SectionRenderer
{
  kind: "custom",
  render: ({ block, onChange, activeBreakpoint }: SectionRenderProps) => {
    // Read block.config; write back via onChange. Handle bp routing
    // yourself — write to style on desktop, styleBreakpoints[bp] otherwise.
    return <YourCustomStyleSection block={block} onChange={onChange} bp={activeBreakpoint} />;
  },
}

// Fields-tab custom — mounted by FieldRenderer (via TabRenderer's customCtx)
{
  kind: "custom",
  key: "my-bespoke-fields",  // stable React key
  render: ({ block, onChange, activeBreakpoint }: FieldRenderProps) => {
    return <YourCustomFieldsSection block={block} onChange={onChange} bp={activeBreakpoint} />;
  },
}
```

`SectionRenderProps` and `FieldRenderProps` are structurally identical:

```ts
interface SectionRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}

interface FieldRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}
```

The two names exist to advertise intent at the call site (Style vs Fields). A renderer can be reused on either tab if the shape is right.

Place the custom component in `src/admin/right-panel/sections/<MyBlock><Section\|Fields>.tsx` so it's discoverable next to existing examples (`ContainerLayoutPicker`, `VideoFieldsSection`, `DividerLineSection`, etc.). Import it into `blockDefinitions.ts` and reference it from the `render` prop. Don't inline 200-line components inside the BlockDef — keep `blockDefinitions.ts` declarative.

## Adding a New Block — TL;DR (legacy short list)

1. Add `BlockType` literal + per-block `*Config` interface to `src/types.ts` (orchestrator PR).
2. Add `BlockDef` to `BLOCK_DEFINITIONS` in `src/admin/blockDefinitions.ts`.
3. Add preview component in `src/admin/previews/<NewBlock>Preview.tsx` and register in `previews/index.ts`.
4. Add Astro component in `src/components/<NewBlock>.astro`, register in `components/index.ts`, and add a dispatch branch in `BlockRenderer.astro`.

See [Adding a new block type — author guide (F3.5.8)](#adding-a-new-block-type--author-guide-f358) above for the full recipe.

## Blocks To Add

| Block | Category | Key fields |
|-------|----------|------------|
| `hero` | general | headline, subheadline, ctaLabel, ctaUrl, backgroundImage |
| `features-grid` | general | headline, items (icon, title, description) |
| `image-text` | general | headline, body, image, imagePosition |
| `cta` | general | headline, subheadline, ctaLabel, ctaUrl |
| `stats` | general | headline, items (label, value) |
| `gallery` | general | images (src, alt, caption) |
| `columns` | core | columnCount, slots |
| `heading` | core | text, level (h1-h6), align |
| `paragraph` | core | text, align |

## TODO

- [x] Add `rich-text` field type (Portable Text editor) — v0.6
- [x] Add `code` field type (CodeEditor for HTML/CSS/JS) — v0.6
- [x] Add `number-units` field type (NumberWithUnits) — v0.6
- [x] Add `icon-group` field type (IconGroup) — v0.6
- [x] Add `text-editor`, `video`, `button`, `icon`, `html`, `divider-spacer` block types — v0.6
- [ ] Add generic `image` field type to FieldDef (wires MediaPicker for non-image blocks)
- [ ] Consider block categories: core / general / experimental
