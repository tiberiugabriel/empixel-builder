# empixel-builder — Documentation Index

Detailed PRDs split by subsystem. Start here to understand the plugin architecture.

## Quick Links

| Module | File | Purpose |
|--------|------|---------|
| **Adding a new block type** | [prd-blocks.md → author guide](prd-blocks.md#adding-a-new-block-type--author-guide-f358) | 3-step recipe: BlockDef + preview + Astro component (no RightPanel.tsx edit) |
| **Backend/API** | [prd-backend.md](prd-backend.md) | REST routes, database schema, KV storage |
| **Block System** | [prd-blocks.md](prd-blocks.md) | Block types, BlockDef schema, config interfaces |
| **Admin Builder UI** | [prd-builder-ui.md](prd-builder-ui.md) | Builder, Canvas, state reducer, panels, tree ops |
| **RightPanel Controls** | [prd-rightpanel.md](prd-rightpanel.md) | Field renderers, styling controls, hover states |
| **Frontend Components** | [prd-frontend.md](prd-frontend.md) | Astro components, rendering, DB queries |
| **Block Previews** | [prd-previews.md](prd-previews.md) | Live preview system, PREVIEW_COMPONENTS map |
| **Breakpoints** | [prd-breakpoints.md](prd-breakpoints.md) | Breakpoint system, canvas resize, per-bp styles |

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       Admin UI (Builder.tsx)                       │
├──────────────┬─────────────────────────┬───────────────────────────┤
│  LeftPanel   │  Canvas (@dnd-kit)      │  RightPanel + Structure   │
│ (Palette +   │  (Tree Rendering +      │  (thin shell — declares   │
│  Breakpoints)│   BlockOverlay)         │   header + TabRenderer)   │
└──────────────┼─────────────────────────┼───────────────────────────┘
                         ↓                          ↓
                                 ┌─────────────────────────────┐
                                 │ TabRenderer (Fields/Style/  │
                                 │ Advanced) reads BlockDef    │
                                 │  → FieldRenderer            │
                                 │  → SectionRenderer          │
                                 │  → AdvancedTab (universal)  │
                                 └─────────────────────────────┘
                         ↓
       ┌──────────────────────────────────┐
       │   State (builderReducer.ts)      │
       │   sections tree + dirty flags    │
       └────────────┬─────────────────────┘
                    ↓
       ┌──────────────────────────────────┐
       │   Backend API (plugin.ts)        │
       │   /layout /breakpoints /entries  │
       │   /collections /settings /toggle │
       └────────────┬─────────────────────┘
                    ↓
       ┌──────────────────────────────────┐
       │   Storage (ctx.storage.layouts)  │
       │   _plugin_storage table          │
       │   plugin_id="empixel-builder"    │
       └─────────────────────────────────┘
                    ↑
       ┌──────────────────────────────────┐
       │  Frontend (Astro Pages)          │
       │  LayoutRenderer → BlockRenderer  │
       │  → Individual block components   │
       └──────────────────────────────────┘
```

The right-panel is fully declarative post-F3.5.6: every Fields / Style / Advanced surface renders from `BlockDef.fieldsTab` / `styleTab` data plus a universal Advanced tab. Adding a new block does NOT require editing `RightPanel.tsx` or any of the render-side files (`TabRenderer.tsx`, `SectionRenderer.tsx`, `AdvancedTab.tsx`). See [the block-author guide](prd-blocks.md#adding-a-new-block-type--author-guide-f358).

## Data Flow

### Editing
1. Builder mounts → `GET /layout?pageId=&collection=` + `GET /breakpoints`
2. User drags block from LeftPanel → Canvas dispatches `ADD_TO_CONTAINER` or `INSERT_AFTER`
3. User selects block → `SELECT` action → RightPanel shows block properties
4. User edits config → `UPDATE_BLOCK` action
5. Style/hover/breakpoint changes → `UPDATE_BLOCK` with nested config patch
6. User saves → `POST /layout` + (if dirty) `POST /breakpoints`

### Rendering
1. Astro page calls `getBuilderLayout(collection, entryId, enabled?)` → queries SQLite, returns `{ sections, cacheHint }` (v0.8 — F2.4)
2. Page renders `<BuilderWrapper sections={builderLayout}>` (auto-plumbs `Astro.cache.set(cacheHint)`) or destructures + calls set manually then renders `<LayoutRenderer sections={sections} />`
3. LayoutRenderer iterates sections — containers go to `SectionContainer.astro`, leaves to `BlockRenderer.astro`
4. `BlockRenderer` dispatches leaves (text/image/text-editor/video/button/icon/html/divider-spacer) by `block.type`
5. Each component builds CSS via `buildBlockCss` / `buildHoverCss` / `buildBreakpointCss` / `getCustomCss` and injects it as a global `<style>` tag, with `[data-epx-block="<id>"]` selectors

## Key Concepts

### SectionBlock (Tree Node)
```ts
{
  id: string;                            // UUID
  type: BlockType;                       // "container", "text", "image", etc.
  config: Record<string, any>;           // All block settings
  children?: SectionBlock[];             // Container: nested blocks
  slots?: SectionBlock[][];             // Columns: slot arrays
}
```

### BlockDef (Schema)
```ts
{
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  defaultConfig: Record<string, any>;
  // F3.5 declarative tabs (canonical):
  fieldsTab?: FieldDef[];      // FieldDef = StandardFieldDef | CustomFieldDef
  styleTab?: StyleSection[];   // 19 variants (theme/spacing/background/.../custom)
  // F3.5 transitional aliases (kept until F3.5.6+1):
  fields: FieldDef[];          // @deprecated — must point at the same array as fieldsTab
  styleFields?: FieldDef[];    // @deprecated — folded into styleTab
}
```

The full reference (every field, every `FieldDef.type`, every `StyleSection.kind`) lives in [`prd-blocks.md`](prd-blocks.md).

### Config Key Conventions
| Key | Type | Purpose |
|-----|------|---------|
| `theme` | "light"\|"dark" | Active theme |
| `style` | CSSProps | Desktop + light-theme styles |
| `styleDark` | CSSProps | Dark-theme overrides |
| `styleHover` | CSSProps | Hover state styles |
| `styleBreakpoints` | `{ [bpId]: {_px, ...CSSProps} }` | Per-breakpoint overrides |
| `styleHoverBreakpoints` | `{ [bpId]: {_px, ...CSSProps} }` | Hover per-breakpoint |
| `advanced` | AdvancedConfig | Position, z-index, CSS ID/class, custom CSS |
| `htmlTag` | string | Semantic HTML element (container only) |

### State (builderReducer.ts)
```ts
type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};
```

### Reducer Actions
ADD_BLOCK, UPDATE_BLOCK, REMOVE_BLOCK, REORDER, SELECT,
SAVE_START/SUCCESS/ERROR, LOAD_START/SUCCESS/ERROR,
ADD_TO_CONTAINER, MOVE_BLOCK, REORDER_IN_CONTAINER,
INSERT_AFTER, DUPLICATE_BLOCK, PASTE_SETTINGS

## File Organization

```
src/
├─ index.ts                              # Plugin descriptor
├─ plugin.ts                             # Routes + hooks (6 routes)
├─ types.ts                              # TypeScript interfaces + BreakpointDefs
├─ add.js                                # CLI install script
│
├─ admin/                                # Builder UI (React)
│  ├─ index.tsx                          # Plugin page entry
│  ├─ BuilderPage.tsx                    # Loader → Builder or SettingsPage
│  ├─ Canvas.tsx                         # @dnd-kit canvas
│  ├─ LeftPanel.tsx                      # Block palette + breakpoints config
│  ├─ RightPanel.tsx                     # Properties editor (3 tabs)
│  ├─ StructurePanel.tsx                 # Layer tree (collapsible)
│  ├─ BlockOverlay.tsx                   # Hover/selection feedback
│  ├─ ContextMenu.tsx                    # Right-click menu
│  ├─ SettingsPage.tsx                   # Per-entry enable/disable
│  ├─ blockDefinitions.ts                # Block schemas (source of truth)
│  ├─ treeUtils.ts                       # Tree operations (immutable)
│  ├─ epxVars.ts                         # CSS custom properties map
│  │
│  ├─ builder/                           # Builder core (extracted from BuilderPage)
│  │  ├─ Builder.tsx                     # Main orchestrator
│  │  ├─ builderReducer.ts              # Pure reducer + State/Action types
│  │  └─ BuilderStyles.tsx              # CSS injection
│  │
│  ├─ components/                        # Shared UI components
│  │  ├─ ThemeToggle.tsx
│  │  ├─ BreakpointSwitcher.tsx
│  │  ├─ BreakpointIcons.tsx
│  │  ├─ DragGhost.tsx
│  │  └─ ToastContainer.tsx
│  │
│  ├─ controls/                          # Styling/property controls
│  │  ├─ ColorPicker.tsx
│  │  ├─ SpacingControl.tsx
│  │  ├─ BorderRadiusControl.tsx
│  │  ├─ BorderControl.tsx
│  │  ├─ BoxShadowControl.tsx
│  │  ├─ BackgroundControl.tsx
│  │  ├─ GapControl.tsx
│  │  ├─ LayoutControl.tsx
│  │  ├─ OverflowControl.tsx
│  │  ├─ LinkControl.tsx
│  │  ├─ MediaPicker.tsx
│  │  ├─ ImagePreviewCard.tsx
│  │  ├─ ThemeStyleToggle.tsx
│  │  ├─ AlignControl.tsx
│  │  ├─ TypographyControl.tsx          # adds linkColor (v0.6)
│  │  ├─ TextStrokeControl.tsx
│  │  ├─ TextShadowControl.tsx
│  │  ├─ BlendModeControl.tsx
│  │  ├─ FieldRow.tsx
│  │  ├─ NumberWithUnits.tsx             # v0.6 — labeled number+unit standalone
│  │  ├─ ColorNormalHover.tsx            # v0.6 — color picker w/ Normal/Hover toggle
│  │  ├─ IconGroup.tsx                   # v0.6 — collapsible icon picker (src/size/color/shadow/pos)
│  │  ├─ CssFiltersControl.tsx           # v0.6 — CSS filters (blur/brightness/contrast/etc.)
│  │  ├─ VideoSourceControl.tsx          # v0.6 — extracted video sub-mode + provider auto-detect
│  │  └─ CodeEditor.tsx                  # v0.6 — html/css/js editor w/ token-coloring + autocomplete
│  │
│  ├─ fields/                            # Field renderers
│  │  ├─ FieldRenderer.tsx              # dispatches: rich-text, code, number-units, icon-group (v0.6)
│  │  ├─ JsonArrayField.tsx
│  │  ├─ PageBuilderField.tsx
│  │  └─ RichTextField.tsx               # v0.6 — wraps @emdash-cms/admin PortableTextEditor (lazy)
│  │
│  └─ previews/                          # Live preview components
│     ├─ index.ts                        # PREVIEW_COMPONENTS export (10 entries)
│     ├─ ContainerPreview.tsx
│     ├─ TextPreview.tsx
│     ├─ ImagePreview.tsx
│     ├─ TextEditorPreview.tsx           # v0.6
│     ├─ VideoPreview.tsx                # v0.6
│     ├─ ButtonPreview.tsx               # v0.6
│     ├─ IconPreview.tsx                 # v0.6
│     ├─ HtmlPreview.tsx                 # v0.6
│     ├─ DividerSpacerPreview.tsx        # v0.6
│     └─ FieldBindingPreview.tsx         # F4.4 — bound/unbound badge
│
└─ components/                           # Frontend (Astro)
   ├─ index.ts                           # Exports + blockComponents map (9 entries: every leaf, container goes through SectionContainer)
   ├─ BlockRenderer.astro                # Leaf block dispatcher (9 leaves)
   ├─ LayoutRenderer.astro               # Root layout renderer
   ├─ SectionContainer.astro             # container block (recursive)
   ├─ BuilderWrapper.astro               # Builder-page wrapper
   ├─ styleUtils.ts                      # CSS generation (selector-based; aspectRatio + filter added v0.6)
   ├─ db.ts                              # getBuilderLayout()
   ├─ Text.astro
   ├─ Image.astro
   ├─ TextEditor.astro                   # v0.6 — Portable Text via emdash/ui
   ├─ Video.astro                        # v0.6 — YT/Vimeo/HTML5 + overlay click-to-play
   ├─ Button.astro                       # v0.6 — <a> | <button>
   ├─ Icon.astro                         # v0.6 — SVG mask color or <img> for PNG
   ├─ Html.astro                         # v0.6 — raw set:html (trusted input)
   ├─ DividerSpacer.astro                # v0.6 — space + optional divider line / icon
   └─ FieldBinding.astro                 # F4.4 — reads entry.data[config.field]
```

## Roadmap

### Immediate (complete block coverage)
1. Add BlockDef + type interface for: hero, features-grid, image-text, cta, stats, gallery, columns
2. Create preview component per new block
3. Create Astro component per new block
4. Add generic `image` FieldDef type (wire MediaPicker into FieldRenderer for non-image blocks)

### Short-term
- Undo/Redo (UNDO action + history stack + topbar buttons)
- Rich-text field type (Portable Text)
- Block search/filter in LeftPanel

### Done (was on roadmap)
- ✅ Breakpoint media-query rendering (`buildBreakpointCss` / `buildBreakpointHoverCss`)
- ✅ Hover CSS rendering (`buildHoverCss`)
- ✅ Dark theme CSS (`styleDark` via `getEffectiveStyle`)
- ✅ `text` and `image` blocks (with typography stack and image-scoped visual CSS)

### Later
- Layout templates/presets
- Export/import layouts
- Version history / audit trail
- Collaborative editing

## Terms

| Term | Definition |
|------|-----------|
| Block | A page element (container, text, image, button, etc.) |
| Layout | Serialized tree of SectionBlocks for one page |
| SectionBlock | In-memory block (id, type, config, children, slots) |
| BlockDef | Schema definition (fields, defaults, label, icon) |
| Canvas | The drag-drop editor area |
| Preview | Live React component showing block in admin UI |
| Component | Astro server-rendered component for frontend |
| Config | Block-specific settings + style + advanced |
| Breakpoint | Responsive viewport width preset |
| StructurePanel | Layer tree showing block hierarchy |
