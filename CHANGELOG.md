# Changelog

All notable changes to `empixel-builder`. Format roughly Keep-a-Changelog,
SemVer.

## 0.7.1 — 2026-05-09

- Bump peer deps: `emdash >=0.9.0`, `better-sqlite3 >=12.0.0`. `better-sqlite3` 12
  ships native bindings built against Node 20, so the plugin now requires
  Node 20+ as well — noted in the README.
- Rename capability `read:content` → `content:read`. Both names alias in
  EmDash today, but the marketplace publish pipeline requires the new form.
- Stop swallowing exceptions silently in plugin routes; log via
  `ctx.log.warn` (or `console.warn` at module load). Set `EMPIXEL_DEBUG=1` to
  escalate to error level for local debugging.
- Emit a minimal plugin-scoped reset (`box-sizing: border-box; margin: 0`)
  once per rendered layout. Defends builder blocks from theme `* { ... }`
  resets that bleed onto plugin elements (`<figure>`, `<button>`, `<a>`,
  etc.). Skipped when the layout has zero sections.
- Single shared SQLite connection across the plugin runtime and the frontend
  reader (`getDb()` in `src/dbShared.ts`). Previously `plugin.ts` and
  `components/db.ts` each opened their own `new Database(...)` against the
  same file. New option `empixelBuilder({ databasePath })` controls the
  path; defaults to `<process.cwd()>/data.db`.

## 0.7.0 — 2026-05-08

### Breaking

- **Removed `testimonials`, `faq`, `pricing` block types.** Their preview
  components, Astro components, BlockDef entries, type interfaces, and
  RightPanel branches are gone. Layouts that still reference these types
  load fine but render nothing (frontend) and show "Unknown block"
  placeholders (canvas). On load, the new `stripUnknownBlocks` helper
  silently drops the orphans from the in-memory tree; saving a layout
  removes them from storage.

### Security

- **Fix SQL injection via `collection` parameter.** Added
  `isValidCollection` validator on every plugin route that interpolates the
  collection name into a SQL identifier (`ec_${collection}`). `db.ts`
  (frontend reader) gained the same regex check.

### Added

- `stripUnknownBlocks(sections)` and `isKnownBlockType(type)` in
  `src/types.ts` — used at every load path.
- **Undo / redo.** New `historyReducer` meta-reducer wraps the existing
  reducer with `past` / `future` snapshots. New `UNDO` / `REDO` actions
  plus `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` (or `Cmd+Y`) keyboard shortcuts.
  Skipped while editable inputs have focus so browser-native text-input
  undo keeps working. No topbar buttons — keyboard shortcuts only.
- **Light + dark variants render simultaneously.** `getEffectiveStyle`
  no longer merges based on `config.theme`. `buildBlockCss` now emits TWO
  rules: the light variant on `[data-epx-block="<id>"]` and (when
  `styleDark` has any property) the dark variant on the compound selector
  `[data-theme="dark"] [data-epx-block="<id>"], [data-epx-block="<id>"][data-theme="dark"]`.
  Pattern: host site sets `data-theme="dark"` on `<html>` (or `<body>`)
  when its theme switch flips → all blocks cascade to their dark variant
  without re-rendering. The canvas mirrors the same model by setting
  `data-theme={config.theme}` on each block's `data-epx-block` element so
  the ThemeStyleToggle preview shows the right variant.
- **Root-allowed block predicate.** New `isRootAllowedType(type)` and
  `ROOT_ALLOWED_TYPES` in `src/types.ts`. Container is always root-allowed;
  `html` and `divider-spacer` are also acceptable at canvas root. All
  other leaves must be inside a container. Replaces the previous
  `isContainerType` gate at the canvas drop sites.
- **RightPanel placeholder for unknown blocks.** Blocks whose `type`
  doesn't resolve to a `BlockDef` (corrupt JSON, removed types) now show
  a small panel with the type name + CSS ID / classes inputs instead of
  a silently empty (gray) right column.
- **`BlockErrorBoundary`** — per-block React error boundary inside Canvas.
  A crash in any one preview no longer kills the whole builder.
- **Vitest test suite** with 72 tests covering `treeUtils`,
  `builderReducer` + `historyReducer`, `styleUtils`, `stripUnknownBlocks`.
- `tsconfig.check.json` + `npm run typecheck` script wired into
  `prepublishOnly`. Catches drift in the frontend `src/components/` tree
  that the published-only `tsc` config skips.
- **`buildBlockChromeCss`** helper in `styleUtils.ts` consolidating the
  per-block CSS bundle (block + hover + breakpoint + breakpoint-hover +
  custom). Every leaf component uses it now.
- **`BaseBlockConfig` + `ContainerConfig` + `TypedSectionBlock` discriminated
  union** in `src/types.ts`. Additive — existing `SectionBlock` shape
  unchanged. Use `asTyped(block)` to opt into narrowing.
- **`useResizeHandle`, `useBlockClipboard`, `useBuilderPersistence`,
  `useDragHandlers`** hooks under `src/admin/builder/hooks/` — extract
  panel resize, copy/paste clipboard, layout load+save+beforeunload, and
  drag handlers from `Builder.tsx`.
- **`right-panel/icons.tsx` + `right-panel/types.ts`** — RightPanel SVG
  icons and `AdvancedConfig` type extracted to siblings.
- **`controls/colorUtils.ts`** — `hexToRgba`, `hexToRgbVals`, `GradientStop`
  extracted from `BackgroundControl.tsx` so other admin modules don't
  cross-import a 950-LOC file.

### Changed

- **Canvas styling unified** — `Canvas.tsx` no longer computes inline
  `style` for visual props; everything goes through `styleUtils.ts` via a
  single global `<style id="epx-canvas-block-css">`. Per-breakpoint
  preview faked by synthetically merging `styleBreakpoints[bp]` /
  `styleHoverBreakpoints[bp]` before the helper call. Canvas dropped from
  818 → 588 LOC.
- **`BlockRenderer.astro` single dispatch** — every leaf block component
  is self-contained (semantic root + chrome attrs + injected CSS). The
  previous LEAF_COMPONENTS + bespoke wrapper path is gone.
- **`BuilderStyles.tsx` returns `null` and imports `./styles/builder.css`**.
  CSS lives as a real stylesheet now, copied to `dist/` by the build script.
  Theme variables further split into `vars.css`. `epxVars` template-string
  interpolation removed.
- **`FieldRenderer` map dispatch** — replaced the if-chain with a
  `Record<FieldType, FC>` map. TypeScript exhaustiveness checks every
  field type has a renderer.
- **`Builder.tsx` 729 → 481 LOC** after extracting four hooks + the drag
  handler factory.
- **`useMemo` on Canvas's `collectAllBlockCss`** — identity-stable string,
  the `<style>` injection effect skips DOM writes when nothing changed.

### Fixed

- **Slot recursion bug in tree utilities.** `removeFromTree`,
  `updateBlockInTree`, `insertAtPath`, `reorderInContainer`, and
  `addToContainer` previously skipped `block.slots` whenever `block.children`
  was a truthy empty array. They now walk both independently. Found by the
  new test suite.
- **Container background not visible in canvas.** `BuilderStyles.tsx` had a
  `.epx-container-block { background: transparent }` rule that beat the
  attribute-selector rule on equal specificity; removed.
- **`deepCloneBlock` shared the `config` object reference.** Now uses
  `structuredClone` (with a JSON round-trip fallback) so mutating a clone
  no longer corrupts the original.

### Removed

- Stale 0-byte `data.db` from the plugin root. The runtime always uses
  `process.cwd()/data.db` (the host site's DB), not the plugin's.
- **Accent theme support.** `Theme` is now `"light" | "dark"` only. The
  `styleAccent` / `styleHoverAccent` keys are gone from `BaseBlockConfig`
  and `getEffectiveStyle` no longer special-cases accent. Old layouts that
  carry `styleAccent` data ignore it silently — the editor never exposed an
  accent button via `ThemeStyleToggle`, so any accent data came from
  pre-0.7 hand-edits and was never rendered anyway.

## 0.6.0

Initial public version. See `.claude/prd.md` for the v0.6 baseline.
