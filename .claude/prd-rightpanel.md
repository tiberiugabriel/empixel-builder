# empixel-builder — RightPanel Controls & Fields

## Role
Reusable UI components for editing block properties: fields, controls, and styling inputs.

## Convention — breakpoint indicator
Any bp-aware control MUST show the `breakpointIndicator` next to its label on every breakpoint, including `desktop`. Pass `breakpointIndicator={breakpointIndicator}` unconditionally — do NOT gate on `isNonDesktop`. The icon doubles as a "this control is bp-aware" affordance and indicates which breakpoint is currently being edited. Controls that are NOT bp-aware (e.g. `htmlTag`, link fields, plain config-level metadata) must omit the indicator.

## F3.5 — Block Settings Standardization (in progress, 0.9.5 prep)

The 1671-LOC `RightPanel.tsx` today branches imperatively on `block.type` for the Style tab — 9 hardcoded forks across container/text/image/text-editor/video/button/icon/html/divider-spacer. F3.5 replaces this with a declarative `StyleSection[]` list per `BlockDef`.

| Step | Status | Scope |
|------|--------|-------|
| F3.5.1 | ✅ shipped (0.9.5 prep) | Add `StyleSection` discriminated union + optional `fieldsTab` / `styleTab` on `BlockDef`. Existing `fields` / `styleFields` kept as deprecated aliases. No instances migrated; no panel rewrite. |
| F3.5.2 | ✅ shipped (0.9.5 prep) | All 9 `BlockDef` entries populate `fieldsTab` + `styleTab`. Non-trivial Style logic extracted into `src/admin/right-panel/sections/`: `TextEditorDropCapSection.tsx` (paragraph spacing + drop cap), `VideoSourceSection.tsx` (aspect ratio + filter), `DividerLineSection.tsx` (full divider-line picker), `IconBlockStyleSection.tsx` (icon color/size/rotate). Imperative `block.type ===` branches in `RightPanel.tsx` stay in place — F3.5.6 deletes them. |
| F3.5.3 | ✅ shipped (0.9.5 prep) | `right-panel/SectionRenderer.tsx` — pure switch on `StyleSection.kind`, renders the matching control. 109 LOC, exhaustive via `assertNever`. Dispatcher added in this PR; wired into `RightPanel.tsx` by F3.5.6. |
| F3.5.4 | ✅ shipped (0.9.5 prep) | `right-panel/TabRenderer.tsx` — owns the 3-tab shell. Exports `getVisibleTabs(block)` (drives Style auto-hide for `html` and any block missing `styleTab`), the `TabRenderer` JSX component, and the `useAutoSelectTab(block, activeTab, setActiveTab)` hook. Body dispatches Fields → `<FieldRenderer>`, Style → `<SectionRenderer>`, Advanced → placeholder until F3.5.5. `RightPanel.tsx` unchanged; F3.5.6 owns the swap. |
| F3.5.5 | ✅ shipped (0.9.5 prep) | `right-panel/AdvancedTab.tsx` — extract universal Advanced tab. One component covers every block — no per-type branching. `TabRenderer` plugs it into the `advanced` case (replaces the F3.5.4 placeholder). |
| F3.5.6 | ⬜ planned | Drop imperative `block.type ===` branches in `RightPanel.tsx`; retire `fields` / `styleFields` aliases. |
| F3.5.7 | ⬜ planned | Code-split per-block panels (lazy import). |
| F3.5.8 | ⬜ planned | Polish + docs sweep. |

`SectionRenderProps` shape (passed to `kind: "custom"` renderers):

```ts
interface SectionRenderProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}
```

Mirrors the top-level `RightPanel` props so custom branches lift out unchanged. Custom renderers handle their own breakpoint routing (writes go to `style.*` or `styleBreakpoints[bpId].*` based on `activeBreakpoint`).

The 19 `StyleSection` variants and the `BackgroundMode` / `TypographyProp` aliases are documented in [prd-blocks.md](prd-blocks.md#stylesection-declarative-style-tab--f351). `BackgroundMode` aliases the existing `BackgroundType` union from `controls/BackgroundControl.tsx`; `TypographyProp` is `keyof TypographyValue` from `controls/TypographyControl.tsx` — neither forks a new shape.

### F3.5.3 — `SectionRenderer` dispatcher map

`src/admin/right-panel/SectionRenderer.tsx` is the pure switch added by F3.5.3. Each `StyleSection.kind` lands in exactly one branch that wraps the matching control (or one of the extracted `right-panel/sections/*` files). No business logic, no imperative `block.type` checks — the dispatcher is fed by the `BlockDef.styleTab` declared on each block. F3.5.6 wires it into `RightPanel.tsx`'s Style tab and deletes the legacy `block.type ===` branches.

| `StyleSection.kind` | Renders | File |
|---|---|---|
| `theme` | `ThemeStyleToggle` (inline, 1-liner) | `controls/ThemeStyleToggle.tsx` |
| `spacing` | Padding/Margin `SpacingControl` pair | `right-panel/sections/BpAwareStyleSections.tsx` |
| `background` | Normal/Hover toggle + `ThemeStyleToggle` + `BackgroundControl` | `right-panel/sections/BackgroundSection.tsx` |
| `border` | Normal/Hover toggle + `BorderControl` | `right-panel/sections/StatefulStyleSection.tsx` |
| `borderRadius` | Normal/Hover toggle + `BorderRadiusControl` | `right-panel/sections/StatefulStyleSection.tsx` |
| `boxShadow` | Normal/Hover toggle + `BoxShadowControl` | `right-panel/sections/StatefulStyleSection.tsx` |
| `typography` | `TypographyControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` |
| `textStroke` | `TextStrokeControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` |
| `textShadow` | `TextShadowControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` |
| `alignment` | `AlignControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` |
| `blendMode` | `BlendModeControl` (bp-aware) | `right-panel/sections/BpAwareStyleSections.tsx` |
| `filter` | `CssFiltersControl` | `right-panel/sections/BpAwareStyleSections.tsx` |
| `overflow` | `OverflowControl` | `right-panel/sections/BpAwareStyleSections.tsx` |
| `opacity` | Normal/Hover toggle + `NumberRow` (image-only) | `right-panel/sections/OpacitySection.tsx` |
| `imgVisual` | Width/Height/Fit/Position/Align (image-only) | `right-panel/sections/ImgVisualSection.tsx` |
| `videoSource` | Aspect ratio + `CssFiltersControl` (video-only) | `right-panel/sections/VideoSourceSection.tsx` |
| `iconGroup` | `IconGroup` reading `block.config.icon` | `controls/IconGroup.tsx` |
| `dividerLine` | Full divider-line picker (style/width/length/color/gradient/align/IconGroup) | `right-panel/sections/DividerLineSection.tsx` |
| `custom` | `section.render({ block, onChange, activeBreakpoint })` | declared per-block in `blockDefinitions.ts` |

### F3.5.4 — `TabRenderer` + `getVisibleTabs(block)`

`src/admin/right-panel/TabRenderer.tsx` owns the 3-tab shell (Fields / Style / Advanced) for the new declarative path. Replaces the hardcoded `hideStyleTab = block.type === "html"` branch in `RightPanel.tsx`. The visible tab set is computed by `getVisibleTabs(block)` from the matching `BlockDef`:

| Tab | Visible when |
|---|---|
| Fields | `def.fieldsTab` (or back-compat `def.fields`) is declared. Empty arrays still render the tab — `container` and `video` keep their block-specific Fields content in legacy imperative branches until F3.5.6's Fields-tab `kind: "custom"` hook lands. |
| Style | `def.styleTab` is declared and non-empty. Hidden for `html` (which legitimately omits `styleTab`) and for any block whose def is missing. |
| Advanced | Always. Universal CSS ID / classes / custom CSS / position / z-index controls — F3.5.5 fills in the real `<AdvancedTab />`; F3.5.4 ships a placeholder body. |

`getVisibleTabs` matrix for the 9 blocks:

| Block | Visible tabs |
|---|---|
| `text` / `image` / `text-editor` / `video` / `button` / `icon` / `divider-spacer` / `container` | `["fields", "style", "advanced"]` |
| `html` | `["fields", "advanced"]` |
| unknown (no def) | `["fields", "advanced"]` |

Body dispatch:
- Fields tab — iterate `def.fieldsTab ?? def.fields`, filter by `field.showWhen`, render via `<FieldRenderer>`. The map anticipates a future `kind: "custom"` field type (mirrors the Style-tab equivalent) without committing to it today.
- Style tab — iterate `def.styleTab` and render each entry via the F3.5.3 `<SectionRenderer>`.
- Advanced tab — `<div data-testid="advanced-placeholder">Advanced tab — F3.5.5</div>`. F3.5.5 ships the real renderer.

The module also exports `useAutoSelectTab(block, activeTab, setActiveTab)`. Effect: when `block.type` changes, if `activeTab` is no longer in `getVisibleTabs(block)`, snap to the first visible tab. Only depends on `block.type` so the hook does not fire on every config edit. F3.5.6 imports it from `RightPanel.tsx` as a one-line replacement for today's `if (hideStyleTab && activeTab === "style") setActiveTab("fields")` block.

`RightPanel.tsx` is unchanged in F3.5.4 — the imperative `block.type ===` branches and the existing `activeTab` state both stay put. F3.5.6 swaps the panel onto `<TabRenderer />` (and `useAutoSelectTab`) in a single PR.

### F3.5.5 — universal `<AdvancedTab />` component

`src/admin/right-panel/AdvancedTab.tsx` is the universal Advanced-tab body. **One component renders the Advanced tab identically for every block type** — there is no `block.type ===` branching anywhere in the Advanced surface, and no per-block customization. The audit confirmed the inline JSX in `RightPanel.tsx` was already block-agnostic; F3.5.5 simply lifts it out.

```ts
interface AdvancedTabProps {
  block: SectionBlock;
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId | null;
}

export function AdvancedTab(props: AdvancedTabProps): ReactNode;
```

Universal rule: a new block type does not need to declare anything for the Advanced tab. As long as the Advanced controls write through `block.config.advanced` (`AdvancedConfig`) and `block.config.style.*`, the same component works.

Field surface (top to bottom, identical for all 9 block types):

| Field | Control | Stored in | Patch shape |
|---|---|---|---|
| Width (Fix / Min / Max) | `DimensionControl` | `block.config.style.{width\|minWidth\|maxWidth}` | `{ style }` |
| Height (Fix / Min / Max) | `DimensionControl` | `block.config.style.{height\|minHeight\|maxHeight}` | `{ style }` |
| Padding (T/R/B/L) | `SpacingControl` | `block.config.style.padding{Top\|Right\|Bottom\|Left}` | `{ style }` |
| Margin (T/R/B/L) | `SpacingControl` | `block.config.style.margin{Top\|Right\|Bottom\|Left}` | `{ style }` |
| Position | `SelectRow` (Default / Relative / Absolute / Fixed / Sticky) | `block.config.advanced.position` | `{ advanced }` |
| Offset (T/R/B/L) | `SpacingControl` (forceExpanded, **only when `position` is non-empty**) | `block.config.advanced.{top\|right\|bottom\|left}` | `{ advanced }` |
| Z-Index | `NumberRow` | `block.config.advanced.zIndex` | `{ advanced }` |
| CSS ID | `TextRow` | `block.config.advanced.cssId` | `{ advanced }` |
| CSS Classes | `TextRow` | `block.config.advanced.cssClasses` | `{ advanced }` |
| Custom CSS | `CodeEditor` (`language="css"`, `selectorHeader="[data-epx-block=\"<id>\"]"`) | `block.config.advanced.customCss` | `{ advanced }` |

Dispatch shape:
- `{ advanced }` patches go through `writeAdvanced({ ...advanced, ...patch })` so partial edits preserve the unchanged keys (e.g. typing in CSS ID never wipes `cssClasses`).
- `{ style }` patches go through `{ ...style, ...patch }` so the same merge guarantee applies for Width/Height/Padding/Margin.
- `activeBreakpoint` is currently unused — Advanced fields write to base `style` regardless of the active breakpoint, matching the legacy inline behavior. The prop stays in the signature for symmetry with `<TabRenderer />` and any future breakpoint-aware extension.

Wiring: `TabRenderer.tsx`'s `case "advanced":` now returns `<AdvancedTab block={block} onChange={onChange} activeBreakpoint={activeBreakpoint} />`. The F3.5.4 placeholder is gone. `RightPanel.tsx` still owns its inline `AdvancedTab` function until F3.5.6 swaps the panel over to `<TabRenderer />`.

## Architecture

```
RightPanel.tsx (3 tabs: Fields, Style, Advanced)         # 1671 LOC
├─ right-panel/                                          # audit M1, conservative slice
│  ├─ icons.tsx           # IconFields, IconStyle, IconAdvanced, IconStateNormal, IconStateHover
│  ├─ types.ts            # AdvancedConfig — admin-only shape for `config.advanced`
│  ├─ SectionRenderer.tsx # F3.5.3 — pure dispatcher on `StyleSection.kind` (Style tab)
│  ├─ TabRenderer.tsx     # F3.5.4 — 3-tab shell + getVisibleTabs / useAutoSelectTab
│  ├─ AdvancedTab.tsx     # F3.5.5 — universal Advanced tab (Width/Height/Padding/Margin/Position/Z-Index/CSS ID/Classes/Custom CSS)
│  └─ sections/           # F3.5.2 — extracted custom Style-tab renderers
├─ fields/
│  ├─ FieldRenderer.tsx         # Generic field dispatcher (12 types)
│  ├─ JsonArrayField.tsx        # Expandable item list
│  ├─ PageBuilderField.tsx      # Drag-drop layout field
│  └─ RichTextField.tsx         # v0.6 — wraps @emdash-cms/admin PortableTextEditor (lazy)
└─ controls/
   ├─ ColorPicker.tsx
   ├─ SpacingControl.tsx        # Padding / Margin / Offset
   ├─ BorderRadiusControl.tsx
   ├─ BorderControl.tsx
   ├─ BoxShadowControl.tsx      # Box shadow (x, y, blur, spread, color, inset)
   ├─ BackgroundControl.tsx     # Color / gradient / image / slideshow / video
   ├─ GapControl.tsx            # Column + row gap
   ├─ LayoutControl.tsx         # Flex/Grid layout properties
   ├─ OverflowControl.tsx       # Overflow x/y
   ├─ LinkControl.tsx           # href, newTab, nofollow, customAttr
   ├─ MediaPicker.tsx           # Image/media picker (wired to image block + Background)
   ├─ ImagePreviewCard.tsx      # Full-width image preview card (Select / Change / Remove)
   ├─ ThemeStyleToggle.tsx      # Light / Dark / Accent theme selector
   ├─ AlignControl.tsx          # Text-align (start/center/end/justify) — Text block
   ├─ TypographyControl.tsx     # Font + linkColor (v0.6) — Text/Text-Editor/Button blocks
   ├─ TextStrokeControl.tsx     # -webkit-text-stroke-width / -color — Text block
   ├─ TextShadowControl.tsx     # text-shadow X/Y/Blur/Color — Text/Text-Editor blocks
   ├─ BlendModeControl.tsx      # mix-blend-mode — Text block
   ├─ FieldRow.tsx              # NumberRow, TextRow, SelectRow, DimensionControl, IconButtonRow, FieldGroup
   ├─ NumberWithUnits.tsx       # v0.6 — labeled number+unit standalone (px/rem/em/%/vh/vw/deg/turn)
   ├─ ColorNormalHover.tsx      # v0.6 — ColorPicker + Normal/Hover toggle
   ├─ IconGroup.tsx             # v0.6 — collapsible icon picker (src/size/color/shadow/position)
   ├─ CssFiltersControl.tsx     # v0.6 — blur/brightness/contrast/saturate/hue-rotate/grayscale/sepia/invert
   ├─ VideoSourceControl.tsx    # v0.6 — Media|URL toggle, provider auto-detect, per-provider params
   └─ CodeEditor.tsx            # v0.6 — html/css/js mode, regex token-coloring, HTML autocomplete (extracted from RightPanel inline)
```

## Tabs

### Tab 1: Fields
Block-specific content from `def.fields[]`.
- Uses `FieldRenderer` to dispatch each field type
- **Container** adds: LayoutControl, GapControl, OverflowControl, HTML Tag, LinkControl (if tag = "a")
- **Text** adds: HTML Tag selector (default `p`, supports h1–h6, span, div, a), LinkControl (if tag = "a")
- **Image** adds: `ImagePreviewCard` (full-width preview, filename below, Change + Remove buttons; opens MediaPicker on Select/Change), Resolution selector, LinkControl (always)

### Tab 2: Style — default (non-text, non-image)
Visual styling. Each section has a **Normal / Hover state toggle** (IconStateNormal / IconStateHover).

| Section | Controls | State toggle |
|---------|----------|--------------|
| Background | BackgroundControl + ThemeStyleToggle | ✅ Normal/Hover |
| Border Radius | BorderRadiusControl | ✅ Normal/Hover |
| Border | BorderControl | ✅ Normal/Hover |
| Box Shadow | BoxShadowControl | ✅ Normal/Hover |

### Tab 2: Style — text block
Custom typography stack (no Background / Radius / Border / Shadow sections):
- AlignControl
- TypographyControl
- TextStrokeControl
- TextShadowControl
- BlendModeControl

All write to `block.config.style.*` (or breakpoint overrides when active BP ≠ desktop).

### Tab 2: Style — text-editor block (v0.6)
Custom branch — no Background/Border/Shadow:
- AlignControl
- TypographyControl (with linkColor)
- TextShadowControl
- ParagraphSpacing (NumberWithUnits) → writes `style.paragraphSpacing` → `[data-epx-block] p+p { margin-top }`
- DropCap group (collapsible, when `dropCap=true`): Size / Lines / Margin Right (all NumberWithUnits) → emit scoped `::first-letter` rules in TextEditor.astro

### Tab 2: Style — video block (v0.6)
- AspectRatio (1:1/3:2/4:3/16:9/21:9/9:16/custom W+H)
- CssFiltersControl

### Tab 2: Style — button block (v0.6)
Default branch with TypographyControl prepended (Background, BorderRadius, Border, Shadow follow).

### Tab 2: Style — icon block (v0.6)
Custom branch — no Background:
- AlignControl (writes `style.textAlign` → flex justify-content via wrapper)
- ColorNormalHover (writes `style.iconColor`/`styleHover.iconColor`; SVG-only via mask, PNG ignored with admin note)
- Size (NumberWithUnits) — writes `style.iconBlockSize`
- Rotate (NumberWithUnits with deg/turn units, allowNegative)

### Tab 2: Style — html / divider-spacer (v0.6)
No Style tab — placeholder text "All settings for this block are in the Fields tab.". All knobs live in Fields.

### Tab 2: Style — image block
Image-element styling (no Background section; border/radius/shadow target inner `<img>`):
- DimensionControl Width/Height (writes to `block.config.imgStyle.*`)
- Object Fit (`imgStyle.objectFit`)
- Object Position (`imgStyle.objectPosition`)
- Align (writes `style.textAlign` → frame uses `justify-content` mapping)
- Opacity (with Normal/Hover toggle)
- Border Radius / Border / Box Shadow sections still appear and target the inner `<img>` via `buildImgVisualCss` on the frontend

Hover styles are written to `block.config.styleHover`.
Theme styles are written to `block.config.style` / `block.config.styleDark` via `getThemeStyleKey(theme)`.
Breakpoint styles are written to `block.config.styleBreakpoints[bpId]` / `block.config.styleHoverBreakpoints[bpId]`.

### Tab 3: Advanced
Layout & positioning. **No** Normal/Hover toggle here.

| Control | Stored in |
|---------|-----------|
| DimensionControl (Width) | `block.config.style.width/minWidth/maxWidth` |
| DimensionControl (Height) | `block.config.style.height/minHeight/maxHeight` |
| SpacingControl (Padding) | `block.config.style.paddingTop/Right/Bottom/Left` |
| SpacingControl (Margin) | `block.config.style.marginTop/Right/Bottom/Left` |
| SelectRow (Position) | `block.config.advanced.position` |
| SpacingControl (Offset) | `block.config.advanced.top/right/bottom/left` |
| NumberRow (Z-Index) | `block.config.advanced.zIndex` |
| TextRow (CSS ID) | `block.config.advanced.cssId` |
| TextRow (CSS Classes) | `block.config.advanced.cssClasses` |
| CodeEditor (Custom CSS) | `block.config.advanced.customCss` |

## FieldRenderer (fields/FieldRenderer.tsx)

Routes `FieldDef.type` to appropriate input:

| type | Component | Value |
|------|-----------|-------|
| `text` | `<input type="text">` | string |
| `url` | `<input type="url">` | string |
| `textarea` | `<textarea rows=3>` | string |
| `number` | `<input type="number">` | number |
| `select` | `<select>` | string |
| `toggle` | checkbox + label | boolean |
| `json-array` | JsonArrayField | array |
| `link` | LinkControl | `{ href, newTab, nofollow, customAttr }` |
| `rich-text` | RichTextField (lazy `@emdash-cms/admin` `PortableTextEditor`) | Portable Text JSON array |
| `code` | CodeEditor (`language: html|css|js`) | string |
| `number-units` | NumberWithUnits | string (e.g. `"24px"`) |
| `icon-group` | IconGroup (`showPosition` prop) | IconGroupValue |

## JsonArrayField

Expandable list of items. Each item is a collapsible card with sub-fields from `itemFields`.
- Add / Remove item buttons
- Stores as JSON array in `block.config[key]`

## ColorPicker

Floating color picker:
- Hex/RGB/HSL format tabs
- Opacity slider
- Recent colors
- Format persisted alongside value

## SpacingControl

4-side spacing editor (Padding, Margin, Offset):

**Collapsed:** single scrub (all sides uniform). Shows "Mixed" if sides differ.
**Expanded:** 2×2 grid, each side has label + scrub input + unit (px, rem, %).

Props: `label`, `value: SpacingValue`, `onChange`, `sides`, `forceExpanded`

CSS key mapping:
- `padding` → `paddingTop/Right/Bottom/Left`
- `margin` → `marginTop/Right/Bottom/Left`
- `offset` → `top/right/bottom/left`

## BorderRadiusControl

Corner radius editor. Collapsed (single) / Expanded (2×2 corners).
Supports px, rem, %.
CSS keys: `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`.

Accepts `breakpointIndicator` prop (JSX icon shown in label when non-desktop breakpoint active).

## BorderControl

4-side border editor. Collapsed (single width) / Expanded (4 sides).
- Style dropdown: none / solid / dashed / dotted / double
- Color via ColorPicker
CSS keys: `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `borderStyle`, `borderColor`.

Accepts `breakpointIndicator` prop.

## BoxShadowControl

Box shadow editor:
- X offset, Y offset, Blur radius, Spread radius (each SideInput with unit)
- Color via ColorPicker
- Inset toggle
- Stored as CSS `box-shadow` string in `block.config.style.boxShadow` / `styleHover.boxShadow`

Accepts `breakpointIndicator` prop.

## BackgroundControl

- Solid color picker (ColorPicker, with alpha)
- Gradient editor (linear-gradient with multiple stops + angle)
- Image picker — `ImagePreviewCard` (full-width preview, filename below, Change + Remove buttons; opens MediaPicker on Select/Change) + size / position / repeat / attachment
- Slideshow (multiple images, frontend renders first slide as static background fallback)
- Video (HTML5 file via MediaPicker, YouTube URL, or Vimeo URL — with start/end time, loop, fallback poster, size, position)
- Opacity slider

`allowedTypes` prop: restricts to subset (e.g. hover state limited to `["color", "gradient", "image"]`).

Background config is serialized into `style.backgroundType` + per-type fields (`backgroundColor`, `backgroundGradStops`, `backgroundImageStorageKey`, `backgroundVideoSrc`, etc.) and consumed by `buildBackgroundCss` on the frontend.

## GapControl

Column + row gap for flex/grid containers.
- Single scrub (uniform) or expanded (column / row independently)
CSS keys: `columnGap`, `rowGap`

## LayoutControl

Flex/Grid layout properties for container blocks:
- Mode: flex or grid
- Flex: direction (row/column), wrap, align-items, justify-content
- Grid: grid-template-columns, grid-template-rows, grid-auto-flow, justify-items, align-items
- Accepts `breakpointIndicator` prop and writes to breakpoint overrides when non-desktop BP is active

## OverflowControl

Overflow x/y selector: visible / hidden / scroll / auto

## LinkControl

Link properties for `<a>` containers, text blocks (when tag = "a"), and image blocks:
- `linkHref` — URL text input
- `linkNewTab` — toggle (adds `target="_blank"` + `rel="noopener noreferrer"`)
- `linkNofollow` — toggle (adds `rel="nofollow"`)
- `linkCustomAttr` — comma-separated `key|value` pairs for custom attributes

Stored as flat keys on `block.config` (not under a nested `link` object).

## AlignControl
Text alignment selector (start / center / end / justify). Writes `textAlign`. Accepts `breakpointIndicator`.

## TypographyControl
Font properties:
- `fontFamily`, `fontSize`, `fontWeight`
- `lineHeight`, `letterSpacing`, `wordSpacing`
- `textTransform`, `fontStyle`, `textDecoration`
- Color (with alpha)

Writes to `style.*` (or breakpoint override when active).

## TextStrokeControl
- `textStrokeWidth` → `-webkit-text-stroke-width`
- `textStrokeColor` (+ alpha) → `-webkit-text-stroke-color`

## TextShadowControl
- `textShadowX`, `textShadowY`, `textShadowBlur`
- `textShadowColor` (+ alpha)

Combined into `text-shadow: X Y Blur Color` on frontend.

## BlendModeControl
Single select for `mixBlendMode` (normal / multiply / screen / overlay / etc.).

## ThemeStyleToggle

Segmented toggle: Light / Dark
Sets `block.config.theme` and determines which style key is written to:
- `"light"` → `style`
- `"dark"` → `styleDark`

## DimensionControl (FieldRow.tsx)

Width or Height editor with 3 sub-fields: Fix / Min / Max.
Each is a SideInput (scrub + number + unit).
Reset button clears all 3.

## FieldRow / FieldGroup

Wrappers for Advanced tab rows:
- `FieldGroup` — border + reset button, `isDirty` prop lightens label
- `NumberRow` — scrub label + number input
- `TextRow` — text input
- `SelectRow` — custom dropdown

## CodeEditor (controls/CodeEditor.tsx, v0.6)

Extracted from RightPanel.tsx inline editor; now reusable.

Props:
- `value`, `onChange`
- `language: "html" | "css" | "js"` (default `"css"`)
- `selectorHeader?: string` — when present, shows header with kw + selector + copy button
- `placeholder?`, `minHeight?` (default 140)

Features:
- Line numbers column (synced scroll with textarea)
- Tab key inserts 4 spaces
- Regex-based syntax highlighting (overlay div under transparent textarea)
- HTML mode: tag autocomplete after `<`, attribute autocomplete inside open tag (per-tag attr lists for a/img/input/form/button/iframe/video/audio/source/link/meta/script/label/td/th)
- Used by: Custom CSS in Advanced tab + `html` block's code field

## Hover State System

Each stateful control (Background, Radius, Border, Shadow) has its own `mode: "normal" | "hover"` local state.
- Mode resets to "normal" when selected block changes.
- Normal writes to base style key (or breakpoint overlay key).
- Hover writes to `styleHover` (or `styleHoverBreakpoints[bpId]`).

## Breakpoint-Aware Writes

When `activeBreakpoint !== "desktop"`:
- Style reads from merged `{ ...activeStyle, ...bpStyleRaw }` (base + breakpoint override)
- Writes go to `block.config.styleBreakpoints[bpId]` (includes `_px` for media query generation)
- Hover writes go to `block.config.styleHoverBreakpoints[bpId]`

See [prd-breakpoints.md](prd-breakpoints.md) for the full breakpoint architecture.

## Label Styling System

| Context | Class | Color | Uppercase |
|---------|-------|-------|-----------|
| Field label | `epx-field__label` | `--epx-text-faint` | no |
| Row label (scrub) | `epx-side-input__label--scrub` | faint | no |
| Section header | `epx-row-label--section` | faint | YES |
| Side label (T/R/B/L) | `epx-side-input__label` | faint | YES (9px) |

Dirty label: `color-mix(in srgb, var(--epx-text-faint), white 45%)`

## Props Summary

`RightPanel` receives:
- `block: SectionBlock | null`
- `onChange: (config: Record<string, any>) => void`
- `activeBreakpoint: BreakpointId`
- `breakpointsConfig: BreakpointsConfig`

## v0.6+ — control changes

- **`SelectRow` (FieldRow.tsx)** gained:
  - `leftAddon?: React.ReactNode` — content rendered between label and dropdown (e.g. number input shown when value === "custom"). Mirrors `SideInput`'s number+unit pattern.
  - `onLabelMouseDown?: (e) => void` — enable drag-scrub on the label.
  - Option `label` widened from `string` to `React.ReactNode` so options can render JSX (e.g. pen icon for "custom").
  - Internally `SelectDropdown` filters options where `value === "custom"` and renders them below an `epx-unit-dropdown__sep` line with `epx-unit-dropdown__item--pen` (centered icon styling).
- **`SelectDropdown` + `UnitDropdown`** portal-render to `document.body` with `position: fixed`, computing `top`/`left` from anchor `getBoundingClientRect()`. Flip up when `spaceBelow < panelHeight + 8 && r.top > panelHeight + 8`. Re-position on `scroll` (capture) + `resize`. `right: auto; width: max-content` overrides default CSS. Avoids clipping by Structure panel / RightPanel scroll.
- **Toggle field type** in `FieldRenderer` renders as switch (`<label class="epx-toggle">` with track + thumb) inside a `<FieldGroup>` wrapper (bg + border + reset). Replaces inline checkbox.
- **Inline custom rows** in text-editor block (Fields tab): Drop Cap (switch), Columns (SelectRow with custom pen + scrubable label), Columns Gap (SideInput inside FieldGroup). All bp-aware via `configBreakpoints`.
- **Per-control breakpoint indicator** is a sibling of the label span, not nested. Always visible (desktop included).
- **Custom CSS editor** keyword `selector` is substituted at render time with `[data-epx-block="<id>"]`; bare declarations get auto-wrapped in `selector{...}`. Header label fixed to `selector` (not `language`). Editor textarea auto-grows; outer scroll is the panel's.

## v0.6 Shared Controls

| Control | File | Used by |
|---------|------|---------|
| `NumberWithUnits` | `NumberWithUnits.tsx` | text-editor (paragraph spacing, columns gap, drop cap), video (custom aspect), icon (size, rotate), divider-spacer (space, divider width/length) |
| `ColorNormalHover` | `ColorNormalHover.tsx` | icon block (icon color) |
| `IconGroup` | `IconGroup.tsx` | video overlay, button, icon, divider-spacer (collapsible: src + size + color + drop-shadow + position) |
| `CssFiltersControl` | `CssFiltersControl.tsx` | video block (Style tab) |
| `VideoSourceControl` | `VideoSourceControl.tsx` | video block (Fields tab) — provider auto-detect (YT/Vimeo/HTML5), per-provider params (autoplay/mute/controls/captions/lazy/intro toggles/controls color) |
| `CodeEditor` | `CodeEditor.tsx` | html block (Fields tab, language="html"), Custom CSS in Advanced (language="css") |

## TODO

- [ ] Wire MediaPicker into FieldRenderer as a generic `image` field type (currently used inline only inside image block + Background)
- [ ] Keyboard shortcuts within controls (Escape to cancel, Enter to confirm)
- [x] Add rich-text field type (Portable Text editor) — v0.6
- [x] Add code field type (multi-language CodeEditor) — v0.6
