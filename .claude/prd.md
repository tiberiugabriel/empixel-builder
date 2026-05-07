# empixel-builder — PRD (Master)

Drag-and-drop page builder plugin for EmDash. Users visually compose pages using pre-built blocks. Layouts stored as JSON in SQLite, rendered via Astro components.

**Documentation split by subsystem** — See [prd-index.md](prd-index.md) for full architecture.

## At a Glance

| Component | Tech | Files | Status |
|-----------|------|-------|--------|
| Backend | Node.js + SQLite | `src/plugin.ts` | ✅ Done (6 routes) |
| Block System | TypeScript | `src/types.ts`, `blockDefinitions.ts` | 🟡 7 blocks defined |
| Admin UI | React + @dnd-kit | `src/admin/` | ✅ Done |
| Previews | React | `src/admin/previews/` | 🟡 7 preview components |
| Frontend | Astro | `src/components/` | 🟡 7 block components + dispatcher |
| RightPanel | React | `src/admin/RightPanel.tsx` + controls | ✅ Done |
| Breakpoints | React + Astro | `BreakpointSwitcher.tsx` + `styleUtils.ts` | ✅ Done (admin + frontend) |

## Current State (v0.5.0)

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
🟡 Block definitions (7 defined: testimonials, faq, pricing, container, spacer, text, image)
🟡 Preview components (7: same 7 as definitions)
🟡 Frontend Astro components (7 + LayoutRenderer + BlockRenderer + SectionContainer)

### Not Started
⬜ Undo/Redo stack (no UNDO action in reducer)
⬜ Rich-text field type (text block currently plain content + htmlTag)
⬜ Block search/filter in LeftPanel
⬜ Additional block types (hero, features-grid, image-text, cta, stats, gallery, columns)
⬜ Accent-theme rendering on frontend (`styleAccent` parsed in editor but not rendered)

## Block Inventory

**Defined in types.ts + blockDefinitions.ts (7):**
- testimonials, faq, pricing, container, spacer, text, image

**Preview components (7):**
- TestimonialsPreview, FaqPreview, PricingPreview, ContainerPreview, SpacerPreview, TextPreview, ImagePreview

**Frontend Astro components (7 + 3 infra):**
- Testimonials.astro, FaqSection.astro, PricingSection.astro, SpacerSection.astro, Text.astro, Image.astro, SectionContainer.astro
- LayoutRenderer.astro (root renderer), BlockRenderer.astro (leaf dispatcher), BuilderWrapper.astro

**To add:**
- hero, features-grid, image-text, cta, stats, gallery, columns
- heading, paragraph, rich-text, html

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
5. **Rich-text field type** — Portable Text / markdown editor
6. **Accent theme frontend rendering** — extend `getEffectiveStyle` to merge `styleAccent` via `data-theme="accent"` selector
7. **Generic image FieldDef type** — wire MediaPicker into FieldRenderer for non-image blocks
