# empixel-builder — Admin Builder UI

## Role
React-based drag-and-drop editor for composing page layouts. Three-panel orchestration with state management.

## Architecture

```
BuilderPage.tsx (loader + entry: renders Builder)
  └─ Builder.tsx (state + all orchestration)
       ├─ builderReducer.ts (pure reducer + state types)
       ├─ BuilderStyles.tsx (CSS-in-JS styles injected into head)
       ├─ Canvas.tsx (drag-drop + tree rendering)
       ├─ LeftPanel.tsx (block palette + breakpoints settings)
       ├─ RightPanel.tsx (properties editor — 3 tabs)
       ├─ StructurePanel.tsx (layer tree panel, collapsible, drag-drop)
       ├─ BlockOverlay.tsx (hover/select feedback)
       ├─ ContextMenu.tsx (right-click menu)
       └─ components/
            ├─ ThemeToggle.tsx
            ├─ BreakpointSwitcher.tsx
            ├─ BreakpointIcons.tsx
            ├─ DragGhost.tsx
            └─ ToastContainer.tsx
```

## Files
- `src/admin/BuilderPage.tsx` — Entry point: loads plugin, routes to Builder or SettingsPage
- `src/admin/builder/Builder.tsx` — Main orchestrator (state, DnD context, panels layout)
- `src/admin/builder/builderReducer.ts` — Pure reducer + State/Action types
- `src/admin/builder/BuilderStyles.tsx` — Injects CSS custom properties
- `src/admin/Canvas.tsx` — @dnd-kit canvas, renders block tree
- `src/admin/LeftPanel.tsx` — Block palette + breakpoints config UI
- `src/admin/RightPanel.tsx` — Properties editor (3 tabs: Fields, Style, Advanced)
- `src/admin/StructurePanel.tsx` — Layer tree, collapsible, drag-drop reorder
- `src/admin/BlockOverlay.tsx` — Hover/selection feedback
- `src/admin/ContextMenu.tsx` — Right-click context menu
- `src/admin/SettingsPage.tsx` — Per-entry enable/disable UI
- `src/admin/blockDefinitions.ts` — Block schemas (source of truth)
- `src/admin/treeUtils.ts` — Tree operations
- `src/admin/epxVars.ts` — CSS custom properties map

## State (builderReducer.ts)

### State shape
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

Note: **no undo/redo history stack** yet — that is a planned feature.

### Action types
| Action | Effect |
|--------|--------|
| `LOAD_START` | isLoading = true |
| `LOAD_SUCCESS` | sections loaded (each node's config backfilled via `getDefaultBlockConfig` — F3.6.2), isDirty = false |
| `LOAD_ERROR` | error set |
| `ADD_BLOCK` | append to sections root (config filled via `getDefaultBlockConfig` — F3.6.2) |
| `UPDATE_BLOCK` | merge config patch into block |
| `REMOVE_BLOCK` | remove from tree (deselects if selected) |
| `REORDER` | replace root sections array |
| `SELECT` | set selectedId |
| `SAVE_START` / `SAVE_SUCCESS` / `SAVE_ERROR` | isSaving/saveError |
| `ADD_TO_CONTAINER` | add block into container's children/slot (config filled — F3.6.2) |
| `MOVE_BLOCK` | remove from source, insertAtPath to target |
| `REORDER_IN_CONTAINER` | reorder within a container/slot |
| `INSERT_AFTER` | insert block after a given block id (config filled — F3.6.2) |
| `DUPLICATE_BLOCK` | deep-clone block, insert after original |
| `PASTE_SETTINGS` | merge clipboard config into target block |

### F3.6.2 — load-time + add-time config fill

Three reducer paths now route every freshly-instantiated block through
`getDefaultBlockConfig(type)` (exported from `blockDefinitions.ts`):

- **`ADD_BLOCK`** — `action.block.config` is deep-merged over the helper's
  return value. Action wins on overlap; missing keys (every `STYLE_PROPS`
  entry, every `EMPTY_ADVANCED_DEFAULTS` key, every top-level placeholder
  like `styleHover` / `styleBreakpoints`) are backfilled. Builder.tsx
  and `useDragHandlers.ts` shallow-spread `def.defaultConfig` when
  building the action — the reducer's fill catches anything that the
  callers' shallow spread missed (nested `style.*` keys especially).
- **`ADD_TO_CONTAINER`** + **`INSERT_AFTER`** — same fill semantics so
  every path that lands a fresh block in state ends up with a full-shape
  config. Keeps the contract uniform; future code reading
  `block.config.style.fontSize` never has to handle `undefined`.
- **`LOAD_SUCCESS`** — recursively walks `action.sections` (descending
  into `children` and `slots`) and backfills missing keys per node.
  Existing values are never overwritten. Legacy layouts saved before
  F3.6.1 / F3.6.2 upgrade transparently the first time the panel reads
  them — no migration job, just a load-time merge.

The fill is the foundation F3.6.3 builds on: with every key guaranteed
present, Canvas (`epxStyleString`) and frontend (`buildBlockChromeCss`)
can drop their defensive `?? ""` checks for style keys.

## State Lifecycle

1. Mount → fetch layout from API (`LOAD_START` → `LOAD_SUCCESS`)
2. Mount → fetch breakpoints config from API
3. User action → dispatch reducer
4. RightPanel onChange → `UPDATE_BLOCK`
5. Save → POST layout + (if dirty) POST breakpoints
6. `beforeunload` guard if `isDirty || isBreakpointsDirty`

## Builder.tsx — Local State

Beyond reducer state, Builder.tsx holds:

| State | Type | Purpose |
|-------|------|---------|
| `leftWidth / rightWidth` | number | Panel widths (drag resize) |
| `leftCollapsed / rightCollapsed` | boolean | Panel collapse |
| `structureHeight / structureCollapsed` | number/bool | Structure panel size |
| `overBlockId` | string \| null | Canvas drop hover target |
| `structureDropTarget` | StructureDropTarget | Structure panel drop indicator |
| `contextMenu` | { x, y, blockId } \| null | Active context menu |
| `clipboardBlock` | SectionBlock \| null | Copied full block |
| `clipboardSettings` | Record \| null | Copied block config |
| `activeBreakpoint` | BreakpointId | Current breakpoint view |
| `liveCanvasWidth` | number \| null | Real-time canvas width during resize |
| `breakpointsConfig` | BreakpointsConfig | Enabled BPs + px overrides |
| `isBreakpointsDirty` | boolean | Unsaved breakpoint changes |
| `showBackWarning` | boolean | Unsaved-changes modal |

## Canvas

### Drag-Drop Flow (@dnd-kit)
Three drag kinds:
1. `kind: "new-block"` — dragged from LeftPanel palette
2. `kind: "block"` — existing block reorder within canvas
3. `kind: "structure-block"` — drag within StructurePanel

Drop targets:
- `CANVAS_DROP_ID` — canvas background (only containers allowed at top level)
- `kind: "empty-zone"` — empty zone inside container/slot
- `kind: "block"` — existing block (insert after or move into container)

On drop → dispatches ADD_BLOCK, ADD_TO_CONTAINER, INSERT_AFTER, MOVE_BLOCK, REORDER, or REORDER_IN_CONTAINER.

### Canvas features
- Resizable via drag handles on left + right edges (double-click to collapse)
- Preview width constraint for non-desktop breakpoints (CSS max-width on inner wrapper)
- Live width display in topbar when resizing non-desktop breakpoint

## LeftPanel

- Lists BLOCK_DEFINITIONS grouped by category
- Each block card is a `useDraggable` source
- Click-to-add via `onAddBlock` callback (adds to selected container or root if container)
- Bottom section: breakpoints configuration (toggle on/off, px override)

## RightPanel

See [prd-rightpanel.md](prd-rightpanel.md) for full details.

Three tabs:
- **Fields** — Block-specific content fields from `def.fields[]` (container adds layout/gap/overflow/htmlTag; text adds htmlTag + link; image adds MediaPicker + resolution + link)
- **Style** — Background/Radius/Border/Shadow (each with Normal/Hover toggle) for most blocks; **text** swaps to Align/Typography/TextStroke/TextShadow/BlendMode; **image** swaps to dimension/object-fit/object-position/align/opacity (with hover) and scopes border/radius/shadow to inner `<img>`
- **Advanced** — Width/Height, Padding, Margin, Position, Offset, Z-Index, CSS ID/Classes, Custom CSS

Receives `activeBreakpoint` and `breakpointsConfig` props for per-breakpoint style writes.

## StructurePanel

Layer tree showing the full sections tree:
- Collapsible (toggle button, persists height via drag handle)
- Shows block icon + label for each block
- Click → select block
- Right-click → context menu
- Drag rows to reorder (`kind: "structure-block"`)
- Drop indicator shows before/after/inside position

## ContextMenu

Right-click menu on any block (canvas or structure panel):
- Edit (select block)
- Duplicate
- Copy (full block to clipboard)
- Copy Settings (config only)
- Paste (insert cloned clipboard block after)
- Paste Settings (merge clipboard config into block)
- Delete

Clipboard is per-session (React state in Builder.tsx).

## Tree Utilities (treeUtils.ts)

All operations return new arrays (immutable):

| Function | Signature | Purpose |
|----------|-----------|---------|
| `findBlockById` | `(id, sections)` | Locate block anywhere in tree |
| `findPath` | `(id, sections)` | Returns `{ level: "top", index }` or `{ level: "container", containerId, slotIndex, index }` |
| `updateBlockInTree` | `(id, config, sections)` | Merge config patch |
| `removeFromTree` | `(id, sections)` | Delete block |
| `addToContainer` | `(containerId, slotIndex, block, sections)` | Append to container |
| `insertAtPath` | `(block, path, sections)` | Insert at specific path |
| `reorderInContainer` | `(containerId, slotIndex, newOrder, sections)` | Replace container children |
| `isDescendant` | `(ancestorId, targetId, sections)` | Guard against dropping parent into child |
| `deepCloneBlock` | `(block)` | Deep clone with new UUIDs |

## Topbar

Left: Back button, ThemeToggle, page title link (opens in new tab)
Center: "Unsaved changes" badge, save error message
Right: Canvas width label, BreakpointSwitcher, Save button

Save button disabled when: isSaving OR (not isDirty AND not isBreakpointsDirty)

## Dirty State

- `isDirty` — layout sections changed
- `isBreakpointsDirty` — breakpoints config changed
- Both trigger `beforeunload` guard
- Back button shows warning modal if either is dirty

## v0.6+ — BuilderStyles → real CSS (audit M2)

- Stylesheet body lives at `src/admin/builder/styles/builder.css` (1696 LOC).
  `BuilderStyles.tsx` is now a 12-line wrapper that imports the CSS for
  side-effect and returns `null` — the consumer's bundler (Vite/Astro)
  injects the sheet on admin load. `${epxVars}` interpolation removed; both
  `:root` blocks live literally at the top of the CSS. `tsc` preserves the
  `import "./styles/builder.css"` statement; `package.json#scripts.build`
  runs `tsc && cp -r src/admin/builder/styles → dist/...` so the published
  package ships the CSS file alongside the JS. Type-check accepts the
  import via the `declare module "*.css"` shim in `src/astro-shim.d.ts`.

## v0.6+ — Builder.tsx hook extraction (audit H4)

- `src/admin/builder/hooks/useResizeHandle.ts` — single hook for the three
  panel splits (left column, right column, structure row). Knobs: `axis`,
  `invert`, `min`, `max`, `initial`, `collapsible`. Replaces ~75 LOC of
  near-identical inline mousedown / drag / cleanup logic.
- `src/admin/builder/hooks/useBlockClipboard.ts` — owns `clipboardBlock` /
  `clipboardSettings` state plus `copyBlock(id)` / `copySettings(id)` /
  `canPaste` / `canPasteSettings`. Reads from `sectionsRef.current` at
  copy-time so it always sees the latest tree.
- Builder.tsx down from 729 → 642 LOC. Persistence + drag-handler factory
  still inline (audit also lists those; deferred to a follow-up since they
  couple tightly to `dispatch`).

## v0.6+ — Canvas changes

- **Single source of truth for visual styling (audit H1)** — Canvas no longer
  computes inline React `style={}` for background / border / radius / shadow /
  typography / position / advanced. All visual CSS is generated by
  `src/components/styleUtils.ts` (the same module the Astro frontend uses) and
  injected as a single global `<style id="epx-canvas-block-css">` via one
  `useEffect` keyed on `[sections, activeBreakpoint]`. Container children-wrapper
  layout (display / flex / grid / gap / flexDirection / justifyContent etc.) is
  the one exception: it stays inline in `ContainerBlock` because it's specific
  to admin canvas mounting and not represented in styleUtils' selector output.
  Helpers removed: `resolveBlockStyle`, `getBgStyle`, `getBpOverride`,
  `BORDER_RADIUS_MAP`, `MAX_WIDTH_MAP`, `css()`. Canvas dropped from 818 to
  579 LOC. Cross-import of `hexToRgba`/`hexToRgbVals`/`GradientStop` from
  `BackgroundControl` is gone.
- **F3.6.3 — Canvas calls `buildBlockChromeCss` identically with the frontend
  Astro components.** Up to v0.9.5 Canvas had its own `buildEffectiveBlockCss`
  helper that only called `buildBlockCss + buildHoverCss + getCustomCss` (plus
  `buildImgVisualCss/Hover` for images) and pseudo-merged
  `styleBreakpoints[activeBp]` + `styleHoverBreakpoints[activeBp]` into
  `style` / `styleHover` before generation. The subset silently dropped
  `buildBreakpointCss` and `buildBreakpointHoverCss`, so a config with hover +
  breakpoint + dark variants rendered subtly differently on Canvas vs. the
  host site. F3.6.3 collapses Canvas's CSS path to the SAME
  `buildBlockChromeCss(config, blockId, opts)` call every frontend Astro
  block (`Text.astro`, `Image.astro`, `Button.astro`, …) makes — so the FULL
  chain (block + hover + `@media` breakpoint + `@media` breakpoint-hover +
  custom + image-visual variants when `imgScoped`) emits identically in both
  worlds. Drift dies by construction. New exported helper:
  `buildCanvasBlockCss(block, activeBreakpoint)` from `src/admin/Canvas.tsx`
  — wraps the chrome call plus the active-bp preview overlay (see
  prd-breakpoints.md for the overlay mechanism). Exported for tests
  (`tests/canvasCss.test.ts`); the inline reducer's `walk(sections)` is the
  only production caller. Canvas LOC 596 → 631 (+35) — most growth is the
  doc comment block. Imports: `buildBlockChromeCss` added; `getCustomCss`
  dropped (folded into the chrome helper); `buildBlockCss` / `buildHoverCss`
  / `buildImgVisualCss` / `buildImgVisualHoverCss` kept for the overlay path.
- **Custom CSS injection** — folded into the same `epx-canvas-block-css`
  stylesheet via `getCustomCss`, which since F3.6.3 is called transitively by
  `buildBlockChromeCss` (Canvas no longer imports it directly).
  Replaces the previous separate `epx-canvas-custom-css` and
  `epx-canvas-hover-css` style elements.
- **Containing block for absolute/fixed/sticky** — `.epx-canvas__list` (the inner content wrapper, NOT the scroll container) gets `position: relative; transform: translateZ(0)`. Becomes containing block for `position: fixed` descendants without poisoning the surrounding scroll/resize behavior.
- **Resize handle smoothness** — drag uses rAF coalescing (one `setLocalWidth` per frame). On mousedown, `document.body.classList.add("epx-resizing")` is set; CSS rule `body.epx-resizing .epx-canvas__preview-frame, body.epx-resizing .epx-canvas__list { pointer-events: none }` disables iframe/block pointer capture during drag (otherwise HTML-block iframes froze the cursor).
- **Responsive frame** — `frameStyle` for resizable preview switched from `overflow: hidden` to `overflowX: hidden` (vertical scroll preserved).
- **Empty state** — `.epx-canvas--empty .epx-canvas__preview-frame` is flex-centered both axes so the placeholder lands middle of viewport.
- **Per-block previews receive `activeBreakpoint`** via `PreviewProps`, so previews can bp-merge their config (used by `TextEditorPreview`).
- **F3.6.5 — Canvas wraps each root-level block in a full-width
  `.epx-canvas-block-host`.** `.epx-canvas__list` was `display: flex;
  flex-direction: column` and flex children fold to intrinsic content
  width — so a leaf block at canvas root (button / icon / divider-spacer
  promoted via `isRootAllowedType`) collapsed on the canvas while looking
  fine on the host site (the host page's container gives the block-root
  its own block-context). Switched `.epx-canvas__list` to plain
  `display: block` (normal flow does the vertical stacking), and
  `Canvas.tsx`'s `frameContent` now wraps each root iteration:
  ```jsx
  <div
    className={`epx-canvas-block-host${inlineInner ? " epx-canvas-block-host--inline-inner" : ""}`}
    data-epx-block-host={section.id}
  >
    {/* SortableBlock or ContainerBlock, exactly as before */}
  </div>
  ```
  CSS rule (in `builder.css`):
  ```css
  .epx-canvas-block-host { display: block; width: 100%; }
  .epx-canvas-block-host--inline-inner { text-align: start; }
  ```
  Children inside containers stay UNwrapped — the container's
  `epx-container-block__children` flex/grid IS the block-context for its
  children, exactly like `SectionContainer.astro` on the frontend.
  Wrapping there would poison the container layout.
  - **Inline-display exception** — when `block.config.style.display ∈
    { inline-flex, inline-block, inline-grid, inline }` (or the active bp's
    `styleBreakpoints[bp].display` is one of those values), the host stays
    full-width but adds `--inline-inner` so `text-align: start` anchors the
    inline child at the left. Without this an inline button would render
    wherever default text alignment placed it. Detection lives in the new
    `isInnerInlineDisplay(block, activeBreakpoint)` export from
    `Canvas.tsx`. Mirrors how the frontend resolves bp overrides — a block
    that flips display per breakpoint flips `--inline-inner` automatically.
  - **Doesn't break**: BlockOverlay (drag handle, add buttons, delete) and
    drop indicators are children of the SortableBlock / ContainerBlock,
    which are now children of the host wrapper — pointer-events,
    positioning, and z-index still resolve against the inner block. Hover
    + selection borders are rendered by `epx-block-preview` /
    `epx-container-block` on the inner element. Breakpoint preview width
    simulation works because the host wrapper sits inside the resizable
    `epx-canvas__preview-frame`.
  - **Tests**: `tests/canvasCss.test.ts` adds two describe blocks. The
    `isInnerInlineDisplay` block exercises detection (4 cases). The
    `Canvas — root host wrapper (F3.6.5)` block renders `<Canvas>` via
    `react-dom/server` and asserts wrapper presence on root blocks
    (container + leaf), absence on container children, the
    `--inline-inner` modifier on inline-display roots, and that the
    empty-state placeholder still renders without a host wrapper. 283 →
    292 tests.
- **Label overflow detector** — small `useEffect` in `Builder.tsx` runs `MutationObserver` + `ResizeObserver` to set `data-overflow="true"` on `.epx-side-input__label--full` / `.epx-spacing-ctrl__label` when truncated. CSS `::after { content: "..." }` shows literal three dots; `text-overflow: ellipsis` fallback only used when CSS variant unsupported.

## F4.3 — Code-split admin via `React.lazy`

Three lazy boundaries split the heaviest admin components into
separate chunks so the consumer bundler emits them as deferred
modules. Initial admin graph: 531 KB (raw) / 103 KB (gz) → 383 KB
(raw) / 78 KB (gz). See CHANGELOG `Unreleased — 1.0.0 prep` for the
full chunk table.

### Lazy boundary in `Builder.tsx`

`RightPanel` is the heaviest single import in the admin tree (it
pulls in every section renderer + every control under `controls/`
+ the whole `blockDefinitions.ts` graph). It only mounts after the
user selects a block, which is plenty of time for the chunk to
fetch — so `Builder.tsx` does:

```tsx
const RightPanel = lazy(() =>
  import("../RightPanel.js").then((m) => ({ default: m.RightPanel })),
);

// ...inside the right-column render:
<Suspense
  fallback={
    <aside
      className="epx-right-panel epx-right-panel--loading"
      aria-busy="true"
    />
  }
>
  <RightPanel ... />
</Suspense>
```

The fallback element matches the loaded `<aside class="epx-right-panel">`
shape (same width via the column grid template, same border / bg
via `--loading` variant if the host CSS adds one) so no layout
shift occurs while the chunk fetches. `epx-right-panel--loading`
is reserved for future shimmer/skeleton styling — currently it's
just an empty placeholder.

### Bundle analyzer — `npm run analyze`

`vite-bundle-visualizer` (devDep) consumes the root-level
`vite.analyze.config.ts`, which builds `src/admin/index.tsx` as a
Vite library with the host's peer deps externalized (React,
ReactDOM, EmDash plugin-utils, dnd-kit). Output lands in
`dist-analyze/stats.html` (treemap). The numbers reported there
are the JS bytes the host bundler will pay for the plugin's admin
contribution; React + dnd-kit (which the host already provides)
do not show up.

Running it after a refactor is the standard way to verify a new
control / section / block doesn't silently regrow the initial
graph — open `dist-analyze/stats.html` and confirm the new module
landed in a deferred chunk (RightPanel / BackgroundSection /
CodeEditor) rather than the initial entry.

## TODO

- [ ] Add UNDO action + history stack (push before every mutation)
- [ ] Add undo/redo UI buttons in topbar
- [ ] Add keyboard shortcuts (Delete, Ctrl+Z, Ctrl+D)
- [ ] Add block search/filter in LeftPanel palette
- [ ] PageSelector: allow switching entry from within builder
