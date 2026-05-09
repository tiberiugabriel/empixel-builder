# Changelog

All notable changes to `empixel-builder`. Format roughly Keep-a-Changelog,
SemVer.

## Unreleased — 0.9.5 prep

- **F3.5.1 — declarative `StyleSection` types + `fieldsTab` /
  `styleTab` on `BlockDef`.** Adds the discriminated-union schema
  (`theme` / `spacing` / `background` / `border` / `borderRadius` /
  `boxShadow` / `typography` / `textStroke` / `textShadow` /
  `alignment` / `blendMode` / `filter` / `overflow` / `opacity` /
  `imgVisual` / `videoSource` / `iconGroup` / `dividerLine` /
  `custom`) plus optional `fieldsTab: FieldDef[]` and
  `styleTab: StyleSection[]` properties on `BlockDef`. Existing
  `fields` / `styleFields` are kept as deprecated aliases during the
  F3.5 transition; `getBlockDef` returns `fieldsTab` aliased from
  `fields` when an entry doesn't declare it. F3.5.2 migrates the 9
  `BlockDef` instances to the new schema; F3.5.6 drops the imperative
  `block.type ===` branches in `RightPanel.tsx`. No behavioral change
  in 0.9.x — types are additive.

## 0.9.0 — 2026-05-09

- **Breaking** — drop the `better-sqlite3` peer dependency. Plugin no
  longer opens its own SQLite handle; all reads + writes go through
  EmDash's `ctx.storage` (multi-driver: SQLite, Postgres, libSQL/D1).
  Removed the `databasePath` option from `empixelBuilder({ ... })` —
  storage is configured at the EmDash root in `astro.config.mjs`.
  Hosts upgrading from 0.8.x: ensure F3.3's `migration_to_storage_v1`
  ran successfully (check the `_plugin_storage` table for your plugin
  id). Hosts on Postgres / libSQL: the migration is a no-op since the
  legacy table never existed.

  ### Migration steps for hosts

  1. **Check that `migration_to_storage_v1` ran on your previous
     deploy.** On 0.8.x the migration ran lazily on the first request
     to a layout route after upgrade. Verify by querying your storage
     back-end for the `_plugin_storage` row matching
     `plugin_id = 'empixel-builder' AND collection = 'layouts'`. If
     rows exist, you're done. (Hosts on Postgres / libSQL never had
     the legacy table, so this is a no-op for you.)
  2. **Remove the `databasePath` option** from your
     `empixelBuilder({ ... })` call in `astro.config.mjs` if you set
     it. The option is gone — storage is configured at the EmDash
     root via `database()` in `astro.config.mjs`, not on the plugin.
  3. **Optional: drop `better-sqlite3` from your host's
     `peerDependencies`** if you only carried it for this plugin.
     EmDash itself still uses `better-sqlite3` transitively for the
     SQLite driver; only the explicit peer dep on the plugin side is
     gone.

- The legacy fallback paths in `src/plugin.ts` (route handlers
  reading from `empixel_builder_layouts`, `content:afterDelete`
  cascade DELETE) and `src/components/db.ts` (frontend reader's
  `readFromLegacyTable`) are removed. The route handlers and frontend
  reader are storage-only.
- `src/dbShared.ts` is deleted. The shared SQLite handle factory
  (`getDb`) and the `setDefaultDatabasePath` /
  `resolveDatabasePath` helpers are gone — the plugin no longer
  manages a SQLite singleton.
- `runMigrationToStorageV1` keeps a dynamic-import bridge to
  `better-sqlite3` so SQLite hosts upgrading from 0.8.x still copy
  their legacy `empixel_builder_layouts` rows into `ctx.storage` on
  first cold start. On Postgres / libSQL / D1 hosts where the
  binary isn't installed, the migration silently no-ops and the KV
  flag is set so future requests are O(1). The cold-start migrations
  `runSpacerMigration` (v0.6 → divider-spacer) and
  `runSlugToUlidMigration_v1` (v0.8 → ULID-keyed rows) are deleted —
  both apply only to the legacy SQLite table that the plugin no
  longer touches; any host that upgraded through 0.8.x already has
  them flagged in `empixel_builder_meta`, and the F3.3 migration
  copies the post-rewrite rows into `ctx.storage` regardless.
- `getMigrationFlag` and `setMigrationFlag` no longer take a `db`
  argument or mirror to the legacy `empixel_builder_meta` table. They
  read/write `ctx.kv` only. The legacy-meta sync-forward path lives
  inside `toStorageV1.ts` against the migration's own dynamically-
  imported SQLite handle (so hosts that ran the migration pre-F3.2
  still get the flag synced forward to KV on the F3.5 upgrade).
- The `/settings` and `/toggle` routes no longer auto-add the
  `empixel_builder INTEGER NOT NULL DEFAULT 0` column to
  `ec_<collection>` via `ALTER TABLE`. The auto-augment helper
  required direct SQLite access; with the multi-driver storage
  abstraction, schema augmentation is back to seed-driven (declare
  the column in your `seed.json`). The `/toggle` UPDATE that mirrors
  the enable bit onto the host's row is best-effort via `ctx.db`
  (Kysely) — failures log via `logCaught` and don't break the route.

### Earlier work folded into 0.9.0

- One-shot data migration `migration_to_storage_v1`. Copies every
  `empixel_builder_layouts` row into `ctx.storage.layouts` on first
  boot. Idempotent — KV flag `state:migration:to_storage_v1` gates
  re-runs (and is honored from the legacy `empixel_builder_meta`
  table for hosts that flipped the flag pre-F3.2). Conflict
  resolution: newer `updatedAt` wins; ties go to storage. Together
  with F3.2's storage-first reads, hosts upgrade transparently — no
  manual steps. Wire-up is a **lazy gate**
  (`ensureStorageMigrationRan`) called at the top of every route
  handler that reads or writes layouts. EmDash's `plugin:install` /
  `plugin:activate` lifecycle hooks only fire on state transitions
  (not every cold start), so they're not suitable for this migration
  — the lazy gate runs on the very first request post-upgrade and
  short-circuits via a process-local cache plus the KV flag for
  every subsequent call.
- Refactor every plugin route handler to read/write layouts via
  `ctx.storage.layouts` instead of direct SQL against the legacy
  `empixel_builder_layouts` table. **Writes go only to ctx.storage**;
  **reads try storage first** and fall back to the legacy table for one
  version while F3.3 migrates rows. The fallback is encapsulated in two
  helpers — `readLayoutFromStorageOrLegacy` for single-row reads
  (`/layout` GET) and `readLegacyEntryMetaForCollection` for the
  collection-wide listing (`/entries`) — so F3.5 can drop both in one
  surgical edit after F3.3 ships and a release goes by. The
  `content:afterDelete` hook deletes from BOTH layers because pre-F3.3
  rows may live in either. Storage docs are keyed by the deterministic
  composite id `${collection}::${entryId}` so direct point-lookups stay
  O(1) without going through `query({ where })`. The legacy table
  itself is **not dropped** — only its writes are; its reads remain as
  a fallback during the transition.
- Migration flag plumbing moved to `ctx.kv` (key prefix
  `state:migration:`). New helpers `getMigrationFlag` and
  `setMigrationFlag` read from KV first; if KV is empty but the legacy
  `empixel_builder_meta` table has the flag, the legacy value is
  trusted and synced forward to KV (so the next read skips the SQL
  lookup entirely). Existing cold-start migrations
  (`runSpacerMigration`, `runSlugToUlidMigration_v1`) keep writing to
  the legacy meta table — they run synchronously inside `getDb()` and
  don't have access to async ctx — but the new helpers are exported for
  the F3.3 ctx.storage migration to use directly.
- **Breaking** — `getBuilderLayout(...)` is now async and takes `Astro`
  (or any context with `.locals.emdash`) as the first argument. The new
  signature is
  `getBuilderLayout(astro, collection, entryId, enabled?): Promise<BuilderLayoutResult>`.
  The frontend reader routes through `ctx.storage.layouts` (EmDash's
  multi-driver plugin storage abstraction) by querying the shared
  `_plugin_storage` table via `Astro.locals.emdash.db` — partitioned
  under `plugin_id = "empixel-builder", collection = "layouts"` — with a
  read-only fallback to the legacy `empixel_builder_layouts` SQLite
  table for one version while the F3.3 migration copies rows over. The
  legacy fallback dispatches through `getDb()` from `dbShared.ts`
  (`src/components/db.ts:275` — `readFromLegacyTable`). F3.5 drops the
  fallback and the `better-sqlite3` peer dependency entirely. Hosts
  importing `getBuilderLayout` directly need to (1) `await` the call
  and (2) pass `Astro` as the first arg. `BuilderWrapper.astro` does
  both for you when used as `<BuilderWrapper sections={getBuilderLayout(Astro, ...)}>`
  — the wrapper accepts the resolved value, the awaited promise, and
  the legacy `SectionBlock[] | null` shape from older
  `npx empixel-builder add` scaffolds.
- Re-export `getBuilderLayout`, `BuilderLayoutResult`,
  `BuilderCacheHint`, `BuilderLayoutContext`, and
  `builderLayoutCacheTag` from `empixel-builder/components` so consumers
  don't deep-import from `empixel-builder/components/db.js`. This lifts
  the F2.4 deep-import debt that was deferred when Agent A wasn't
  allowed to touch `src/components/index.ts`.
- Declare `storage.layouts` in `definePlugin` so EmDash provisions the
  layouts collection through its multi-driver storage abstraction. The
  collection is keyed on the composite `(collection, entryId)` pair via
  both `indexes` and `uniqueIndexes`, mirroring the existing
  `empixel_builder_layouts` PK. EmDash routes storage rows through the
  shared `_plugin_storage` table (filtered by `plugin_id =
  "empixel-builder" AND collection = "layouts"`), which is separate
  from the legacy `empixel_builder_layouts` table — so the two
  back-ends coexist while the migration is in flight.
- New `src/storage-types.ts` exposes `LayoutRow` and
  `StorageLayoutsCollection` (typed `StorageCollection<LayoutRow>`) so
  Agent B can consume the typed `ctx.storage.layouts` handle in F3.4
  without re-declaring the shape.

## 0.8.0 — 2026-05-09

- **Breaking — `getBuilderLayout` now returns `{ sections, cacheHint }`**
  instead of `SectionBlock[] | null`. The `cacheHint` matches EmDash's
  `CacheHint` shape (`{ tags?: string[]; lastModified?: Date }`) and
  always carries the layout-scoped tag
  `empixel:layout:<collection>:<entryId>` so admin saves can invalidate
  the host page by tag. `lastModified` is parsed from the layout row's
  `updated_at` (existing column — no schema change). `BuilderWrapper`
  plumbs the hint into `Astro.cache.set(...)` automatically when the
  host passes the `BuilderLayoutResult` straight through; the wrapper
  also accepts the legacy `SectionBlock[] | null` shape so pages
  scaffolded by an older `npx empixel-builder add` keep rendering until
  they're updated. Manual consumers can destructure
  `{ sections, cacheHint }` and call `Astro.cache.set` themselves —
  documented in the README's "Caching builder layouts" section. Public
  API break for any host that imports `getBuilderLayout` directly.
- One-shot slug → ULID migration on cold start (KV flag
  `migration_slug_to_ulid_v1` in `empixel_builder_meta`). Pre-0.8 routes
  accepted both keys and the read paths walked a slug↔ULID fallback
  chain on every request; the migration rewrites every slug-keyed
  `empixel_builder_layouts` row to its canonical ULID by joining on
  `ec_<collection>.slug`. Conflicts (both keys present) resolve in
  favour of the row with the newer `updated_at`; ULID wins on ties.
  Unresolvable slug rows are LEFT IN PLACE and logged — manual recovery
  via re-save under the new slug. Wrapped in a transaction; idempotent
  (the flag is set on completion). Plugin routes (`/layout` GET+POST,
  `/toggle`) and the frontend reader (`components/db.ts`
  `getBuilderLayout`) drop the multi-query fallback chain — layouts now
  resolve by ULID directly. The route-level slug → ULID resolution is
  retained for the fresh-entry case (host CMS hands us a slug for an
  entry that has never been saved through the builder).
- Plugin now auto-adds the `empixel_builder INTEGER NOT NULL DEFAULT 0`
  column to `ec_<collection>` on the first `POST /settings` enable (and
  the first `POST /toggle` for collections that skip the collection-level
  enable). Hosts no longer need to declare the column in `seed.json`.
  Idempotent — SQLite's "duplicate column" error is swallowed; any other
  ALTER failure is logged via `logCaught`. The collection name still
  passes through `isValidCollection(...)` before the DDL — never raw
  user input into a SQL identifier (issue: report C2/Q5).
- `resolveMediaUrl(key, { locals })` helper in `src/components/media.ts`.
  Replaces hardcoded `/_emdash/api/media/file/...` URLs everywhere on the
  frontend; routes through EmDash's storage adapter
  (`Astro.locals.emdash.getPublicMediaUrl`) so layouts work under
  `local()`, `s3()`, R2, etc. Background and video storage-key references
  in `styleUtils.ts` accept an optional `resolveMediaUrl` callback so CSS
  generation stays synchronous; Astro components build the closure from
  `Astro.locals` once and thread it through. Re-exported from
  `empixel-builder/components` for use by admin and external consumers.
  Legacy `/_emdash/api/media/file/<key>` URL retained as the fallback
  inside `media.ts` for hosts that haven't wired the public URL builder
  yet.

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
