# empixel-builder — Documentation Index

Detailed PRDs split by subsystem. Start here to understand the plugin architecture.

## Quick Links

| Module | File | Purpose |
|--------|------|---------|
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
│ (Palette +   │  (Tree Rendering +      │  (Fields / Style /        │
│  Breakpoints)│   BlockOverlay)         │   Advanced + LayerTree)   │
└──────────────┼─────────────────────────┼───────────────────────────┘
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
       │   Database (SQLite)              │
       │   empixel_builder_layouts        │
       │   (collection + entry_id PK)     │
       └─────────────────────────────────┘
                    ↑
       ┌──────────────────────────────────┐
       │  Frontend (Astro Pages)          │
       │  LayoutRenderer → BlockRenderer  │
       │  → Individual block components   │
       └──────────────────────────────────┘
```

## Data Flow

### Editing
1. Builder mounts → `GET /layout?pageId=&collection=` + `GET /breakpoints`
2. User drags block from LeftPanel → Canvas dispatches `ADD_TO_CONTAINER` or `INSERT_AFTER`
3. User selects block → `SELECT` action → RightPanel shows block properties
4. User edits config → `UPDATE_BLOCK` action
5. Style/hover/breakpoint changes → `UPDATE_BLOCK` with nested config patch
6. User saves → `POST /layout` + (if dirty) `POST /breakpoints`

### Rendering
1. Astro page calls `getBuilderLayout(entryId, collection)` → queries SQLite
2. Page renders `<LayoutRenderer sections={layout.sections} />`
3. LayoutRenderer iterates sections — containers go to `SectionContainer.astro`, leaves to `BlockRenderer.astro`
4. `BlockRenderer` dispatches leaves (testimonials/faq/pricing/spacer/text/image) by `block.type`
5. Each component builds CSS via `buildBlockCss` / `buildHoverCss` / `buildBreakpointCss` / `getCustomCss` and injects it as a global `<style>` tag, with `[data-epx-block="<id>"]` selectors

## Key Concepts

### SectionBlock (Tree Node)
```ts
{
  id: string;                            // UUID
  type: BlockType;                       // "container", "testimonials", etc.
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
  defaultConfig: {};
  fields: FieldDef[];
  styleFields?: FieldDef[];
}
```

### Config Key Conventions
| Key | Type | Purpose |
|-----|------|---------|
| `theme` | "light"\|"dark"\|"accent" | Active theme |
| `style` | CSSProps | Desktop + light-theme styles |
| `styleDark` | CSSProps | Dark-theme overrides |
| `styleAccent` | CSSProps | Accent-theme overrides |
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
│  │  ├─ ThemeStyleToggle.tsx
│  │  ├─ AlignControl.tsx
│  │  ├─ TypographyControl.tsx
│  │  ├─ TextStrokeControl.tsx
│  │  ├─ TextShadowControl.tsx
│  │  ├─ BlendModeControl.tsx
│  │  └─ FieldRow.tsx
│  │
│  ├─ fields/                            # Field renderers
│  │  ├─ FieldRenderer.tsx
│  │  ├─ JsonArrayField.tsx
│  │  └─ PageBuilderField.tsx
│  │
│  └─ previews/                          # Live preview components
│     ├─ index.ts                        # PREVIEW_COMPONENTS export
│     ├─ TestimonialsPreview.tsx
│     ├─ FaqPreview.tsx
│     ├─ PricingPreview.tsx
│     ├─ ContainerPreview.tsx
│     ├─ SpacerPreview.tsx
│     ├─ TextPreview.tsx
│     └─ ImagePreview.tsx
│
└─ components/                           # Frontend (Astro)
   ├─ index.ts                           # Exports + blockComponents map
   ├─ BlockRenderer.astro                # Leaf block dispatcher
   ├─ LayoutRenderer.astro               # Root layout renderer
   ├─ SectionContainer.astro             # container block (recursive)
   ├─ BuilderWrapper.astro               # Builder-page wrapper
   ├─ styleUtils.ts                      # CSS generation (selector-based)
   ├─ db.ts                              # getBuilderLayout()
   ├─ Testimonials.astro
   ├─ FaqSection.astro
   ├─ PricingSection.astro
   ├─ SpacerSection.astro
   ├─ Text.astro
   └─ Image.astro
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
- Accent-theme rendering on frontend (`styleAccent` via `data-theme="accent"` selector)
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
| Block | A page element (container, testimonials, etc.) |
| Layout | Serialized tree of SectionBlocks for one page |
| SectionBlock | In-memory block (id, type, config, children, slots) |
| BlockDef | Schema definition (fields, defaults, label, icon) |
| Canvas | The drag-drop editor area |
| Preview | Live React component showing block in admin UI |
| Component | Astro server-rendered component for frontend |
| Config | Block-specific settings + style + advanced |
| Breakpoint | Responsive viewport width preset |
| StructurePanel | Layer tree showing block hierarchy |
