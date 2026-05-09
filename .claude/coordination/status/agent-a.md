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

## 2026-05-09 14:20 · F2.4 started

## 2026-05-09 14:05 · F2.3 started

## 2026-05-09 13:30 · F2.1 started

## 2026-05-09 13:21 · F1.5 started

## 2026-05-09 13:13 · F1.4 started

## 2026-05-09 13:05 · F1.1 started

## In progress

*(empty)*

## Done

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
