# empixel-builder — PRD (Master)

Drag-and-drop page builder plugin for EmDash. Users visually compose pages using pre-built blocks. Layouts stored as JSON in SQLite, rendered via Astro components.

**Documentation split by subsystem** — See [prd-index.md](prd-index.md) for full architecture.

## At a Glance

| Component | Tech | Files | Status |
|-----------|------|-------|--------|
| Backend | Node.js + SQLite | `src/plugin.ts` | ✅ Done (6 routes + migration) |
| Block System | TypeScript | `src/types.ts`, `blockDefinitions.ts` | ✅ 12 blocks defined |
| Admin UI | React + @dnd-kit | `src/admin/` | ✅ Done |
| Previews | React | `src/admin/previews/` | ✅ 12 preview components |
| Frontend | Astro | `src/components/` | ✅ 12 block components + dispatcher |
| RightPanel | React | `src/admin/RightPanel.tsx` + controls | ✅ Done |
| Breakpoints | React + Astro | `BreakpointSwitcher.tsx` + `styleUtils.ts` | ✅ Done (admin + frontend) |

## Current State (v0.6.0)

### Completed
✅ 3-panel builder UI with drag-drop (`@dnd-kit`)
✅ Theme toggle (light/dark/system)
✅ Styling controls: ColorPicker, SpacingControl, BorderControl, BorderRadiusControl, BoxShadowControl, BackgroundControl, GapControl, LayoutControl, OverflowControl, LinkControl
✅ Typography controls (Text block): AlignControl, TypographyControl, TextStrokeControl, TextShadowControl, BlendModeControl
✅ SQLite persistence (composite PK: collection + entry_id)
✅ Auto-cleanup on entry delete (hook)
✅ CLI install script
✅ Settings page (enable/disable per entry)
✅ Tree utilities (findPath, findBlockById, insert, remove, update, deepClone, isDescendant)
✅ 7 Astro frontend block components (incl. Text.astro, Image.astro)
✅ RightPanel with 3 tabs (Fields, Style, Advanced)
✅ Responsive breakpoints (6 presets, live canvas resize, per-breakpoint style overrides)
✅ Breakpoint media-query rendering on frontend (`buildBreakpointCss`, `buildBreakpointHoverCss`)
✅ Hover CSS rendering on frontend (`:hover` selector via `buildHoverCss`)
✅ Dark-theme CSS rendering on frontend (`styleDark` merged via `getEffectiveStyle`)
✅ Custom CSS injection per block (scoped to `[data-epx-block="<id>"]`)
✅ Background CSS: color, gradient, image, slideshow, video (HTML5 / YouTube / Vimeo)
✅ Image-scoped visual CSS (border / radius / shadow on inner `<img>` for image blocks)
✅ MediaPicker wired into image block (Fields tab) and Background image picker
✅ StructurePanel (layer tree, collapsible, drag-drop reorder)
✅ ContextMenu (right-click: copy, paste, duplicate, copy settings, paste settings, delete)
✅ Block clipboard (copy full block, paste, copy settings, paste settings)
✅ Hover state styling (normal/hover toggle per control: background, radius, border, shadow, opacity)
✅ ThemeStyleToggle (light/dark/accent per block)
✅ HTML Tag selector for container + text blocks (text supports h1–h6, span, div, a)
✅ Link controls (href, new-tab, nofollow, custom attrs) for `<a>` containers + text + image blocks
✅ Duplicate block action
✅ DragGhost custom overlay
✅ Resizable panels (left, right, structure — drag handles)
✅ Back warning modal (unsaved changes)
✅ ToastContainer for save/error feedback
✅ Canvas width preview for non-desktop breakpoints

### In Progress
🟢 Block definitions (12 defined: testimonials, faq, pricing, container, text, image, text-editor, video, button, icon, html, divider-spacer)
🟢 Preview components (12)
🟢 Frontend Astro components (12 + LayoutRenderer + BlockRenderer + SectionContainer)

### Not Started
⬜ Undo/Redo stack (no UNDO action in reducer)
⬜ Block search/filter in LeftPanel
⬜ Additional block types (hero, features-grid, image-text, cta, stats, gallery, columns)
⬜ Accent-theme rendering on frontend (`styleAccent` parsed in editor but not rendered)

## Block Inventory

**Defined in types.ts + blockDefinitions.ts (12):**
- testimonials, faq, pricing, container, text, image
- **text-editor, video, button, icon, html, divider-spacer** (added in v0.6)

**Preview components (12):**
- TestimonialsPreview, FaqPreview, PricingPreview, ContainerPreview, TextPreview, ImagePreview
- TextEditorPreview, VideoPreview, ButtonPreview, IconPreview, HtmlPreview, DividerSpacerPreview

**Frontend Astro components (12 + 3 infra):**
- Testimonials.astro, FaqSection.astro, PricingSection.astro, Text.astro, Image.astro, SectionContainer.astro
- TextEditor.astro, Video.astro, Button.astro, Icon.astro, Html.astro, DividerSpacer.astro
- LayoutRenderer.astro (root renderer), BlockRenderer.astro (leaf dispatcher), BuilderWrapper.astro

**Removed in v0.6:**
- `spacer` BlockType (replaced by `divider-spacer`; one-time DB migration runs on plugin init)
- SpacerPreview.tsx, SpacerSection.astro, SpacerConfig type

**To add:**
- hero, features-grid, image-text, cta, stats, gallery, columns
- heading, paragraph

## Detailed Docs

- **[prd-backend.md](prd-backend.md)** — API routes, database, hooks
- **[prd-blocks.md](prd-blocks.md)** — Block types, BlockDef schema, type interfaces
- **[prd-builder-ui.md](prd-builder-ui.md)** — Builder, Canvas, state reducer, tree ops
- **[prd-rightpanel.md](prd-rightpanel.md)** — Controls, field renderers, hover states, breakpoints
- **[prd-frontend.md](prd-frontend.md)** — Astro components, BlockRenderer, rendering flow
- **[prd-previews.md](prd-previews.md)** — Live preview components, PREVIEW_MAP
- **[prd-breakpoints.md](prd-breakpoints.md)** — Breakpoint system, canvas resize, per-bp overrides

**Start here:** [prd-index.md](prd-index.md)

## Next Priorities

1. **Add block definitions** — hero, features-grid, image-text, cta, stats, gallery, columns
2. **Create preview components** — 1:1 with new block definitions
3. **Create Astro frontend components** — 1:1 with new block definitions
4. **Undo/Redo** — UNDO action + history stack in reducer + topbar buttons
5. **Accent theme frontend rendering** — extend `getEffectiveStyle` to merge `styleAccent` via `data-theme="accent"` selector
6. **Generic image FieldDef type** — wire MediaPicker into FieldRenderer for non-image blocks (image-group already covers icons)

## v0.6+ Highlights — recent updates

- **Per-breakpoint config keys** (non-style fields) — new `block.config.configBreakpoints[bpId]` map. First user: `text-editor` (dropCap / columns / columnsCustom / columnsGap). Frontend + canvas emit per-bp media queries by walking the union of `configBreakpoints` + `styleBreakpoints`. Previews accept `activeBreakpoint` via PreviewProps.
- **Breakpoint indicator convention** — bp-aware controls render the icon next to the label on every breakpoint (desktop included), as a sibling of the label span (not nested).
- **HTML block isolation** — sandboxed iframe (`allow-scripts allow-same-origin`, `scrolling="no"`) with auto-resize via direct DOM read. Iframe collapsed to 0 before measure to neutralize `vh`/100% body feedback. Iframe IS the `data-epx-block` element. Style tab hidden for HTML blocks.
- **Text Editor block** — full Portable Text rendering on frontend (via `emdash/ui` PortableText) and canvas (mini React renderer). Image inserts in PortableText render through custom `components.type.image` ([PortableTextImage.astro](src/components/PortableTextImage.astro)). PortableTextEditor (admin) wrapped in `<I18nProvider>` from `@lingui/react` so the host's `useLingui()` hook resolves.
- **Custom CSS support on canvas** — Canvas walks the tree (`collectCustomCss`) and injects a global `<style>` element. `getCustomCss` substitutes the keyword `selector` with `[data-epx-block="<id>"]`. Bare declarations auto-wrap as `selector{...}`. Editor header label says `selector`. Autocomplete includes `selector` in CSS mode.
- **CodeEditor** — single textarea (no overlay highlight); auto-grows to content; outer scroll handled by panel. Autocomplete dropdown with arrow-key + Enter + mouse selection. HTML mode gets tag/attr suggestions.
- **Position absolute/fixed/sticky** stays inside canvas — `.epx-canvas__list` has `position: relative; transform: translateZ(0)`.
- **Resize handle smoothness** — rAF coalescing + `body.epx-resizing` class disables inner pointer events during drag (HTML iframes were freezing cursor).
- **SelectRow** extended: `leftAddon`, `onLabelMouseDown`, ReactNode option labels, custom value gets pen-icon styling. Dropdowns portal to body with `position: fixed` + flip-up detection.
- **Toggle field** renders as switch (`epx-toggle` track + thumb) inside FieldGroup.
- **Field convention** — every text/url/textarea/number/select/toggle field should set `labelClassName: "epx-row-label--section"` so it gets the standard label-left + bg/border row layout. Reuse `FieldGroup` + existing row primitives.
- **Text shadow** default color `#000000` (was inheriting currentColor).
- **Canvas previews** receive `activeBreakpoint`.

## v0.6 Highlights

- 6 new block types: `text-editor` (Portable Text rich text), `video` (YouTube/Vimeo/HTML5 with image overlay), `button`, `icon`, `html` (raw markup), `divider-spacer` (replaces `spacer`)
- 4 new `FieldDef.type` values: `rich-text`, `code`, `number-units`, `icon-group`
- 6 new shared controls in `controls/`: `NumberWithUnits`, `ColorNormalHover`, `IconGroup`, `CssFiltersControl`, `VideoSourceControl`, `CodeEditor`
- TypographyControl now exposes `linkColor`
- One-time data migration: legacy `spacer` rows → `divider-spacer` (KV-style flag in `empixel_builder_meta`)
- `@emdash-cms/admin` declared as optional peerDep for `PortableTextEditor` reuse
