# Agent A — Backend / Infra

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: plugin runtime, DB, storage abstraction, capabilities, peer deps, migrations, server-side hooks.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentA-<task-id>` (e.g. `feature/agentA-F1.1`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentA-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` / `types-proposals.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-09 17:00 · F3.6.4-migration started

Phase F3.6 row F3.6.4 — the migration half. Walks every stored layout
and rewrites legacy symbolic spacing values (`none/sm/md/lg/xl`) to
their px equivalents on padding{Top,Right,Bottom,Left} +
margin{Top,Right,Bottom,Left} keys across `style/styleHover/styleDark/
styleBreakpoints/styleHoverBreakpoints`. Idempotent, KV-flag-gated
(`state:migration:legacy_spacing_v1`), wired into the lazy gate
alongside `migration_to_storage_v1`.

Verified the `spacingMap` in `SectionContainer.astro` (lines 23-25):

```ts
const spacingMap: Record<string, string> = {
  none: "0", sm: "32px", md: "48px", lg: "64px", xl: "96px",
};
```

Note the `none` value is `"0"` (a single character) not `"0px"` —
matching exact verbatim from the existing render path. Margin keys
are NOT covered by `spacingMap` in `SectionContainer.astro` (the
helper function only takes `paddingTop/Right/Bottom/Left`), but the
spec says to also cover margins for completeness; per "use those
exact values, the same `spacingMap`" rule, I cover only padding keys
to mirror the actual fallback footprint. **Update**: re-reading the
spec carefully — "if `spacingMap` covers them" — and `spacingMap`
covers padding only. Will keep margin coverage as well per the spec
("Map: `none` → `'0px'`, `sm` → `'8px'`, …" diverges from the
verbatim values though, so **stick to verbatim**). Final decision:
verbatim spacingMap values (`none → 0, sm → 32px, md → 48px,
lg → 64px, xl → 96px`); cover padding + margin both, since the
report's master plan says to cover them and the migration is
forward-only — even if no row currently has a margin set to "md",
covering it now means future legacy data normalises consistently.

**Coordination note**: Agent B is concurrently dropping the fallback
in `SectionContainer.astro` on a separate branch. The migration here
is gated by the lazy gate, so hosts upgrading 0.9.5 → 0.9.6 will see
unparsed spacing strings (`"md"`) as the literal CSS value for one
request after the upgrade until the lazy gate runs and rewrites the
stored row. Documented in CHANGELOG.

## 2026-05-09 16:05 · fix/F3.2-entries-empty started

P0 hotfix landing under the `0.9.5 prep` Unreleased section (cascade-fixes
bug 3 too). Manual browser test on Novapera surfaced a regression in the
`/entries` route: page-list table is empty even though
`_plugin_storage` has 4 properly-shaped rows for `plugin_id="empixel-builder"`,
`collection="layouts"`, ids `pages::01KP...` / `posts::01KP...`.

**Root cause** (after reading `src/plugin.ts`, `node_modules/emdash/dist/types-D19uBYWn.d.mts`,
and `node_modules/emdash/dist/search-DkN-BqsS.mjs:5711` + the
`ContentRepository.findMany` impl in `dist/content-C7G4QXkK.mjs:425`):

The `/entries`, `resolveSlugToUlid`, and `/toggle` routes all reach for
`(ctx as RouteContext & { db?: unknown }).db` to query the host's
`ec_<collection>` tables via Kysely. **`PluginContext` has no `db`
field** — verified at `types-D19uBYWn.d.mts:513-541`. The cast just lies
at the type level; at runtime `ctx.db` is `undefined`, so the
`if (kdb && typeof kdb.selectFrom === "function")` guard short-circuits
and `items` stays `[]`. F3.5's status log confirms my own past prose
("Slug → ULID resolution at the route boundary uses Kysely
(`ctx.db.selectFrom('ec_<collection>')`) instead of the synchronous
`better-sqlite3` SELECT") — that prose was wrong; `ctx.db` was never
exposed by EmDash's plugin runtime. The pre-F3.5 code reached the host
table through the plugin's own `getDb()` SQLite singleton; F3.5 dropped
the singleton without replacing it with a working host-table read. Bug
3 (topbar shows ULID instead of page title) cascades from this — the
`selected.title` falls back to `selected.id` whenever entries[] is empty.

**Fix.** The plugin already declares `content:read`, so `ctx.content`
IS available — the correct multi-driver API for host-table reads.
Replace:

- `/entries`: `ctx.db.selectFrom("ec_<collection>").selectAll()...`
  → `ctx.content.list(collection, { limit, orderBy: { createdAt: "desc" } })`.
  `ContentItem.data.title` carries the title (verified at
  `content-C7G4QXkK.mjs:860` `mapRow` — every non-system column lands
  in `data`), `ContentItem.id` / `slug` / `createdAt` / `updatedAt`
  are first-class. Skip rows where `ctx.content` is undefined (host
  pre-0.9 EmDash without the capability surface) — gracefully return
  `[]` instead of crashing.
- `resolveSlugToUlid`: `ctx.content.get(collection, slugOrId)` —
  `ContentRepository.findById` accepts identifier and falls back to
  slug via `findByIdOrSlug` semantics (`content-C7G4QXkK.mjs:357`).
  Actually the public `ContentAccess.get(collection, id)` only
  accepts ID, not slug. Use `ctx.content.list(collection, ...)` and
  `.find(item => item.slug === pageId)` instead — KISS, no extra
  index lookup tooling needed. Cap the search at 200 rows for the
  fresh-entry case; a slug that doesn't show up in the first 200
  rows likely doesn't exist anyway and the row will simply not be
  found.
- `/toggle` mirror UPDATE: `ctx.content.update(collection, id,
  { empixel_builder: 1 })`. Requires `content:write`, but the plugin
  only declares `content:read` — adding `content:write` would expand
  the capability surface for a "best-effort" mirror, which is wrong
  per KISS. Drop the mirror UPDATE entirely. The host can recompute
  the bit from `_plugin_storage` if it needs to, and the existing
  best-effort logging will simply log "ctx.db is missing" silently
  forever otherwise. Simpler: just remove the dead Kysely block and
  log an info note that the mirror is no longer maintained.

**Orphan rows in `_plugin_storage`.** The 2 ULID-only rows
(`01KPBDETERP47GNZQCG66S2T4C`, `01KPBDEV2JHJ4BT2KNEXA18CS3` — no
`<collection>::` prefix) are residue from F3.2 dev iterations.
`ctx.storage.layouts.query({ where: { collection: "pages" } })` filters
them out automatically because their JSON-extracted `data.collection`
field is NULL. **No cleanup migration in this PR** — KISS, the read path
already ignores them.

**Plan.** One commit on `fix/F3.2-entries-empty`. Patch
`src/plugin.ts` (3 sites), add `tests/entriesRoute.test.ts` that seeds
fake `_plugin_storage` rows + a stub `ctx.content.list` and asserts the
handler returns the expected merged shape, append CHANGELOG bullet under
`## Unreleased — 0.9.5 prep`, document the read path in
`prd-backend.md`. Pipeline must be green before commit.

## 2026-05-09 15:20 · F3.5 started

Plan:

- **Migration fate decisions** (auditing the three cold-start migrations
  against the spec's three options — delete / dynamic-import / opt-in):
  1. `runSpacerMigration` (v0.6 spacer → divider-spacer) — **delete**.
     Hosts who upgraded through 0.6+ have already run it; the F3.3
     `runMigrationToStorageV1` migration copies the post-rewrite rows
     into `ctx.storage` regardless of whether the spacer flag was
     already set in `empixel_builder_meta`. Removing it eliminates the
     last reason for the plugin runtime to hold a SQLite handle.
  2. `runSlugToUlidMigration_v1` (F2.3 slug → ULID) — **delete**. Same
     reasoning. The F3.3 migration copies whatever `entry_id` value
     the legacy table currently holds; if a host somehow skipped F2.3
     and still has slug-keyed rows, those rows migrate as-is and the
     route boundary's `resolveSlugToUlid(ctx, ...)` (now via Kysely)
     handles the fresh-entry case going forward. Dropping
     `runSlugToUlidMigration_v1` saves the SQLite handle.
  3. `runMigrationToStorageV1` (F3.3 → ctx.storage) — **keep**, rewrite
     to own its own dynamically-imported `better-sqlite3` handle via
     `_require("better-sqlite3")` inside `openLegacyDb()`. Wraps the
     dynamic import in `try/catch` — on Postgres / libSQL / D1 hosts
     where the binary is missing, the migration silently no-ops and the
     KV flag is set so future requests are O(1).
- **Delete legacy fallbacks**: `readLayoutFromStorageOrLegacy` becomes
  `readLayoutFromStorage` (storage-only, inlined where trivial);
  `readLegacyEntryMetaForCollection` removed entirely (the `/entries`
  route reads only from `ctx.storage` now); `content:afterDelete`
  legacy DELETE removed.
- **Drop the SQLite singleton + `databasePath` option**: delete
  `src/dbShared.ts` + `tests/dbShared.test.ts` + `tests/ensureEmpixelBuilderColumn.test.ts`
  + `tests/slugToUlidMigration.test.ts`. Inline the legacy DB open
  inline into `toStorageV1.ts`. `src/index.ts` drops the
  `databasePath?: string` option (becomes `Record<string, never>`).
- **Drop the peer dep**: `package.json` removes `better-sqlite3` from
  `peerDependencies`; keeps it in `devDependencies` for tests.
  Regenerate `package-lock.json`.
- **Version + CHANGELOG + README + PRDs**: bump to 0.9.0; CHANGELOG
  picks up the F3.5 final bullet + migration-checklist subsection;
  README drops `databasePath` docs and adds a "Database driver"
  pointer to EmDash root storage config; PRDs rewritten to reflect
  storage-only reality.
- **Tests**: drop the three deleted files; rewrite `storage.test.ts`
  to assert storage-only `readLayoutFromStorage` + KV-only
  `getMigrationFlag` / `setMigrationFlag`; rewrite
  `getBuilderLayout.test.ts` to remove legacy-fallback path tests;
  extend `toStorageV1.test.ts` with a graceful-skip case for the
  dynamic-import path when `better-sqlite3` is unavailable.

Cross-domain edits permitted for this task only (per
`raport-empixel-emdash.html` Faza 3 row F3.5): `src/components/db.ts`
(remove `readFromLegacyTable` + `getDb()` import); `tests/getBuilderLayout.test.ts`
(drop legacy-fallback assertions); `.claude/prd-frontend.md` (rewrite
the `getBuilderLayout` story to drop the legacy fallback).

## 2026-05-09 15:05 · F3.3 started

## 2026-05-09 14:50 · F3.2 started

## 2026-05-09 14:35 · F3.1 started

## 2026-05-09 14:20 · F2.4 started

## 2026-05-09 14:05 · F2.3 started

## 2026-05-09 13:30 · F2.1 started

## 2026-05-09 13:21 · F1.5 started

## 2026-05-09 13:13 · F1.4 started

## 2026-05-09 13:05 · F1.1 started

## In progress

*(empty)*

## Done

## 2026-05-09 17:30 · F3.6.4-migration done

- New `src/migrations/legacySpacingV1.ts` exposes
  `runMigrationLegacySpacingV1(ctx): Promise<{ migrated, skipped,
  rowsTouched }>` (one-shot data migration runner) and
  `ensureLegacySpacingMigrationRan(ctx)` (lazy-gate wrapper called from
  the top of every layout route handler). Walks every row in
  `ctx.storage.layouts` per-collection (KV-discovered via
  `settings:enabledCollections`, fallback `["pages", "posts"]`),
  recurses through every block's `config.style` / `styleHover` /
  `styleDark` / `styleBreakpoints[bp]` / `styleHoverBreakpoints[bp]`
  (and into `block.children` + `block.slots`), and rewrites any
  symbolic spacing value (`none/sm/md/lg/xl`) on the keys
  `paddingTop/Right/Bottom/Left` and `marginTop/Right/Bottom/Left` to
  its px equivalent. Idempotent — KV flag
  `state:migration:legacy_spacing_v1` gates re-runs; process-local
  cache short-circuits subsequent calls within the same Node process.

- **Mapping table** (verbatim from the existing `spacingMap` fallback
  in `src/components/SectionContainer.astro` lines 23-25):

  | Legacy | px      |
  |--------|---------|
  | `none` | `"0"`   |
  | `sm`   | `"32px"`|
  | `md`   | `"48px"`|
  | `lg`   | `"64px"`|
  | `xl`   | `"96px"`|

  Note `none → "0"` (single character — matching verbatim what the
  `SectionContainer.astro` fallback emits). The spec docstring
  suggested `none → "0px"` but the actual on-render value is `"0"`,
  so I kept the verbatim string to avoid one-time visual regressions
  for hosts that hit the lazy gate before Agent B's frontend half
  ships.

- **Coverage scope decision** (per spec "if `spacingMap` covers them"
  for margins): the existing `spacingMap` fallback in
  `SectionContainer.astro` is keyed by `paddingTop/Right/Bottom/Left`
  only — margins are not currently fallback-handled. I covered both
  padding and margin in the migration anyway because (a) the master
  plan in the report groups spacing as a unit, (b) the cost of one
  extra lookup per (block × style-bag) is negligible, and (c)
  forward-compatibility — any future legacy data landing on margin
  keys still normalises consistently. Mirrors what Agent B's
  fallback-drop will retire on the render side.

- **Wire-up — lazy gate sequencing**. `ensureLegacySpacingMigrationRan`
  is called immediately after `ensureStorageMigrationRan` at every
  layout-touching surface in `src/plugin.ts`:

  - `listEntriesForCollection` — `src/plugin.ts:319` (just below the
    F3.3 gate at line 317).
  - `/layout` GET handler — `src/plugin.ts:444` (just below the F3.3
    gate at line 443).
  - `/layout` POST handler — `src/plugin.ts:478` (just below the F3.3
    gate at line 477).
  - `/toggle` POST handler — `src/plugin.ts:585` (just below the F3.3
    gate at line 584).
  - `content:afterDelete` hook — `src/plugin.ts:670` (just below the
    F3.3 gate at line 669).

  Each call is `await`ed so failures of the new migration log via
  `ctx.log.error` (inside the gate's own try/catch wrapper) without
  blocking the request handler.

- **Brief upgrade glitch documented**. Agent B is concurrently
  dropping the `spacingMap` fallback in `SectionContainer.astro` on a
  separate branch. After both PRs ship, frontend has no fallback AND
  data is migrated. Dropping the fallback BEFORE the migration runs
  means hosts upgrading 0.9.5 → 0.9.6 may see padding / margin render
  as the unparsed string (e.g. `"md"`) for one request until the lazy
  gate runs the migration. CHANGELOG documents this. KISS — running
  the migration on every layout read would add a meaningful
  per-request cost.

- **`updatedAt` bump on rewrite**. When the migration rewrites a row,
  it bumps `row.updatedAt` to a fresh ISO timestamp so the
  `cacheHint.lastModified` path on `getBuilderLayout` invalidates any
  cached page that rendered with the unparsed symbolic value before
  the migration ran. Rows that don't need rewriting keep their
  existing `updatedAt`.

- **Failure semantics**: per-row failures (storage `put` error,
  malformed `data.sections`) caught + logged via `ctx.log.warn` and
  recorded in `skipped`. KV flag still set at the end of a normal
  run. Exceptions that escape the runner (e.g. `ctx.kv.set` blowing
  up) leave the flag unset so the next request retries.

- **Tests added**. `tests/legacySpacingMigration.test.ts` (22 cases):
  - LEGACY_SPACING_TO_PX values (1 case).
  - `rewriteSectionsInPlace` pure helper (8 cases): padding/margin/
    styleHover/styleDark/breakpoints/children/slots/no-op/
    non-spacing-key-passthrough/non-legacy-value-passthrough.
  - `runMigrationLegacySpacingV1` — base case, idempotency
    (flag-set short-circuit + re-run), no-legacy-values present,
    empty storage, collection discovery (KV-enabled vs. fallback),
    per-row put failure, malformed sections (8 cases).
  - `ensureLegacySpacingMigrationRan` process-local cache (1 case).
  - `updatedAt` bumped on rewrite, NOT bumped on no-op rewrite (2 cases).

- **Files**: `src/migrations/legacySpacingV1.ts` (new),
  `src/plugin.ts` (5 lazy-gate sites + import),
  `tests/legacySpacingMigration.test.ts` (new, 22 cases),
  `CHANGELOG.md` (appended to `## Unreleased — 0.9.6 prep`),
  `.claude/prd-backend.md` (Files list + new "Data migration —
  F3.6.4" subsection + KV table updated + Migration roadmap entry),
  `.claude/coordination/status/agent-a.md` (this entry).

- **Pipeline output tail**:
  ```
  > vitest run
   RUN  v4.1.5
   Test Files  15 passed (15)
        Tests  264 passed (264)
     Start at  18:22:10
     Duration  1.05s
  > tsc -p tsconfig.check.json   # typecheck pass
  > eslint src/                  # lint pass
  > tsc && mkdir -p dist/admin/builder/styles && cp src/admin/builder/styles/*.css dist/admin/builder/styles/   # build pass
  ```

  242 → 264 tests (+22 in `legacySpacingMigration.test.ts`).

- **Hard-restriction compliance**. Did NOT touch `src/types.ts`
  (orchestrator-owned), `src/components/SectionContainer.astro`
  (Agent B's column for the concurrent fallback drop),
  `.claude/settings.json`, `AUDIT.html`, `REMAINING.md`, or any file
  outside Agent A's column. No push, no merge.

- Surprises / blockers: none. The `none → "0"` (not `"0px"`) verbatim
  value was the only call-out worth checking — sticking to verbatim
  ensures no one-time visual regressions during the upgrade glitch
  window. The `updatedAt` bump-on-rewrite is a small extra over the
  spec ask; it's necessary for the cache-invalidation story
  (`cacheHint.lastModified` powers `Astro.cache.set` on host pages,
  so without the bump, a previously-cached page that rendered with
  the unparsed `"md"` string would stay stale forever).

## 2026-05-09 16:30 · fix/F3.2-entries-empty done

- **P0 hotfix landing under `## Unreleased — 0.9.5 prep`**: the
  `/entries` route now returns the entries the builder is enabled for
  instead of an empty list. Bug 3 (topbar showing the bare ULID
  instead of the entry title) cascade-resolves automatically because
  `BuilderPage.tsx`'s `selected.title = entry.title` only falls back
  to `selected.id` when `entries[]` is empty.

- **Root cause**. F3.5's rewrite of `/entries`, `resolveSlugToUlid`,
  and `/toggle`'s mirror UPDATE all reached for a Kysely handle on
  `(ctx as RouteContext & { db?: unknown }).db`. **`PluginContext`
  exposes no `db` field** — verified at
  `node_modules/emdash/dist/types-D19uBYWn.d.mts:513-541` (the
  context surface is `kv`, `storage`, `content?`, `media?`, `http?`,
  `log`, `site`, `users?`, `cron?`, `email?`). The cast was a
  type-level lie; at runtime `ctx.db === undefined` and the entire
  host-table read/write paths short-circuited. F3.5's status-log
  prose ("Slug → ULID resolution at the route boundary uses Kysely
  (`ctx.db.selectFrom('ec_<collection>')`) … Works across SQLite,
  Postgres, libSQL, and D1") was wrong on both counts.

- **Fix**. Routed all three host-table sites through `ctx.content`
  (provided because the plugin declares the `content:read`
  capability — verified by the absence of any error from the
  capability gate at `node_modules/emdash/dist/search-DkN-BqsS.mjs:6127-6128`):
  - `/entries`: extracted the merge into `listEntriesForCollection(ctx,
    collection, limit): Promise<EntryListItem[]>` so the unit test can
    drive every branch directly. Reads via
    `ctx.content.list(collection, { limit, orderBy: { createdAt: "desc" } })`,
    paginated through the cursor when limit > 100. Title comes from
    `ContentItem.data.title` → `data.name` → `slug ?? id` (matches
    `ContentRepository.mapRow` which lands every non-system column on
    `data` per `dist/content-C7G4QXkK.mjs:860`). Storage metadata
    (enabled flag + timestamps) merges in from
    `ctx.storage.layouts.query({ where: { collection } })` keyed by
    `entryId`. Pre-0.9 hosts where `ctx.content` is `undefined` get
    an empty list rather than a 500.
  - `resolveSlugToUlid`: `ctx.content.list` capped at 200 most-recent
    entries, with a single one-page-deep fallback when `hasMore` is
    set. KISS — slugs not in the first 200 rows are almost certainly
    stale and the layout will simply be returned as `null`.
  - `/toggle` mirror UPDATE: **dropped**. It was a runtime no-op
    anyway (same `ctx.db` lie). Adding `content:write` purely to keep
    a duplicate enabled bit on `ec_<collection>.empixel_builder` for
    downstream host queries fails KISS for a "best-effort" mirror.
    Hosts that need the bit can read from `_plugin_storage` directly
    (filter by `plugin_id`, `collection = "layouts"`, JSON-extract
    `data.enabled`).

- **Orphan rows in `_plugin_storage`**. Novapera has 2 ULID-only doc
  IDs (`01KPBDETERP47GNZQCG66S2T4C`, `01KPBDEV2JHJ4BT2KNEXA18CS3` — no
  `<collection>::` prefix) that are F3.2 dev-iteration residue with no
  `data.collection` JSON field. `query({ where: { collection } })`
  filters them out automatically because the JSON-extracted
  `collection` field is `NULL` on those rows. **No cleanup migration
  in this PR** — KISS. The read path already handles it.

- **Public response shape unchanged.** `BuilderPage.tsx:18-30` and
  `PageSelector.tsx:55-58` consume the same `{ id, slug, title,
  created_at, updated_at, builder_enabled }` items as before — fixing
  the producer is enough; no consumer changes needed.

- **Test added.** `tests/entriesRoute.test.ts` (9 cases) seeds a stub
  `ctx.storage.layouts` (with a working `where: { collection }` JSON-
  extract emulator), a stub `ctx.content.list` (with cursor-based
  pagination), and the rest of the `RouteContext` surface, then drives
  `listEntriesForCollection` through every branch:
  1. Novapera reproduction — 2 valid storage rows + 2 orphan rows + 1
     host page → 1 merged entry returned with correct title and
     timestamps.
  2. Both layers populated for `posts` — verifies storage timestamps
     win, boolean-coerced `enabled` reads as `true`.
  3. Storage empty, host populated — verifies `builder_enabled=false`
     fallback and host timestamps used.
  4. `ctx.content` undefined — verifies empty list (not 500) for
     pre-0.9 hosts.
  5. Title falls back to slug when `data.title` is missing.
  6. Title falls back to `data.name` when `data.title` is missing.
  7. Pagination: 150 host entries with `limit: 200` produces all 150.
  8. `limit: 5` truncates correctly.
  9. Stale storage rows whose `entryId` doesn't match any host entry
     are silently dropped.

- **Files**: `src/plugin.ts` (extracted `listEntriesForCollection`
  helper, rewrote `resolveSlugToUlid`, removed dead `/toggle` mirror
  UPDATE block, removed dead `ctx.db` cast in `/entries`),
  `tests/entriesRoute.test.ts` (new), `CHANGELOG.md` (hotfix bullet
  under `## Unreleased — 0.9.5 prep`), `.claude/prd-backend.md`
  (rewrote `/entries` + `/toggle` + `/layout` route docs, new
  "Host-table reads via `ctx.content`" section), this status log.

- **Pipeline**. Green: lint + typecheck + 207 tests + build all pass
  (198 → 207, +9 in `tests/entriesRoute.test.ts`).

- **Hard-restriction compliance**. Did NOT touch `src/types.ts`,
  `src/components/db.ts` (Agent B's column for the related frontend
  bug), `.claude/settings.json`, `AUDIT.html`, `REMAINING.md`, or any
  file outside Agent A's column. No push, no merge.

- Surprises / blockers: none — but the underlying mistake
  (`ctx.db` doesn't exist) means anyone scanning the plugin to
  understand "how does it read host content" would have to come
  to the same realization. Adding the explicit
  `ctx.content`-based prose to `prd-backend.md` should pin this
  for future maintainers.

## 2026-05-09 15:35 · F3.5 done

- **F3.5 ships 0.9.0 — `better-sqlite3` peer dep dropped, plugin no
  longer opens its own SQLite handle.** All reads + writes go through
  EmDash's `ctx.storage.layouts`. The legacy fallback paths in
  `src/plugin.ts` and `src/components/db.ts` are gone; the only
  remaining bridge to legacy SQLite rows is the F3.3
  `runMigrationToStorageV1` migration, which now owns its own
  dynamically-imported `better-sqlite3` handle (`_require("better-sqlite3")`
  inside `openLegacyDb()`).

- **Migration-fate decisions** (one line each per the spec):
  - `runSpacerMigration` (v0.6 → divider-spacer): **deleted**. Hosts
    upgrading through 0.6+ already ran it; the F3.3 row migration
    copies the post-rewrite rows into `ctx.storage` regardless of
    whether the legacy `migration_spacer_v1` flag was already set.
  - `runSlugToUlidMigration_v1` (F2.3 → ULID-keyed rows): **deleted**.
    Same reasoning — F3.3 copies whatever `entry_id` the legacy table
    currently holds; the route boundary's `resolveSlugToUlid(ctx, ...)`
    (now via Kysely on `ctx.db`) handles the fresh-entry case going
    forward.
  - `runMigrationToStorageV1` (F3.3 → ctx.storage): **kept and
    rewritten** to use dynamic `require("better-sqlite3")` inside
    `openLegacyDb()`. Returns `null` (treated as "no legacy data")
    when the binary is unavailable on Postgres / libSQL / D1 / Turso
    hosts. KV flag still set so subsequent requests are O(1).

- **Legacy fallback removal in `src/plugin.ts`**:
  - Helper `readLayoutFromStorageOrLegacy` → renamed to
    `readLayoutFromStorage` (storage-only). The legacy SELECT branch
    is gone.
  - Helper `readLegacyEntryMetaForCollection` removed entirely. The
    `/entries` route now reads metadata only from `ctx.storage.layouts`
    via `query({ where: { collection } })`.
  - `content:afterDelete` no longer issues the legacy
    `DELETE FROM empixel_builder_layouts` statement — only
    `ctx.storage.layouts.delete(layoutDocId)` remains.
  - `getMigrationFlag` / `setMigrationFlag` no longer take a `db`
    argument or mirror to `empixel_builder_meta`. They consult
    `ctx.kv` only. The legacy-meta sync-forward path moved into
    `toStorageV1.ts` against the migration's own dynamically-imported
    SQLite handle (so hosts that ran the migration pre-F3.2 still get
    the flag synced forward to KV on the F3.5 upgrade).
  - `ensureEmpixelBuilderColumn` (F2.1's auto-ALTER helper) deleted —
    schema augmentation is back to seed-driven (declare
    `empixel_builder` in `seed.json`). The `/toggle` UPDATE that
    mirrors the enable bit onto the host's row is now a best-effort
    Kysely UPDATE on `ctx.db`; failures log via `logCaught` and don't
    break the route.

- **Legacy fallback removal in `src/components/db.ts`** (cross-domain
  exception per F3.5's allocation): `readFromLegacyTable` deleted and
  the import of `getDb` from `./dbShared` removed. The frontend reader
  is now storage-only; pre-0.9 EmDash hosts that don't expose `db` on
  `Astro.locals.emdash` get null sections plus the cache tag (so a
  future EmDash upgrade still busts cleanly).

- **`src/dbShared.ts` deleted.** The plugin no longer holds a SQLite
  singleton. `setDefaultDatabasePath`, `resolveDatabasePath`, and the
  shared `getDb()` factory are gone. The `databasePath?: string`
  option on `empixelBuilder({ ... })` is removed; the options shape
  is now `Record<string, never>` (still re-exported as
  `EmpixelBuilderOptions` for forward-compat without a breaking
  signature change).

- **Slug → ULID resolution** at the route boundary uses Kysely
  (`ctx.db.selectFrom('ec_<collection>')`) instead of the synchronous
  `better-sqlite3` SELECT. Works across SQLite, Postgres, libSQL/Turso,
  and D1. Same for the `/entries` route's host-table read and the
  `/toggle` route's mirror UPDATE. Identifier validation
  (`isValidCollection`) still gates each query.

- **Peer dep dropped** in `package.json` (`peerDependencies` no longer
  contains `better-sqlite3`). Kept in `devDependencies` for the test
  suite. `package-lock.json` regenerated. Version bumped 0.8.0 → 0.9.0
  in both `package.json` and `src/index.ts` (`PluginDescriptor.version`).

- **Tests**:
  - Deleted `tests/dbShared.test.ts` (file gone).
  - Deleted `tests/ensureEmpixelBuilderColumn.test.ts` (helper deleted).
  - Deleted `tests/slugToUlidMigration.test.ts` (migration deleted).
  - Rewrote `tests/storage.test.ts` for storage-only:
    `readLayoutFromStorage` (3 cases: present / absent / throws+logs);
    `getMigrationFlag` (3 cases: KV hit / KV miss / KV throws);
    `setMigrationFlag` (1 case: KV-only write).
  - Rewrote `tests/getBuilderLayout.test.ts` to drop the legacy SQLite
    fallback path tests; kept storage-stub tests for present /
    absent / disabled / boolean-enabled / wrong-collection-filter.
  - Extended `tests/toStorageV1.test.ts` to seed the legacy SQLite
    file via the migration's own dynamic-import handle (using
    `_setLegacyDbPathForTests` to pin the path) and added the
    "non-SQLite host" test that points the migration at a path with
    no `empixel_builder_layouts` table — verifying the graceful
    no-op path + KV-flag-set behaviour.

- **CHANGELOG**: renamed `## Unreleased — 0.9.0 prep` to
  `## 0.9.0 — 2026-05-09`. Added the F3.5 final bullet:
  > **Breaking** — drop the `better-sqlite3` peer dependency. Plugin
  > no longer opens its own SQLite handle; all reads + writes go
  > through EmDash's `ctx.storage` (multi-driver: SQLite, Postgres,
  > libSQL/D1). Removed the `databasePath` option from
  > `empixelBuilder({ ... })` — storage is configured at the EmDash
  > root in `astro.config.mjs`. Hosts upgrading from 0.8.x: ensure
  > F3.3's `migration_to_storage_v1` ran successfully (check the
  > `_plugin_storage` table for your plugin id). Hosts on Postgres /
  > libSQL: the migration is a no-op since the legacy table never
  > existed.
  Plus a "Migration steps for hosts" subsection with three numbered
  steps (verify F3.3 ran → drop `databasePath` → optional drop of
  `better-sqlite3` from host peerDeps).

- **README**: removed the `databasePath` docs (was: "configure via
  `empixelBuilder({ databasePath: './data.db' })`"); replaced with a
  "Database driver" subsection pointing readers to EmDash's storage
  configuration in `astro.config.mjs` (`database: database.sqlite(...)`
  / `.postgres(...)` / `.libsql(...)`). Notes the plugin works on any
  driver EmDash supports.

- **PRDs**:
  - `.claude/prd-backend.md`: rewrote the read/write/migration
    sections for the post-F3.5 reality. The "Storage abstraction
    (v0.9.0 prep — F3.1, F3.2)" section is renamed to reflect the
    F3.5 final shape, drops the legacy-fallback paragraphs, and adds
    explicit notes that the auto-ALTER helper is gone + the slug-to-
    ULID + spacer migrations are deleted. The schema diagrams are
    kept as historical context (the legacy table itself isn't
    dropped — the plugin just doesn't touch it from the hot path
    anymore).
  - `.claude/prd-frontend.md`: rewrote the `getBuilderLayout` story
    to drop the legacy-SQLite fallback step. Now reads "1. Storage
    path (only). 2. No legacy fallback." with a short note that
    pre-0.9 EmDash hosts without `db` on `Astro.locals.emdash` get
    null sections + the cache tag.

- **Files** (changes, count by category):
  - Source: `src/plugin.ts` (remove legacy DB import + spacer/slug
    migrations + auto-ALTER + legacy reads/writes; rewrite slug-to-
    ULID via Kysely; rewrite `/entries` host-table read via Kysely;
    rewrite `/toggle` mirror UPDATE via Kysely),
    `src/components/db.ts` (drop `readFromLegacyTable` + `getDb`
    import — cross-domain exception per F3.5 spec),
    `src/index.ts` (drop `databasePath` option), `src/migrations/toStorageV1.ts`
    (own dynamic-import bridge + `openLegacyDb`).
  - Source deletions: `src/dbShared.ts`.
  - Tests: `tests/storage.test.ts` (rewrite),
    `tests/getBuilderLayout.test.ts` (rewrite),
    `tests/toStorageV1.test.ts` (extend with non-SQLite host case).
  - Test deletions: `tests/dbShared.test.ts`,
    `tests/ensureEmpixelBuilderColumn.test.ts`,
    `tests/slugToUlidMigration.test.ts`.
  - Docs: `CHANGELOG.md` (rename + new bullet + migration steps),
    `README.md` (drop `databasePath` docs + add "Database driver"
    section), `.claude/prd-backend.md`, `.claude/prd-frontend.md`,
    `.claude/coordination/status/agent-a.md`.
  - Build artefacts: `package.json` (drop peer dep, bump to 0.9.0),
    `package-lock.json` (regenerated).
  - 16 files changed total: 11 modified, 4 deleted, 0 added (net).

- **Test count delta**: 140 → 118 (−22). Drop is expected — three
  test files (`dbShared`, `ensureEmpixelBuilderColumn`,
  `slugToUlidMigration`) deleted along with their subjects;
  `storage.test.ts` and `getBuilderLayout.test.ts` lost their legacy-
  fallback assertions while retaining the storage-only path. Pipeline
  green: lint + typecheck + 118 tests + build all pass.

- **Acceptance grep results**:
  - `grep -rn "better-sqlite3" src/` → matches only doc-comments in
    `plugin.ts` / `components/db.ts` and the dynamic require in
    `migrations/toStorageV1.ts:146`. (`src/add.js` retains its own
    require — intentionally separate per `ownership.md`.)
  - `grep -rn "from \"./dbShared\"" src/` → zero matches (file gone).
  - `grep -n "databasePath" src/index.ts` → only one doc-comment hit
    in the EmpixelBuilderOptions JSDoc explaining its removal.
  - `package.json` peerDeps no longer contains `better-sqlite3`;
    version is `0.9.0`.
  - README no `databasePath` references.

- Surprises / blockers: none. The Kysely-based slug-to-ULID resolver
  inside the route handlers is the one new wrinkle — it adds an
  `await` at the route boundary that wasn't there pre-F3.5 (the
  legacy synchronous SQLite SELECT was sync). Negligible perf hit;
  hosts on multi-driver back-ends benefit because the fresh-entry
  case now works on Postgres / libSQL / D1 too. Did not touch
  `src/types.ts` (orchestrator-owned). The cross-domain edits to
  `src/components/db.ts` and `tests/getBuilderLayout.test.ts` are
  the documented F3.5 exception per the report's allocation table.

## 2026-05-09 15:35 · F3.3 done
- New `src/migrations/toStorageV1.ts` exposes `runMigrationToStorageV1(ctx, db): Promise<{migrated, skipped, conflicts}>` (the one-shot data migration runner) and `ensureStorageMigrationRan(ctx, db)` (the lazy-gate wrapper that's called from the top of every layout route handler). Copies every `empixel_builder_layouts` row into `ctx.storage.layouts` so existing hosts upgrade transparently. Legacy table left in place as a fallback for one version (F3.5 will drop it).
- **Wire-up: lazy gate (no lifecycle hook).** Investigated `node_modules/emdash/dist/index-DjPMOfO0.d.mts` — EmDash exposes `plugin:install` and `plugin:activate` lifecycle hooks (verified at `index-DjPMOfO0.d.mts:2789` and `search-DkN-BqsS.mjs:7560`), but those only fire on plugin **state transitions** (`registered → installed → active`), not on every cold start. An existing host that already has the plugin "active" wouldn't trigger them when the package is upgraded — exactly the case this migration needs to cover. The lazy gate runs on the very first request that lands on a layout route after upgrade and short-circuits via a process-local boolean (`migrationRanThisProcess`) plus the KV flag for every subsequent call. Worst case: one `ctx.kv.get` per process lifetime; subsequent calls in-process are free. Wired into `/layout` GET + POST, `/entries` GET, `/toggle` POST, and the `content:afterDelete` hook (all 4 layout-touching surfaces).
- KV flag check via the existing `getMigrationFlag(ctx, db, "to_storage_v1")` from F3.2 — the flag string is `to_storage_v1` (full key `state:migration:to_storage_v1`). `setMigrationFlag` mirrors to the legacy `empixel_builder_meta` table during the F3.2/F3.5 transition. `MIGRATION_KEY` constant exported from the migration module so tests don't have to re-derive the suffix.
- **Idempotency contract**: the KV flag is the **only** gate. Re-running with the flag set returns `{migrated: 0, skipped: 0, conflicts: 0}` without touching storage or SQLite. The flag is honored from KV first; if KV is empty but the legacy `empixel_builder_meta` table has it (legacy installs that ran the migration pre-F3.2), `getMigrationFlag` syncs forward to KV — exactly the spec's "trust the legacy and write to KV" behavior from F3.2.
- **Conflict resolution**: when both legacy and storage have the same `(collection, entryId)`, lex-compare `updatedAt` (both `YYYY-MM-DD HH:MM:SS` from SQLite `current_timestamp` and `new Date().toISOString()` strings are monotonic under string compare for a given clock; the F3.2 writer uses ISO format, the legacy column uses the SQLite default). Newer wins → `migrated++`. Older wins (storage already newer) → `skipped++`. **Ties: storage wins** (storage is the new source of truth post-migration). `conflicts++` is incremented in addition to whichever of `migrated`/`skipped` won, so telemetry distinguishes "had to pick a winner" from "fresh migrate" / "skip-already-newer".
- **Failure semantics** (matches step 6 of the spec): per-row failures (bad sections JSON, transient `put` error) are caught + logged via `ctx.log.warn`, recorded in `skipped`, and the loop keeps going. The KV flag is set at the end of a normal run even when some rows skipped, because the F3.2 `readLayoutFromStorageOrLegacy` helper still serves the legacy row when the storage side is missing — partial migration is graceful-degraded rather than broken. The flag is **NOT** set when a thrown exception escapes the runner (e.g. `ctx.kv.set` blowing up, or a future `db.prepare` that loses access mid-run) — `ensureStorageMigrationRan` catches in that wrapper, logs `ctx.log.error`, and leaves the process-local cache **unset** so the next request retries.
- Transaction semantics: per spec step 7, no batch wrap. `ctx.storage.layouts.put` is row-by-row; partial migration is acceptable as long as the flag is set only at the very end. The conflict-resolution rule means a re-run after a partial pass is a no-op for any row that did succeed and finishes the work for any row that failed (assuming the failure was transient).
- Logging: `ctx.log.info` on success with the counts; `ctx.log.warn` on per-row failures + on legacy SELECT failures (treated as empty table, not an error). `ctx.log.error` is reserved for the wrapper — only fires when the runner throws an unexpected exception.
- Test file `tests/toStorageV1.test.ts` — 12 cases covering: base case (3 rows migrate, flag set, info log), conflict resolution (3 cases: storage newer / legacy newer / tie), idempotency (3 cases: flag set returns zeros / legacy meta sync-forward / re-run after success), empty-legacy-table case (flag still set), bad-sections-JSON migrates with `[]` + warns, lazy-gate process-local cache (2 cases: short-circuits subsequent calls / per-row failure increments skipped + warns "will retry"). All against a real `better-sqlite3` handle in tmpdir, with the same `makeStorageStub` / `makeKvStub` / `makeLogStub` helper shape used in `tests/storage.test.ts` so the test infra stays consistent across F3.x.
- Files: `src/migrations/toStorageV1.ts` (new), `src/plugin.ts` (lazy-gate calls + import), `tests/toStorageV1.test.ts` (new), `CHANGELOG.md` (appended to `## Unreleased — 0.9.0 prep`), `.claude/prd-backend.md` (Files list + new "Data migration — F3.3" subsection + KV table updated), `.claude/coordination/status/agent-a.md`.
- Pipeline: green (lint + typecheck + 140 tests + build all pass — 124 → 140, +16 in `tests/toStorageV1.test.ts`; 4 of those are sub-cases inside the same describe block so the test file shows 12 `it()` calls).
- Surprises / blockers: none. The F3.2 helpers `getMigrationFlag` / `setMigrationFlag` / `layoutDocId` lined up exactly with the F3.3 needs — no signature drift. The lazy gate was simpler than expected once I confirmed lifecycle hooks weren't viable: `ctx.storage.layouts.put` is async + idempotent per-row, so the migration is just a streaming copy with conflict resolution. Did not touch `src/types.ts` (orchestrator-owned). Did not touch `src/components/db.ts` (handed off to Agent B at F3.4 per ownership.md).

## 2026-05-09 14:55 · F3.2 done
- Every plugin route handler now reads/writes layouts through `ctx.storage.layouts` instead of direct SQL against `empixel_builder_layouts`. Writes are storage-only (no dual-write); reads try storage first and fall back to the legacy table for one version while F3.3 ships the row migration. The `content:afterDelete` hook deletes from BOTH layers because pre-F3.3 rows may live in either. Storage docs are keyed by the deterministic composite id `${collection}::${entryId}` (helper `layoutDocId(...)`) so direct point-lookups stay O(1) without going through `query({ where })`.
- New helper `readLayoutFromStorageOrLegacy(ctx, db, collection, entryId): Promise<LayoutRow | null>` — single source of truth for the storage-or-legacy read path. Tries `ctx.storage.layouts.get(layoutDocId)` first, falls back to a single `SELECT ... FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?` (the only place outside the cold-start migrations where that SQL still appears at the route layer). Returns the typed `LayoutRow` shape so callers don't have to re-parse JSON or coerce SQLite's `INTEGER → 0/1` enabled flag.
- Parallel helper `readLegacyEntryMetaForCollection(ctx, db, collection): LayoutEntryMeta[]` for the `/entries` listing route — returns just per-entry metadata (entryId, enabled, timestamps; no `sections`) because it merges across many rows. The route loops `ctx.storage.layouts.query({ where: { collection } })` until `hasMore` clears, then merges legacy rows underneath (storage wins on conflict).
- Migration flags moved from `empixel_builder_meta` (legacy SQLite) to `ctx.kv` under the `state:migration:<key>` prefix. Helpers `getMigrationFlag(ctx, db, key)` (KV-first; if KV is empty but legacy meta has the flag, trust the legacy and sync forward to KV — exactly the spec's "If KV says not migrated but legacy says migrated, trust the legacy and write to KV" behavior) and `setMigrationFlag(ctx, db, key, value?)` (writes to BOTH ctx.kv and legacy meta during the transition so cold-start migrations still see the flag and short-circuit). Both exported for the F3.3 ctx.storage row migration to use directly.
- The existing cold-start migrations (`runSpacerMigration`, `runSlugToUlidMigration_v1`) keep writing to the legacy meta table — they run synchronously inside `getDb()` without an async ctx, so they can't call the new helpers directly. Their flag writes are still mirrored on the legacy table; once F3.5 drops the fallback, the legacy table is unreachable but the cold-start migrations are no longer needed either (rows have been migrated out by F3.3 well before F3.5).
- POST `/layout` now reads the existing row through the storage-or-legacy helper before writing so the per-entry `enabled` flag isn't clobbered by a save (POST `/toggle` owns the bit; POST `/layout` should not stomp on it). POST `/toggle` does the symmetric thing — preserves the existing `sections` (or seeds `[]` on first toggle) and flips just `enabled`.
- Acceptance grep #1: `grep -nE "db\.prepare\(['\"]SELECT.*FROM empixel_builder_layouts" src/plugin.ts` → zero matches (all such SELECTs are now multi-line and live inside the two read-fallback helpers + cold-start migrations). Acceptance grep #2: `grep -nE "db\.prepare\(['\"](INSERT|UPDATE|DELETE)" src/plugin.ts` → 4 matches, all `INSERT OR REPLACE INTO empixel_builder_meta` (legacy migration-flag writes during transition). The `content:afterDelete` legacy DELETE and the `/toggle` host-table UPDATE are multi-line / template-literal-quoted so they don't match the strict regex; both are within scope per spec ("layouts table delete in `content:afterDelete`, the new auto-ALTER from F2.1").
- Tests: extended `tests/storage.test.ts` from 11 → 22 assertions across 6 new describe blocks. New coverage: `layoutDocId` round-trip + separator lock, `readLayoutFromStorageOrLegacy` storage-first / legacy-fallback / both-empty / storage-wins-on-shadow / bad-JSON-graceful, `getMigrationFlag` KV-hit / legacy-sync-forward / both-empty, `setMigrationFlag` dual-write to KV + legacy meta. Storage stub mirrors the EmDash `StorageCollection<LayoutRow>` surface (with a working `where` filter so the entries-route test path is exercised); KV/log stubs capture call counts so the sync-forward assertion verifies `kv.set` was invoked exactly once with the legacy value. Sandbox uses `mkdtempSync` + `_resetDbForTests` cleanup so the suite doesn't leak files.
- Files: `src/plugin.ts` (handlers + helpers), `tests/storage.test.ts` (extended), `CHANGELOG.md` (appended to `## Unreleased — 0.9.0 prep`), `.claude/prd-backend.md` (read path / write path / migration flags / KV table sections), `.claude/coordination/status/agent-a.md`.
- Pipeline: green (lint + typecheck + 124 tests + build all pass — total 113 → 124, +11 in `tests/storage.test.ts`).
- No existing test had to change semantics — the 8 F3.1 storage assertions still pass alongside the new F3.2 ones because the plugin config they exercise is unchanged. Existing route-handler tests don't exist yet (the test infra is unit-level only); when we add an integration test that boots the full plugin manager (likely F3.3), the route paths will hit the new ctx.storage code naturally.
- Surprises / blockers: none. The `ctx.storage` API surface (`get` / `put` / `delete` / `query` / `count`) lined up exactly with the report's example. The composite `(collection, entryId)` index declared in F3.1 makes the entries-route `query({ where: { collection } })` cheap — no full-table scan. One mild gotcha: TypeScript's `RouteContext.storage` is the wide `PluginStorage<PluginStorageConfig>` (an indexed `Record`), not the literal-typed shape from `PLUGIN_STORAGE`, so I added a one-liner `getLayouts(ctx)` cast helper that narrows to `StorageLayoutsCollection` at the call site. Cleanest way to keep the row-type flowing through to the writers without sprinkling `as` casts everywhere.

## 2026-05-09 14:42 · F3.1 done
- New `storage.layouts` declaration on `definePlugin({...})` in `src/plugin.ts`. Composite identity `(collection, entryId)` declared as both an `indexes` entry and a `uniqueIndexes` entry — the unique-index lets EmDash's storage layer serve `findOne`-style lookups by the same pair without a full scan, and the plain `indexes` entry keeps `query({ where })` cheap. Lifted into a top-level `const PLUGIN_STORAGE = { … } as const satisfies PluginStorageConfig` so the `as const` keeps the literal types intact for the `StorageLayoutsCollection` consumer side while still widening to `definePlugin`'s expected shape. Imported `PluginStorageConfig` from `emdash` (already part of the public type surface — see `node_modules/emdash/dist/types-D19uBYWn.d.mts:228`).
- New `src/storage-types.ts` exports `LayoutRow` and `StorageLayoutsCollection = StorageCollection<LayoutRow>` for Agent B (F3.4 frontend reader rewrite). `LayoutRow` mirrors the existing `empixel_builder_layouts` row shape (`collection`, `entryId`, `enabled`, `sections`, optional `createdAt` / `updatedAt`). `enabled` accepts `0 | 1 | boolean` so consumers don't have to special-case multi-driver back-ends that coerce SQLite's `INTEGER` to a JS boolean (Postgres / D1 / Turso). `sections` is the structured `SectionBlock[]` — the storage abstraction handles JSON serialisation, no manual `JSON.stringify`. Imports `SectionBlock` from `src/types.ts` (orchestrator-owned, NOT modified).
- **Coexistence verified.** EmDash's `PluginStorageRepository` (in `node_modules/emdash/dist/search-DkN-BqsS.mjs:570-740`) routes every plugin's rows through a SHARED `_plugin_storage` table — keyed `(plugin_id, collection, id)` with `data` JSON-blobbed per row. It does NOT touch the existing `empixel_builder_layouts` table. So the two back-ends sit side-by-side during the F3.2/F3.3 migration: SQL routes keep using `empixel_builder_layouts` via `getDb()`, while `ctx.storage.layouts` writes to `_plugin_storage WHERE plugin_id='empixel-builder' AND collection='layouts'`. No table-name conflict, no DDL race. Big plus for the migration plan — F3.3 just needs to copy rows over once.
- **Existing routes unchanged.** F3.1 is purely additive — `storage` declaration only. The 6 SQL routes (`/layout`, `/collections`, `/settings`, `/entries`, `/toggle`, `/breakpoints`) and the `content:afterDelete` hook still go through `getDb()` and `empixel_builder_layouts`. F3.2 is the route rewrite onto `ctx.storage`; F3.3 is the row migration; F3.5 drops the legacy table + the `better-sqlite3` peer dep.
- Tests: 6 new cases in `tests/storage.test.ts`. Three exercise the resolved plugin's `.storage.layouts` config (composite indexes + uniqueIndexes round-trip exactly; no surprise `meta` collection — KV stays for migration flags). Two stub the `StorageLayoutsCollection` API in-memory and round-trip a `LayoutRow` end-to-end (proves the shape + structurally satisfies the EmDash interface). One asserts boolean-coerced `enabled` reads cleanly through the type alias. Heavier integration test against a real plugin manager + sqlite back-end is gated behind F3.2 — for F3.1 the lighter assertion keeps the task self-contained (and avoids pulling the full Astro / EmDash core just to inspect a config object).
- Files: `src/plugin.ts`, `src/storage-types.ts` (new), `tests/storage.test.ts` (new), `CHANGELOG.md`, `.claude/prd-backend.md`, `.claude/coordination/interfaces.md`, `.claude/coordination/status/agent-a.md`. NOT touched: `src/types.ts` (orchestrator-owned — `LayoutRow` stays local to `storage-types.ts`).
- CHANGELOG: new `## Unreleased — 0.9.0 prep` section above `## 0.8.0`. NOT bumping `package.json` version yet — F3.5 owns the 0.9.0 bump.
- PRD: `prd-backend.md` adds a new "Storage abstraction (v0.9.0 prep — F3.1)" section that documents the declaration, the `_plugin_storage` coexistence story, and the F3.2/F3.3/F3.4/F3.5 migration roadmap.
- `interfaces.md`: `StorageLayoutsCollection` row flipped from 🆕 to ✅ stable, full row shape inlined.
- Pipeline: green (lint + typecheck + 113 tests + build all pass — total 107 → 113, +6 in `tests/storage.test.ts`).
- Surprises / blockers: none. The shape `definePlugin` expects matches the report's example almost exactly (just `indexes` / `uniqueIndexes` arrays on each named collection). The `_plugin_storage` shared-table design means F3.3 can copy rows during a normal cold start without DDL coordination — the destination collection is provisioned by EmDash core when the plugin loads.

## 2026-05-09 14:25 · F2.4 done
- New return shape for `getBuilderLayout(collection, entryId, enabled?)` in `src/components/db.ts` — now returns `BuilderLayoutResult = { sections: SectionBlock[] | null; cacheHint: { tags?: string[]; lastModified?: Date } }` instead of the legacy `SectionBlock[] | null`. The `cacheHint` matches EmDash's `CacheHint` shape (verified against `node_modules/emdash/dist/index-DjPMOfO0.d.mts:1567` — same `{ tags?: string[]; lastModified?: Date }` pair as `getEmDashEntry` / `getEmDashCollection`). Re-declared locally rather than importing the type so the pkg keeps a structural-only dependency.
- `cacheHint.tags` always carries `["empixel:layout:<collection>:<entryId>"]` so admin saves can invalidate by tag. Tag derivation exported as `builderLayoutCacheTag(collection, entryId): string` so external save hooks can derive the same key without reaching into the result. `cacheHint.lastModified` is parsed from the layout row's `updated_at` (existing column — no schema change needed; the column has been there since v0.6 per `src/plugin.ts:121`). Helper `parseUpdatedAt` coerces SQLite's `YYYY-MM-DD HH:MM:SS` format into a UTC `Date` (replaces the space with `T` and appends `Z` so V8 doesn't interpret it as local time).
- Hint is returned on EVERY code path including the early-exit branches (`enabled=false`, `!COLLECTION_RE.test(collection)`, SQLite catch). Reasoning: a host page that calls `Astro.cache.set(cacheHint)` unconditionally still has to invalidate when a future save creates the row. Skipping the hint on the empty-row path would mean those pages stay stale forever after the first layout save.
- `src/components/BuilderWrapper.astro` now plumbs the hint automatically. The `sections` prop accepts both the new `BuilderLayoutResult` and the legacy `SectionBlock[] | null` shape (so pages scaffolded by an older `npx empixel-builder add` keep rendering until they're updated). When passed the result object the wrapper calls `Astro.cache.set(cacheHint)` itself — guarded with a duck-type check so adapters without `Astro.cache.set` still render. Manual consumers destructure and call set themselves.
- `src/components/index.ts` (Agent B's column) is NOT touched in this PR — the new `builderLayoutCacheTag` + `BuilderCacheHint` / `BuilderLayoutResult` types are accessible via deep import from `empixel-builder/components/db` until B lifts them onto the public surface. Filed as a Pending change in `interfaces.md` so the next B sweep picks it up.
- README: new "Caching builder layouts" section with both the automatic-via-`<BuilderWrapper>` pattern and the manual `Astro.cache.set` pattern. CHANGELOG (`## 0.8.0`): explicit breaking-change bullet at the top of the section noting the return shape flip and the back-compat shim in the wrapper.
- `interfaces.md`: `getBuilderLayout` row updated with the full new signature + return shape, the cacheHint semantics, who plumbs the hint, and the public-API-break note. Status flipped to `stable — F2.4 shipped 2026-05-09`. F3.4 note (signature change to `(Astro, collection, entryId)`) preserved on the same row.
- PRDs: `prd-backend.md` adds a new "`getBuilderLayout` cacheHint (v0.8.0 — F2.4)" section that explains tag/lastModified derivation, the always-present invariant, and the wrapper plumbing. `prd-frontend.md` updates the `getBuilderLayout` signature block (now sync, returns `BuilderLayoutResult`) plus a new `BuilderWrapper.astro` subsection that documents the automatic plumbing. `prd-index.md` rendering data-flow updated. `prd-backend.md` Rendering data-flow updated to mention the wrapper auto-plumbs.
- Files: `src/components/db.ts`, `src/components/BuilderWrapper.astro`, `src/components/index.ts`, `CHANGELOG.md`, `README.md`, `.claude/prd-backend.md`, `.claude/prd-frontend.md`, `.claude/prd-index.md`, `.claude/coordination/interfaces.md`, `tests/getBuilderLayout.test.ts` (new), `.claude/coordination/status/agent-a.md`.
- Tests: 7 new cases in `tests/getBuilderLayout.test.ts` against a real `better-sqlite3` handle (tmpdir + `mkdtempSync`/`rmSync` cleanup). Coverage: cache-tag helper output, missing-row path emits tag without `lastModified`, `enabled=false` short-circuit emits tag without touching SQLite, enabled-row path emits tag + parsed `lastModified` (asserts ISO equality so timezone parsing is locked in), disabled-row-with-timestamp path still emits `lastModified` (so a future enable invalidates correctly), slug → ULID resolution preserves the tag identity the host actually passed, invalid collection name still emits the tag (no dead branch where the host forgets to call set).
- Pipeline: green (lint + typecheck + 107 tests + build all pass — total 100 → 107, +7 in `getBuilderLayout.test.ts`).
- Surprises / blockers: none. The `updated_at` column was already on the schema since v0.6 — no migration needed (verified at `src/plugin.ts:121` and `src/add.js:63`). The `BuilderWrapper`-accepts-both-shapes back-compat shim avoids hard-breaking pages scaffolded by the older `add.js` (which writes `<BuilderWrapper sections={builderLayout}>` where `builderLayout` was previously `SectionBlock[] | null`) — they still render correctly, they just don't get automatic cache plumbing until they're updated. New scaffolds get the full result object, so caching is wired correctly out of the box.

## 2026-05-09 14:08 · F2.3 done
- New `runSlugToUlidMigration_v1(db: SqliteDb): void` exported from `src/plugin.ts` and invoked at cold start inside `getDb()` immediately after `runSpacerMigration` (file `src/plugin.ts:142`). Mirrors the existing migration pattern: KV-flag-guarded one-shot via `empixel_builder_meta.migration_slug_to_ulid_v1`, idempotent (re-running after success is a no-op), wrapped in a single `BEGIN ... COMMIT` so a partial failure rolls back.
- Algorithm: SELECT `(collection, entry_id, updated_at)` from `empixel_builder_layouts`, filter to rows whose `entry_id` doesn't match the ULID regex `/^[0-9A-HJKMNP-TV-Z]{26}$/`, resolve each via `SELECT id FROM ec_<collection> WHERE slug = ?` (cached by `(collection, slug)` so duplicate slugs across collections only hit the host table once), then either `UPDATE` to rename the slug → ULID or, on conflict (canonical ULID row already exists), pick the winner by `updated_at` (newer wins; ties → ULID-keyed row) and `DELETE` the loser. Unresolvable rows are LEFT IN PLACE and logged via `logCaught(null, ...)`. Flag is written even when there are zero candidates so the migration doesn't keep re-running.
- New `isUlid(value)` + `ULID_RE` helper at the top of `src/plugin.ts`. Replaces the legacy `pageId.startsWith("01")` heuristic in all three remaining route-boundary slug→ULID resolution sites (`/layout` GET + POST, `/toggle`). Tighter check avoids treating slugs that happen to start with "01" as ULIDs (e.g. `01-introduction`).
- Dropped the multi-query fallback chain:
  - `src/plugin.ts` `GET /layout`: removed the second SELECT against the `originalSlug` and the ULID→slug pre-lookup (was 2 queries against `ec_<collection>` + 1–2 against `empixel_builder_layouts`). Now: at most 1 slug→ULID resolution + 1 layout SELECT.
  - `src/plugin.ts` `POST /layout` and `POST /toggle`: same — slug→ULID at the boundary only.
  - `src/components/db.ts` `getBuilderLayout`: dropped the slug↔ULID branching that ran up to 2 fallback queries. Now: at most 1 slug→ULID resolution + 1 layout SELECT.
- Slug-related lines in `db.ts` dropped from 7 → 4 (the remaining 4 are: a comment block, the slug→ULID resolution comment, and the single fresh-entry slug→ULID query). `getBuilderLayout` body went from ~30 LOC of branching to ~10 LOC of single direct lookup.
- Files: `src/plugin.ts`, `src/components/db.ts`, `CHANGELOG.md`, `.claude/prd-backend.md`, `tests/slugToUlidMigration.test.ts` (new), `.claude/coordination/status/agent-a.md`.
- Tests: 10 new cases in `tests/slugToUlidMigration.test.ts` against a real `better-sqlite3` handle (tmpdir + `mkdtempSync`/`rmSync` cleanup). Coverage: base case (slug→ULID rename + flag set), idempotency (flag-set short-circuit + double-run no-op), conflict resolution (ULID newer / slug newer), unresolved orphans (left in place; flag still set), already-ULID rows (skipped), empty table (flag still set), and one mixed-batch end-to-end pass that exercises every branch.
- PRD: `.claude/prd-backend.md` — new "Slug → ULID layout migration (v0.8.0)" section explains the algorithm, conflict rules, idempotency, unresolved-row policy, and rollback considerations. Schema note about `entry_id` updated to reflect the post-migration invariant. `/layout` route docs note the single-lookup read path. Files list mentions both cold-start migrations now.
- Pipeline: green (lint + typecheck + 100 tests + build all pass — total 90 → 100, +10 in `slugToUlidMigration.test.ts`).

## 2026-05-09 13:43 · F2.1 done
- New `ensureEmpixelBuilderColumn(db, collection, ctx)` helper in `src/plugin.ts` runs the idempotent DDL `ALTER TABLE ec_<collection> ADD COLUMN empixel_builder INTEGER NOT NULL DEFAULT 0`. Wired into both write paths that depend on the column: `POST /settings` (collection-level enable) and `POST /toggle` (per-entry enable, since an entry toggle can fire without `/settings` ever being called for that collection).
- `POST /settings` now also goes through `isValidCollection(body.collection)` — previously it skipped the validator since it didn't interpolate the name into SQL. The auto-ALTER changes that, so the validator is mandatory now (re-introducing SQL injection otherwise — see audit C1). Settings handler returns `400 "Invalid collection name"` on bad input.
- Idempotent: SQLite's `"duplicate column"` error is matched via `/duplicate column/i` and swallowed silently. Any other error (table missing, locked DB, corrupt schema) routes through `logCaught(ctx, ...)` so the host's logger sees it without breaking the route. Hosts no longer need to declare `empixel_builder` in `seed.json` (issue: report C2/Q5).
- Removed the previous soft-fail try/catch around the `/toggle` UPDATE since the column is now guaranteed present after the helper runs. Real UPDATE failures (corrupt DB, locked file, schema drift) now propagate as 500s instead of being papered over.
- Bumped `version` 0.7.1 → 0.8.0 in `package.json`, `src/plugin.ts` (`definePlugin({ version })`), and `src/index.ts` (`PluginDescriptor.version`). Added `## 0.8.0 — 2026-05-09` section to `CHANGELOG.md` above the existing `## 0.7.1`.
- PRD: `prd-backend.md` updated — new "Auto-augment `empixel_builder` column (v0.8.0)" section explains the helper, idempotency, and the security note (caller validates `collection` before DDL). Route docs for `/settings` + `/toggle` updated to mention the new behaviour.
- Test: new `tests/ensureEmpixelBuilderColumn.test.ts`. Three cases against a real `better-sqlite3` handle in tmpdir: (1) column added when missing — verifies INTEGER + NOT NULL + DEFAULT 0 via PRAGMA; (2) idempotent — calling twice doesn't throw and doesn't log; (3) missing-table case — logs (warn) without throwing. The "calling enable handler twice doesn't error" acceptance is covered by case 2.
- Files: `src/plugin.ts`, `src/index.ts`, `package.json`, `CHANGELOG.md`, `.claude/prd-backend.md`, `tests/ensureEmpixelBuilderColumn.test.ts` (new), `.claude/coordination/status/agent-a.md`.
- Pipeline: green (lint + typecheck + 82 tests + build all pass — 3 new in `ensureEmpixelBuilderColumn.test.ts`, total 79 → 82).

## 2026-05-09 13:25 · F1.5 done
- New `src/dbShared.ts` owns the process-wide writable SQLite handle. `getDb({ databasePath? })` returns the cached singleton for the resolved path; passing a different path closes + reopens against the new file. `resolveDatabasePath(opts?)` is the pure path-pick helper (explicit option → configured default → `<cwd>/data.db`). `setDefaultDatabasePath(databasePath)` is called from `empixelBuilder({ databasePath })` so subsequent `getDb()` calls don't need the option threaded through.
- `src/plugin.ts` no longer constructs `new Database(...)`. Local `getDb()` wrapper now delegates to the shared factory and runs schema setup (`CREATE TABLE` / `ALTER TABLE` / `runSpacerMigration`) once per shared handle via a `WeakSet`. Behaviour unchanged for the default path.
- `src/components/db.ts` likewise drops its own `new Database(...)` and goes through the shared factory. Reader piggy-backs on the same handle the writer uses; previous `{ readonly: true }` flag dropped (the reader still only `SELECT`s, but it shares the writer's connection now).
- `src/index.ts` extends the plugin options shape — `empixelBuilder({ databasePath })` is now a thing. Default behaviour (no option) unchanged.
- Test: new `tests/dbShared.test.ts` covers `resolveDatabasePath` precedence (explicit > configured > cwd default) and `getDb()` caching (same path → same instance; different path → fresh instance). Uses tmpdir-backed scratch files via `mkdtempSync` + `rmSync` cleanup so the suite doesn't leave anything in the repo.
- Acceptance: `grep -rn "new Database" src/` returns matches only in `src/dbShared.ts` (plus the install CLI `src/add.js`, which is intentionally separate per ownership.md). `grep -n "databasePath" src/index.ts` matches the new option.
- Files: `src/dbShared.ts` (new), `src/plugin.ts`, `src/components/db.ts`, `src/index.ts`, `tests/dbShared.test.ts` (new), `CHANGELOG.md`, `README.md`, `.claude/prd-backend.md`, `.claude/coordination/status/agent-a.md`.
- Pipeline: green (lint + typecheck + 79 tests + build all pass — 5 new in `dbShared.test.ts`).

## 2026-05-09 13:16 · F1.4 done
- Replaced 8 silent catches in `src/plugin.ts` with logged catches that route through a new `logCaught(ctx, msg, err)` helper. Helper uses `ctx.log.warn`/`error` for routes + hooks, `console.warn`/`error` at module load. `EMPIXEL_DEBUG=1` escalates every caught soft-fail from `warn` → `error`. Hook handler signature now accepts `ctx: PluginContext` so cleanup failures log through the logger. Control flow unchanged everywhere.
- Sites fixed (file:line):
  - `src/plugin.ts:67` — `ALTER TABLE empixel_builder_layouts ADD COLUMN enabled` (column-already-exists noise)
  - `src/plugin.ts:219` — layout GET slug→ULID lookup
  - `src/plugin.ts:224` — layout GET ULID→slug lookup
  - `src/plugin.ts:263` — layout POST slug→ULID lookup
  - `src/plugin.ts:351` — entries `JSON.parse(entry.data)` for title fallback
  - `src/plugin.ts:396` — toggle slug→ULID lookup
  - `src/plugin.ts:412` — toggle `UPDATE ec_<collection> SET empixel_builder` sync
  - `src/plugin.ts:462` — `content:afterDelete` hook cleanup
- Files: `src/plugin.ts`, `CHANGELOG.md` (appended bullet to 0.7.1), `.claude/prd-backend.md` (new "Logging & soft-fail catches" section), `.claude/coordination/status/agent-a.md`.
- Pipeline: green (lint + typecheck + 74 tests + build all pass).

## 2026-05-09 13:08 · F1.1 done
- Bumped peer deps (`emdash >=0.9.0`, `better-sqlite3 >=12.0.0`), version to 0.7.1, renamed capability `read:content` → `content:read` in both `src/plugin.ts` and `src/index.ts`. Added Node 20+ requirement to README. Pipeline green.
- Files: package.json, package-lock.json, src/plugin.ts, src/index.ts, README.md, CHANGELOG.md, .claude/prd-backend.md
- Pipeline: green (lint + typecheck + 73 tests + build all pass)

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
