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

## 2026-05-09 13:21 · F1.5 started

## 2026-05-09 13:13 · F1.4 started

## 2026-05-09 13:05 · F1.1 started

## In progress

*(empty)*

## Done

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
