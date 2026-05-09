# empixel-builder — Block System

## Role
Define all block types, their configuration schemas, and metadata. Single source of truth for editor UI and frontend rendering.

## ⚠️ Status (v0.6) — manual QA pending

All 9 blocks (container, text, image, text-editor, video, button, icon, html, divider-spacer) and their canvas previews + frontend Astro components require **manual testing and improvement**:

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
- **F3.5.1** (this PR) — types added, no instances migrated
- **F3.5.2** — 9 BlockDef instances populate `fieldsTab` + `styleTab` directly
- **F3.5.3 + .4** — `SectionRenderer.tsx` + `TabRenderer.tsx` consume the declarative lists
- **F3.5.6** — `RightPanel.tsx` drops imperative branches; `fields` / `styleFields` removed

### FieldDef interface
```ts
interface FieldDef {
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
```

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
  | "divider-spacer"; // v0.6 (replaces "spacer")
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
- `theme` — "light" | "dark"
- `style` — CSS properties for normal/light state
- `styleDark` — CSS properties for dark theme
- `styleHover` — CSS properties for hover state
- `styleBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` breakpoint overrides
- `styleHoverBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` hover breakpoint overrides
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

## Adding a New Block

1. Add `BlockType` to union in `src/types.ts`
2. Add config interface to `src/types.ts`
3. Add `BlockDef` entry to `BLOCK_DEFINITIONS` in `blockDefinitions.ts`
4. Add preview component in `src/admin/previews/`
5. Register in `src/admin/previews/index.ts` (`PREVIEW_COMPONENTS` map)
6. Add Astro component in `src/components/`
7. Register in `src/components/index.ts` (`blockComponents` map)
8. Register in `src/components/BlockRenderer.astro`

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
