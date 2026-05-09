# Changelog

All notable changes to `empixel-builder`. Format roughly Keep-a-Changelog,
SemVer.

## Unreleased — 0.9.6 prep

- **F3.6.5 — Canvas wraps each root-level block in
  `.epx-canvas-block-host` (full-width).** Solves the "leaf block at canvas
  root collapses to content width" issue: `.epx-canvas__list` was
  `display: flex; flex-direction: column` and flex children fold to
  intrinsic width — so a button / icon / divider-spacer promoted to root
  via `isRootAllowedType` collapsed on the canvas while looking fine on
  the host site (the host page's container gives the block-root its own
  block-context). The fix has two parts in lockstep:
  - `.epx-canvas__list` switched to plain `display: block` (normal flow).
    Vertical stacking is what normal block flow gives us anyway. The
    `position: relative; transform: translateZ(0)` rule lower in
    `builder.css` (containing-block trick for fixed/absolute descendants)
    is preserved.
  - `Canvas.tsx`'s `frameContent` now wraps each `sections.map(...)`
    iteration in `<div class="epx-canvas-block-host" data-epx-block-host="<id>">…</div>`.
    The wrapper is `display: block; width: 100%`. The inner block keeps
    its own `style.display` intent: `inline-flex` / `inline-block` /
    `inline-grid` / `inline` keep the inner element at intrinsic width
    inside the full-width host (host gets the `--inline-inner` modifier
    so `text-align: start` anchors the inline child at the left). All
    other display values render as block-level full-width.
  - **Children inside containers stay unwrapped.** A container's
    `epx-container-block__children` flex/grid IS the block-context for
    its children, exactly the same way `SectionContainer.astro`'s flex/grid
    is the block-context on the frontend (parity with
    `BlockRenderer.astro`'s leaf dispatch). Wrapping there would
    poison the container layout.
  - Inline-display detection: new `isInnerInlineDisplay(block,
    activeBreakpoint)` exported from `Canvas.tsx` reads
    `block.config.style.display`, with the active bp's
    `styleBreakpoints[bp].display` taking precedence on non-desktop bp.
    Mirrors how the frontend resolves bp-overrides — switching display
    per breakpoint flips `--inline-inner` automatically.
  - Doesn't break: drag-and-drop (BlockOverlay, drop targets), hover
    and selection borders (still rendered by `epx-block-preview` /
    `epx-container-block` on the inner element), breakpoint preview
    width simulation (the host wrapper sits inside the resizable
    `epx-canvas__preview-frame`).
  - Tests: `tests/canvasCss.test.ts` adds two describe blocks. (a)
    `isInnerInlineDisplay` — 4 cases covering unset / block-level /
    inline-* / bp-override. (b) `Canvas — root host wrapper (F3.6.5)`
    — 5 cases that render `<Canvas>` via `react-dom/server` and assert
    wrapper presence on root blocks (container + leaf), absence on
    container children, the `--inline-inner` modifier on inline-display
    roots, and that the empty-state placeholder still renders without a
    host wrapper. Total test count 283 → 292.
  - Files: `src/admin/Canvas.tsx` (frameContent wraps roots; new
    `isInnerInlineDisplay` export), `src/admin/builder/styles/builder.css`
    (`.epx-canvas__list` → block; new `.epx-canvas-block-host` rule +
    `--inline-inner` modifier), `tests/canvasCss.test.ts` (+9 cases),
    `.claude/prd-builder-ui.md` (Canvas section documents the wrapper),
    `.claude/coordination/status/agent-c.md` (start + done entries).
    `package.json` stays at `0.9.5` — F3.6 phase will bump to 0.9.6 at
    phase close.

- **F3.6.3 — Canvas now calls `buildBlockChromeCss` identically with the
  frontend `*.astro` components. Drift between admin preview and host
  render dies by construction.** Previously `Canvas.tsx`'s
  `buildEffectiveBlockCss` only called a subset (`buildBlockCss` +
  `buildHoverCss` + `getCustomCss` + `buildImgVisualCss/Hover` for image
  blocks) and pseudo-merged `styleBreakpoints[bp]` into `style` to fake
  the active breakpoint. That subset silently dropped `buildBreakpointCss`
  and `buildBreakpointHoverCss`, so a config with hover + breakpoint +
  dark variants rendered one way on Canvas, another on the host site
  (audit M2 / H1 follow-up). After F3.6.3, Canvas's per-block CSS path
  is one call to the same `buildBlockChromeCss` helper every leaf Astro
  block (`Text.astro`, `Image.astro`, `Button.astro`, `Icon.astro`,
  `TextEditor.astro`, `Video.astro`, `Html.astro`, `DividerSpacer.astro`)
  uses — so the FULL chain (block + hover + `@media` breakpoint + `@media`
  breakpoint-hover + custom + image-visual variants when `imgScoped`)
  emits identically in both worlds.
  - **Active-breakpoint preview mechanism** — Canvas viewport is the
    actual browser window, so `@media(max-width:Xpx)` queries from
    `buildBreakpointCss` don't fire when previewing a 575px mobile bp on
    a 1920px screen. Spec option (a) `@container` queries was rejected
    because rewriting `buildBreakpointCss` falls in Agent B's column;
    spec option (b) CSS variable + `:where(...)` was rejected because
    CSS variables can't gate `@media` evaluation (the browser checks
    actual viewport regardless of an author CSS var). KISS fallback per
    F3.6.3 spec: emit a **stacked preview overlay** — a non-`@media`
    duplicate of the active bp's declarations (scoped to
    `[data-epx-block="<id>"]` for visual, `[…]:hover` for hover,
    `[…] img` when `imgScoped`) layered AFTER the frontend bundle so it
    wins in cascade order. Frontend stays untouched. F4 can revisit if
    `@container` becomes viable across all block components.
  - New exported helper from `src/admin/Canvas.tsx`:
    `buildCanvasBlockCss(block, activeBreakpoint)` — full frontend
    bundle + active-bp overlay. Exported only for testing
    (`tests/canvasCss.test.ts`); the inline reducer's `walk(sections)`
    is the only production caller.
  - Imports in `Canvas.tsx`: `buildBlockChromeCss` added; `getCustomCss`
    dropped (now folded into `buildBlockChromeCss`). `buildBlockCss` /
    `buildHoverCss` / `buildImgVisualCss` / `buildImgVisualHoverCss`
    kept — used by the overlay path.
  - Tests: new `tests/canvasCss.test.ts` (11 tests) — desktop output
    equals the frontend's `buildBlockChromeCss` exactly for each
    representative shape (text, image with `imgScoped`, dark variant,
    full bundle); active-bp preview overlay layers AFTER the frontend
    bundle (string prefix), only fires when active bp has overrides,
    routes images through `imgScoped`, wins cascade order. Total
    242 → 253 (+11 new).
  - LOC: `Canvas.tsx` 596 → 631 (+35) — the new
    `buildCanvasBlockCss` + `buildActiveBpPreviewCss` pair plus the
    F3.6.3 doc comment block. The pseudo-merge logic moved into the
    overlay function but no longer pollutes the main code path.
  - Files: `src/admin/Canvas.tsx`, `tests/canvasCss.test.ts` (new),
    `CHANGELOG.md`, `.claude/prd-builder-ui.md`,
    `.claude/prd-breakpoints.md`,
    `.claude/coordination/status/agent-c.md`.
- **F3.6.4 (migration) — `runMigrationLegacySpacingV1` rewrites legacy
  symbolic spacing values (`none/sm/md/lg/xl`) to their px equivalents
  in stored layouts.** Idempotent, KV-flag-gated
  (`state:migration:legacy_spacing_v1`), runs at the lazy gate alongside
  `migration_to_storage_v1`. Pair with F3.6.4's frontend half (B) to
  fully retire the symbolic-spacing path.
  - Map (verbatim from `SectionContainer.astro`'s `spacingMap`):
    `none → "0"`, `sm → "32px"`, `md → "48px"`, `lg → "64px"`,
    `xl → "96px"`.
  - Coverage: `paddingTop/Right/Bottom/Left` and
    `marginTop/Right/Bottom/Left` keys, on every block's
    `config.style`, `config.styleHover`, `config.styleDark`,
    `config.styleBreakpoints[bp]`, `config.styleHoverBreakpoints[bp]`,
    recursively into `block.children` and `block.slots`.
  - Sequencing: lazy-gate-wired in `plugin.ts` after
    `ensureStorageMigrationRan` so legacy SQLite rows have already
    landed in `ctx.storage` before this rewrites them. Sites:
    `listEntriesForCollection`, `/layout` GET + POST, `/toggle`,
    and the `content:afterDelete` hook.
  - Brief upgrade glitch: Agent B is concurrently dropping the
    `spacingMap` fallback in `SectionContainer.astro`. After both
    PRs ship, frontend has no fallback AND data is migrated. Hosts
    upgrading 0.9.5 → 0.9.6 may see padding / margin render as the
    unparsed string (e.g. `"md"`) for one request after the upgrade
    until the lazy gate runs and rewrites the stored row. KISS —
    running the migration on every layout read would add a meaningful
    per-request cost.
  - On rewrite, `updatedAt` is bumped to a fresh ISO timestamp so the
    `cacheHint.lastModified` path on `getBuilderLayout` invalidates
    any cached page that rendered with the unparsed symbolic value
    before the migration ran.
  - Files: `src/migrations/legacySpacingV1.ts` (new), `src/plugin.ts`
    (5 lazy-gate sites + import), `tests/legacySpacingMigration.test.ts`
    (new — 22 cases). `version` in `package.json` stays at `0.9.5` —
    F3.6 phase will bump to 0.9.6 at phase close.
- **F3.6.4 (frontend) — drop SectionContainer's legacy `spacingMap`
  fallback. Symbolic spacing values (`none`/`sm`/`md`/`lg`/`xl`) are now
  inline-resolved by `styleUtils.ts` via `normalizeLegacySpacing`,
  applied to padding/margin keys inside `buildStyleBodyFromObject` (the
  single chokepoint that emits every block's CSS).** Single source of
  truth: `style.paddingTop` etc. carry concrete px values at render
  time, with the legacy map applied only when the persisted value
  matches one of the five symbolic keys. The post-hoc
  `paddingCss` / `styleWithoutPadding` regex dance in
  `SectionContainer.astro` was retired together with the local
  `spacingMap` and `resolveSpacing` helpers — the container now just
  spreads `value.style` through the standard chrome builder. Pair with
  Agent A's `runMigrationLegacySpacingV1` (separate branch) which
  rewrites stored values forward; the inline-resolve guards the brief
  upgrade-to-migration window so rows that haven't been rewritten yet
  still render correct padding instead of dropping to 0. Restricted to
  padding+margin keys (`LEGACY_SPACING_PROP_SET`) so non-spacing
  attributes (`width`, `borderTopWidth`, …) keep their values
  unchanged. New export: `normalizeLegacySpacing(value)`. New tests
  (`tests/styleUtils.test.ts`): `normalizeLegacySpacing` describe (3
  cases — exact-map, pass-through, no-false-match), `buildBlockCss —
  F3.6.4 legacy spacing inline-resolve` describe (4 cases — symbolic
  padding, symbolic margin, concrete-value pass-through, scoped to
  padding+margin only), `buildBreakpointCss — F3.6.4 legacy spacing
  inline-resolve` describe (1 forward-compat case). Total 242 → 250
  (+8 new). Files: `src/components/styleUtils.ts`,
  `src/components/SectionContainer.astro`,
  `tests/styleUtils.test.ts`, `.claude/prd-frontend.md`,
  `.claude/prd-breakpoints.md`.

- **F3.6.2 — `getDefaultBlockConfig(type)` helper exported from
  `blockDefinitions.ts`. `ADD_BLOCK` + `LOAD_SUCCESS` (plus
  `ADD_TO_CONTAINER` and `INSERT_AFTER` for consistency) fill missing
  keys at mount, not at render. Old layouts upgraded transparently;
  Canvas / RightPanel / frontend no longer need defensive `?? ""`
  checks for style keys (F3.6.3 builds CSS unification on top).** New
  exports:
  - `BASE_DEFAULTS` — shared shape every block inherits
    (`theme: "light"` plus the F3.6.1 empty structural placeholders
    `style` / `styleHover` / `styleDark` / `styleBreakpoints` /
    `styleHoverBreakpoints` / `advanced`). Centralises the contract so
    legacy layouts that pre-date the F3.6.1 BlockDef edits still
    backfill correctly.
  - `getDefaultBlockConfig(type: BlockType)` — returns
    `structuredClone({ ...BASE_DEFAULTS, ...def.defaultConfig })` with
    nested objects (`style`, `advanced`) deep-merged so design defaults
    like `container.style.paddingTop = "12px"` survive on top of the
    `EMPTY_STYLE_DEFAULTS` floor. Two calls return independent objects
    (mutating one doesn't affect the other). Unknown block types fall
    back to a deep-cloned `BASE_DEFAULTS` so callers never get
    `undefined`.
  - Reducer: `ADD_BLOCK` (+ `ADD_TO_CONTAINER` + `INSERT_AFTER`)
    deep-merges the action's `block.config` over
    `getDefaultBlockConfig(block.type)` so freshly-instantiated blocks
    are always full-shape and the action's explicit values win on
    overlap. `LOAD_SUCCESS` walks the section tree (recursing into
    `children` and `slots`) and backfills missing keys per node;
    existing values are never overwritten.
  - Tests: `tests/blockDefinitions.test.ts` adds an F3.6.2 describe
    block (9 tests) — `BASE_DEFAULTS` shape, full STYLE_PROPS coverage
    on every `getDefaultBlockConfig`, deep-clone independence,
    pre-existing design defaults preserved, unknown-type fallback,
    block-specific scalar/nested defaults survive, advanced defaults
    are all `""`. `tests/builderReducer.test.ts` adds an F3.6.2
    describe block (9 tests) — ADD_BLOCK fills defaults for each of
    the 9 block types, action-wins-on-overlap, design defaults
    preserved, LOAD_SUCCESS backfills sparse layouts (root +
    children + slots), nested values preserved, ADD_TO_CONTAINER +
    INSERT_AFTER consistency. Total 224 → 242 (+18 new).
  - Files: `src/admin/blockDefinitions.ts`,
    `src/admin/builder/builderReducer.ts`,
    `tests/blockDefinitions.test.ts`,
    `tests/builderReducer.test.ts`,
    `.claude/prd-blocks.md`, `.claude/prd-builder-ui.md`.
    `package.json` stays at `0.9.5` — F3.6 phase will bump to 0.9.6 at
    phase close.

- **F3.6.1 — every `BlockDef.defaultConfig` now declares the full
  style/styleHover/styleDark/styleBreakpoints/styleHoverBreakpoints/advanced
  structure (empty values).** No design values invented — user
  populates aesthetic defaults later. Foundation for F3.6.2 (load-time
  fill helper) and F3.6.3 (Canvas / frontend CSS unification). The new
  shared shape:
  - `style` carries every key in `STYLE_PROPS` (`styleUtils.ts`) — 36
    entries spanning padding/margin/sizing/border-radius/border-width/
    overflow/typography/blend-mode/aspect-ratio/filter, all defaulted
    to `""`. Two new exports — `EMPTY_STYLE_DEFAULTS` and
    `EMPTY_ADVANCED_DEFAULTS` — live in `src/admin/blockDefinitions.ts`
    so each BlockDef spreads them rather than duplicating the key list.
  - `styleHover`, `styleDark`, `styleBreakpoints`, `styleHoverBreakpoints`
    default to empty `{}` placeholders (populated by user toggles).
  - `advanced` defaults to `{ cssId, cssClasses, customCss, position,
    top, right, bottom, left, zIndex }` all `""`. Mirrors
    `AdvancedConfig` from `right-panel/types.ts`.
  - Pre-existing design values survive: `container.style` still carries
    its `paddingTop/Right/Bottom/Left = "12px"` and
    `columnGap/rowGap = "6px"` baked-in defaults; the merge spreads
    `EMPTY_STYLE_DEFAULTS` first and lets the design overrides win.
    Block-specific keys (`text-editor.columns`, `video.aspectRatio`,
    `divider-spacer.divider`, etc.) keep their existing values.
  - Tests: `tests/blockDefinitions.test.ts` adds an F3.6.1 describe
    block (5 new tests, 219 → 224) — STYLE_PROPS coverage on
    `EMPTY_STYLE_DEFAULTS`, full STYLE_PROPS coverage on every block's
    `defaultConfig.style`, full top-level shape coverage, every
    `EMPTY_ADVANCED_DEFAULTS` key on every `defaultConfig.advanced`,
    and a "no design values invented" assertion that whitelists the
    pre-existing `container` padding overrides.
  - Files: `src/admin/blockDefinitions.ts`,
    `tests/blockDefinitions.test.ts`, `.claude/prd-blocks.md`.
    `version` in `package.json` stays at `0.9.5` — F3.6 phase will bump
    to 0.9.6 only at phase close.

## 0.9.5 — 2026-05-09

- **F3.5.8 — block-author guide added to `.claude/prd-blocks.md`.** Phase
  F3.5 (Block Settings Standardization) is now complete: declarative
  `BlockDef.fieldsTab` + `styleTab` replaces 1671 LOC of imperative
  `RightPanel.tsx` branching with a 3-step workflow (BlockDef + preview
  + Astro component). Adding a new block type no longer requires
  touching `RightPanel.tsx`, `SectionRenderer.tsx`, `TabRenderer.tsx`,
  or `AdvancedTab.tsx`. The new author guide documents the recipe,
  full `BlockDef` / `FieldDef` / `StyleSection` references, a worked
  example (`quote` block), the explicit "what NOT to touch" list, and
  the `kind: "custom"` escape hatch for both Style and Fields tabs.
  `prd-rightpanel.md` cross-links to the guide and adds a
  "When you'd modify RightPanel.tsx" section (top-shell concerns
  only). `prd-index.md` Quick Links surface the guide as the entry
  point for new-block work; the architecture diagram + BlockDef schema
  snippet now reflect the post-F3.5.6 declarative shape.
- **Hotfix follow-up — `getBuilderLayout(...)` is now polymorphic over the
  3-arg legacy and 4-arg `Astro`-first signatures.** F3.4 (and the earlier
  `fix/F3.4-frontend-empty` follow-up) changed the signature from
  `(collection, entryId, enabled)` to `(astro, collection, entryId, enabled)`
  but host pages scaffolded by `npx empixel-builder add` (and any host that
  pinned to the v0.8 / pre-F3.4 shape, e.g. Novapera) still call the 3-arg
  form. When the legacy 3-arg call hit the new function, args slotted in as
  `astro = "<collection>"` (a string), `collection = <entryId>` (the
  uppercase Crockford ULID), `entryId = <enabled flag>` — and the
  `COLLECTION_RE.test(collection)` line then rejected the uppercase ULID,
  returning null sections. `BuilderWrapper` fell through to `<slot />` and
  the host theme template rendered instead of builder content (the same
  visible symptom as the original F3.4 bug, despite the
  `fix/F3.4-frontend-empty` patch). The new function dispatches on the
  first argument: if it's a string, treat as legacy (3-arg) and resolve the
  Kysely handle via `getDb()` from `emdash/runtime` directly — no
  `Astro.locals.emdash.db` available in that path. The 4-arg form is
  unchanged. Hosts that want `Astro.cache.set(cacheHint)` plumbing should
  adopt the 4-arg form, but the 3-arg form continues to render builder
  content correctly. Theme code (Novapera and other host sites) stays
  untouched per the hard constraint. Files: `src/components/db.ts`,
  `tests/getBuilderLayout.test.ts` (+5 cases — Novapera-shape ULID
  short-circuit absence, enabled=false / undefined / invalid-collection in
  the legacy shape, end-to-end runtime-singleton round-trip via the legacy
  shape), `.claude/prd-frontend.md`.

- **Hotfix (admin): F3.5.6 follow-up — Style tab spacing matches Fields tab.**
  The F3.5.6 RightPanel rewrite renders the Style-tab body inside a
  `.epx-right-panel__style` wrapper (vs Fields' `.epx-right-panel__fields`),
  but `builder.css` only carried the spacing/scrollbar rule for the Fields
  selector. Result: the Style tab body collapsed against the panel edge
  with no padding, no inter-section gap, no working overflow scroll.
  Fix: combined the selector
  (`.epx-right-panel__fields, .epx-right-panel__style { ... }`) so both
  tab bodies inherit the same spacing. Class names in `TabRenderer.tsx`
  are intentionally distinct (different child shapes) — the bug was
  purely a missing CSS rule, not a class-emission mismatch.
- **Hotfix (admin): F3.5.6 follow-up — drop redundant top-level `theme`
  entries from container/button `styleTab`.** `BackgroundSection`
  already renders `<ThemeStyleToggle />` inline at the top of the
  Background controls (`sections/BackgroundSection.tsx` L57), so a
  leading `{ kind: "theme" }` entry on a `styleTab` that also contains
  `{ kind: "background" }` produced two theme toggles stacked above
  each other on the container Style tab (and on button after F3.5.2
  declared its `styleTab` with the same shape). Per-block audit:
  - `container` — `[theme, background, …]` → dropped `theme`. Now
    `[background, borderRadius, border, boxShadow]` (5 → 4 entries).
  - `button` — `[typography, theme, background, …]` → dropped `theme`.
    Now `[typography, background, borderRadius, border, boxShadow]`
    (6 → 5 entries).
  - `text`, `image`, `text-editor`, `video`, `icon`, `html`,
    `divider-spacer` — no leading-`theme`-then-`background` pattern;
    no change. Theme is currently surfaced only via the Background
    section; if a future block needs theme without Background (e.g.
    a future flex-grid section that wants the toggle), re-introduce
    `{ kind: "theme" }` next to that section, not at the top of
    `styleTab`. Regression test: `blockDefinitions.test.ts` now
    asserts no `theme→background` adjacent pair exists in any
    BlockDef.
- **Hotfix: `/entries` route now returns the entries the builder is
  enabled for instead of an empty list.** F3.2's storage migration
  produced rows under doc id `<collection>::<entryId>`, but the F3.5
  rewrite of the `/entries` handler reached for a Kysely handle on
  `(ctx as { db?: unknown }).db` which does not exist —
  `PluginContext` only exposes `kv`, `storage`, `content?`, `media?`,
  `http?`, `log`, `site`, `users?`, `cron?`, `email?`. The cast was a
  type-level lie; at runtime `ctx.db === undefined` and the entire
  host-table SELECT short-circuited, leaving the page-selector table
  blank on Novapera (and any other production host). Cascade: the
  builder topbar showed the bare ULID instead of the entry title
  because `BuilderPage.tsx`'s `selected.title` falls back to
  `selected.id` when the entries response doesn't contain the row.
  - The handler now reads through `ctx.content.list(collection,
    { limit, orderBy: { createdAt: "desc" } })` and merges in the
    per-entry metadata (enabled flag + timestamps) from
    `ctx.storage.layouts.query({ where: { collection } })`. Works
    transparently on SQLite, Postgres, libSQL, D1, and Turso —
    the multi-driver story F3.5 promised but didn't deliver.
  - `resolveSlugToUlid` (the route-boundary slug→ULID resolver for
    fresh entries) goes through `ctx.content.list` for the same
    reason. Capped at 200 rows because the slug→ULID branch is
    only a fresh-entry convenience; a slug that doesn't appear in
    the first 200 most-recent entries is almost certainly stale.
  - The `/toggle` route's "mirror enabled bit onto
    `ec_<collection>.empixel_builder`" UPDATE has been **dropped**.
    It was already a runtime no-op (same `ctx.db` lie); maintaining
    a duplicate enabled bit purely for downstream host queries
    would require expanding the capability surface to
    `content:write`, which fails KISS for a best-effort mirror.
    Hosts that need to filter on `empixel_builder` should read from
    `_plugin_storage` instead (filter by `plugin_id`,
    `collection = "layouts"`, JSON-extract `data.enabled`).
  - New helper `listEntriesForCollection(ctx, collection, limit)` is
    exported from `src/plugin.ts` so the unit test can drive every
    branch directly without spinning up an HTTP layer. Public
    response shape unchanged — `BuilderPage.tsx` /
    `PageSelector.tsx` consume the same `{ id, slug, title,
    created_at, updated_at, builder_enabled }` items as before.
- **Hotfix — `getBuilderLayout(...)` now finds the layout row in
  `_plugin_storage`.** Two bugs landed together in F3.4: (1) the reader
  gated the entire storage read on `Astro.locals.emdash.db` being a
  Kysely instance, but the EmDash middleware only attaches `db` to
  `locals.emdash` on **authenticated/admin** requests — anonymous public
  page renders (the actual host pages the builder targets) get
  `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }` only,
  so the read short-circuited to null; (2) the Kysely query filtered on
  `(plugin_id, collection)` and called `executeTakeFirst()`, which
  returned an arbitrary plugin row — the post-fetch
  `parsed.collection !== collection` guard then forced null even when the
  matching row existed (and collided with stale orphan rows on real
  data). The fix: resolve the Kysely handle through `Astro.locals.emdash.db`
  first, then fall back to `await getDb()` from `emdash/runtime` (the
  public accessor for the same singleton EmDash uses internally) so
  anonymous renders also reach the DB; query for the canonical composite
  doc id `${collection}::${entryId}` (mirrored from `src/plugin.ts §
  layoutDocId`, the same key the plugin runtime writes rows under). The
  lookup is now single-row deterministic, no scan, no orphan-row
  collision. Builder-enabled pages render builder content instead of
  falling back to the host theme's static template. Files: `src/components/db.ts`,
  `tests/getBuilderLayout.test.ts` (+2 regression cases — the Novapera
  multi-row scenario and the orphan-only short-circuit), `.claude/prd-frontend.md`.

- **F3.5.6 — rewrite `RightPanel.tsx` on the declarative pipeline.**
  `RightPanel.tsx` is now a thin shell on top of the
  `BlockDef.fieldsTab` / `styleTab` declarations introduced in
  F3.5.1—F3.5.5. Every per-block imperative branch (9 across the
  Fields and Style tabs) is gone; tab visibility is driven by
  `getVisibleTabs(block)` (replaces the hardcoded
  `hideStyleTab = block.type === "html"` gate). Body dispatch goes
  through `<TabRenderer />` → `<FieldRenderer />` /
  `<SectionRenderer />` / `<AdvancedTab />`.
  - `FieldDef` gained a `kind: "custom"` variant alongside the
    existing `kind: "standard"` (default) shape — mirrors the
    Style-tab equivalent and lets blocks declare their bespoke
    Fields-tab content (`container` LayoutControl/Gap/Overflow/HTML
    tag/link, `video` source + image overlay, `image` preview/
    resolution/link, etc.) through `fieldsTab` without an imperative
    branch. The discriminator is optional on the standard variant so
    every existing declaration compiles unchanged. `FieldRenderer`
    extended with a `customCtx` prop carrying `{ block, panelOnChange,
    activeBreakpoint }` for `kind: "custom"` entries.
  - Six new section components extracted under
    `src/admin/right-panel/sections/`:
    `ContainerLayoutPicker.tsx`, `VideoFieldsSection.tsx`,
    `ImageFieldsSection.tsx`, `TextFieldsExtras.tsx`,
    `LinkFieldsSection.tsx`, `TextEditorFieldsSection.tsx`.
    Each owns the previously-inline state (e.g. `pickerOpen` for the
    image / video media picker, the columns scrub handler) so the
    shell stays state-free.
  - `divider-spacer` Fields tab no longer renders the divider-line
    picker — it lives on the Style tab now (already declared as
    `kind: "custom"` in F3.5.2).
  - `RightPanel.tsx`: 1671 LOC → 162 LOC. The deprecated `fields` /
    `styleFields` aliases on `BlockDef` are kept for one more release
    (still pointed at the same arrays as `fieldsTab`) — F3.5.7 / .8
    can drop them once external consumers (if any) finish migrating.
  - Tests: 171 → 198 (+27 across `rightPanel.test.ts`,
    `blockDefinitions.test.ts` field-count assertions updated).

- **F3.5.5 — universal `<AdvancedTab />` component.** Extract
  `src/admin/right-panel/AdvancedTab.tsx`. One component covers
  Width / Height / Padding / Margin / Position+Offset / Z-Index /
  CSS ID / CSS Classes / Custom CSS for every block — no per-type
  branching. Reads `block.config.advanced` (for the
  position/z-index/css/customCss group) and `block.config.style`
  (for width/height/padding/margin), dispatching merged
  `{ advanced }` or `{ style }` patches via `onChange`. Reuses the
  existing `controls/` primitives (`SpacingControl`,
  `DimensionControl`, `SelectRow`, `NumberRow`, `TextRow`,
  `CodeEditor`, `FieldGroup`) so the markup is identical to the
  inline JSX in `RightPanel.tsx`. The Offset block is conditionally
  revealed only when `advanced.position` is non-empty (matches the
  legacy behavior). `TabRenderer` now renders this component for
  the `advanced` tab — replaces the F3.5.4 placeholder. F3.5.6
  deletes the inline `AdvancedTab` function from `RightPanel.tsx`.

- **F3.5.4 — `TabRenderer` + `getVisibleTabs(block)`.** New
  `src/admin/right-panel/TabRenderer.tsx` wires the 3-tab shell
  (Fields / Style / Advanced) to the declarative `BlockDef` schema.
  `getVisibleTabs(block)` computes the visible set per declaration:
  Fields appears when `def.fieldsTab` (or back-compat `def.fields`) is
  set, Style appears when `def.styleTab` is non-empty, Advanced is
  always present. The Style tab hides automatically when `styleTab` is
  absent — replaces the hardcoded `hideStyleTab = block.type === "html"`
  branch in `RightPanel.tsx`. The Fields body iterates
  `def.fieldsTab ?? def.fields` and dispatches to `<FieldRenderer>` (a
  KISS `kind: "custom"` slot is anticipated for F3.5.6 without
  committing to it today). The Style body iterates `def.styleTab` and
  dispatches to F3.5.3's `<SectionRenderer>`. The Advanced body is a
  placeholder until F3.5.5 ships the real `<AdvancedTab />`. Also
  exports `useAutoSelectTab(block, activeTab, setActiveTab)`, a hook
  that snaps `activeTab` back to the first visible tab when
  `block.type` changes — F3.5.6 imports it as a one-line drop-in.
  `RightPanel.tsx` is unchanged in this PR; F3.5.6 owns the swap.

- **F3.5.3 — `SectionRenderer` dispatcher.** New
  `src/admin/right-panel/SectionRenderer.tsx` maps each
  `StyleSection.kind` to the matching control under
  `src/admin/controls/` (or one of the extracted wrappers under
  `src/admin/right-panel/sections/`). Pure switch — no business logic
  — under 200 LOC. Exhaustiveness enforced via an `assertNever` default
  branch so adding a new `StyleSection` variant in the future causes
  a typecheck error here. The dispatcher is NOT yet wired into
  `RightPanel.tsx`; F3.5.6 will swap the imperative `block.type ===`
  branches over to it. Five new section wrappers landed alongside the
  dispatcher to keep the switch under the LOC ceiling:
  `BackgroundSection.tsx` (Normal/Hover toggle + theme row),
  `StatefulStyleSection.tsx` (shared shell for `borderRadius` /
  `border` / `boxShadow` Normal/Hover state + bp routing),
  `OpacitySection.tsx` (image-block Opacity with state toggle),
  `ImgVisualSection.tsx` (image-block Width/Height/fit/position/align),
  `BpAwareStyleSections.tsx` (small bp-aware wrappers for `alignment` /
  `typography` / `textStroke` / `textShadow` / `blendMode` / `filter` /
  `overflow` / `spacing`).

- **F3.5.2 — migrate all 9 `BlockDef` instances to the declarative
  `fieldsTab` + `styleTab` schema introduced in F3.5.1.** Each of
  `container`, `text`, `image`, `text-editor`, `video`, `button`,
  `icon`, `html`, and `divider-spacer` now declares its Fields tab
  (`fieldsTab: FieldDef[]`) and Style tab (`styleTab: StyleSection[]`)
  through the new schema. Non-trivial Style logic
  (text-editor paragraph spacing + drop cap, video aspect ratio +
  filter, divider-spacer divider-line picker, icon color/size/rotate)
  extracted into `src/admin/right-panel/sections/` and referenced via
  `{ kind: "custom", render: ... }` entries:
    * `TextEditorDropCapSection.tsx` — covers Paragraph Spacing and
      the conditional Drop Cap subgroup (Size / Lines / Margin Right).
    * `VideoSourceSection.tsx` — Aspect Ratio (with custom W/H
      fallback) and `CssFiltersControl`.
    * `DividerLineSection.tsx` — full divider-line picker
      (style / width / length / color or gradient editor / align /
      `IconGroup`). Lifted out of the divider-spacer Fields branch;
      lives under `styleTab` going forward.
    * `IconBlockStyleSection.tsx` — icon color (Normal/Hover), size,
      and rotate. None of these match a built-in `StyleSection`
      variant, so they share one custom entry.
  Existing `fields` / `styleFields` arrays are kept and now alias the
  new `fieldsTab` arrays directly (every block points both keys at the
  same shared array). The hardcoded `block.type === ...` branches in
  `RightPanel.tsx` stay in place — F3.5.6 deletes them and switches
  the panel onto the declarative path.

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
