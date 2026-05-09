# empixel-builder — Backend/API

## Role
RESTful API layer for layout persistence and integration with EmDash plugin system.

## Files
- `src/index.ts` — Plugin descriptor (entry point)
- `src/plugin.ts` — 6 REST routes + content hook + cold-start migrations (`runSpacerMigration`, `runSlugToUlidMigration_v1`) + `storage.layouts` declaration + storage-or-legacy read helpers (`readLayoutFromStorageOrLegacy`, `readLegacyEntryMetaForCollection`) + KV migration-flag helpers (`getMigrationFlag`, `setMigrationFlag`) + lazy gate `ensureStorageMigrationRan` at the top of every layout route + the `content:afterDelete` hook
- `src/storage-types.ts` — `LayoutRow` + `StorageLayoutsCollection` types for `ctx.storage.layouts` (consumed by Agent B in F3.4)
- `src/migrations/toStorageV1.ts` — F3.3 one-shot data migration (`runMigrationToStorageV1` + the lazy-gate wrapper `ensureStorageMigrationRan`)
- `src/types.ts` — Block interfaces + type definitions
- `src/dbShared.ts` — Shared SQLite handle factory (`getDb()`)

## Runtime requirements (v0.7.1)

The plugin descriptor declares the following peer-dep floor: `emdash >=0.9.0`,
`better-sqlite3 >=12.0.0`, `astro >=6.0.0`, `react >=19.0.0`,
`react-dom >=19.0.0`, plus optional `@emdash-cms/admin: "*"`. `better-sqlite3`
12 ships native bindings built against Node 20, so the host site must run on
**Node.js 20 or newer** — the README's Requirements section calls this out
explicitly.

The plugin advertises a single capability now: `content:read`. The legacy
`read:content` form was renamed in 0.7.1 because the EmDash marketplace
publish pipeline requires the colon-separated `<resource>:<verb>` shape; both
names still alias inside EmDash core today, but downstream tooling rejects
the old form.

## Logging & soft-fail catches

Every soft-fail path in `plugin.ts` (slug ↔ ULID lookups, `ALTER TABLE`
column-already-exists noise, optional `empixel_builder` column sync,
defensive `JSON.parse`, hook cleanup) routes through the local `logCaught`
helper instead of swallowing the exception. Default level is `warn`
(`ctx.log.warn` for routes / hooks; `console.warn` at module-load time).

Set the env var `EMPIXEL_DEBUG=1` on the host site to escalate every caught
soft-fail to `error` level — useful when investigating why a layout
mysteriously falls back to the unresolved slug, or why an entry table read
returned nothing. Control flow is unchanged either way; this is purely a
visibility lever.

## Auto-augment `empixel_builder` column (v0.8.0)

`ensureEmpixelBuilderColumn(db, collection, ctx)` (in `src/plugin.ts`) runs
the DDL

```sql
ALTER TABLE ec_<collection> ADD COLUMN empixel_builder INTEGER NOT NULL DEFAULT 0
```

so hosts no longer need to declare the column in `seed.json`. Called from
`POST /settings` (first enable per collection) and `POST /toggle` (first
per-entry enable on a collection that skipped `/settings`). Idempotent —
SQLite's `"duplicate column name"` error is swallowed and the helper
returns silently. Any other ALTER failure (table missing, locked DB,
corrupt schema) is routed through `logCaught(ctx, ...)` so it's visible
in the host's log without breaking the route.

**Security**: the caller is responsible for validating `collection` via
`isValidCollection(...)` before the helper runs. SQLite doesn't accept
identifiers as bound parameters, so the collection name is interpolated
into the DDL — bypassing the regex allowlist re-introduces SQL injection
(see audit C1).

After this lands, the `/toggle` UPDATE no longer needs its previous
soft-fail catch: the column is guaranteed present, so any UPDATE failure
is a real bug that should propagate.

## Shared DB factory (v0.7.1)

`src/dbShared.ts` owns the process-wide SQLite handle. Both the plugin
runtime (`plugin.ts`) and the frontend reader (`components/db.ts`) call
`getDb()` from this module instead of constructing their own `new Database(...)`
— the host site holds at most one open file handle to the layouts DB.

Public surface:

- `getDb(opts?: { databasePath?: string })` — returns the cached singleton
  for the resolved path. Subsequent calls with the same path return the same
  instance; calling with a different path closes the cached connection and
  reopens against the new file.
- `resolveDatabasePath(opts?)` — pure helper. Picks the explicit option, then
  the configured default, then `<process.cwd()>/data.db`.
- `setDefaultDatabasePath(databasePath)` — called from `index.ts` when the
  user passes `empixelBuilder({ databasePath })`. Records the value so
  later callers don't need to thread the option through.

Plugin option (consumed by `index.ts`):

```ts
empixelBuilder({ databasePath: "./custom/path/data.db" })
```

Default behaviour (no option provided) is unchanged — the file lives at
`process.cwd()/data.db`.

`plugin.ts` keeps a local `getDb()` wrapper (now thin) that delegates to the
shared factory and runs `CREATE TABLE` / `ALTER TABLE` /
`runSpacerMigration` once per shared handle (tracked via a `WeakSet`). If
the host swaps to a different `databasePath` mid-process, the next call
re-runs schema setup against the new file.

## Storage abstraction (v0.9.0 prep — F3.1, F3.2)

`definePlugin({ storage: { layouts: { … } } })` in `src/plugin.ts` declares
the plugin's typed `ctx.storage.layouts` collection. The shape mirrors the
existing `empixel_builder_layouts` row (composite identity
`(collection, entryId)`, declared as both an `indexes` entry and a
`uniqueIndexes` entry so EmDash's storage layer can serve `findOne`-style
lookups without a full scan).

```ts
const PLUGIN_STORAGE = {
  layouts: {
    indexes: [["collection", "entryId"]],
    uniqueIndexes: [["collection", "entryId"]],
  },
} as const satisfies PluginStorageConfig;
```

**Coexistence with the legacy table.** EmDash's storage abstraction routes
every plugin's rows through the shared `_plugin_storage` table — keyed on
`(plugin_id, collection, id)` with `data` JSON-blobbed per row (see the
`PluginStorageRepository` class in EmDash core). It does **NOT** touch the
existing `empixel_builder_layouts` table at all, so the two back-ends
coexist during the F3 migration: SQL routes keep using `empixel_builder_layouts`
via `getDb()`, while `ctx.storage.layouts` is a separate, fresh collection
in `_plugin_storage`. No table-name conflict, no DDL race.

`src/storage-types.ts` exposes the public types:

- `LayoutRow` — wire shape of one row in the `layouts` collection
  (`collection`, `entryId`, `enabled`, `sections`, `createdAt?`,
  `updatedAt?`). `enabled` accepts `0 | 1 | boolean` so multi-driver
  back-ends (Postgres, D1, Turso) that coerce SQLite's `INTEGER` to a JS
  boolean don't surprise consumers.
- `StorageLayoutsCollection` — alias for `StorageCollection<LayoutRow>`,
  the typed handle EmDash injects on `ctx.storage.layouts`.

### Read path (storage-first, legacy fallback) — F3.2

Every route handler that reads a layout goes through
`readLayoutFromStorageOrLegacy(ctx, db, collection, entryId)`. The helper:

1. Calls `ctx.storage.layouts.get(${collection}::${entryId})` first.
2. If that returns null, falls back to a single direct SELECT against the
   legacy `empixel_builder_layouts` table.
3. Returns a typed `LayoutRow` (or `null`) so the caller never touches
   `JSON.parse` or worries about SQLite's `INTEGER → 0/1` coercion.

The fallback is the **single source of truth** for legacy reads — it's the
only place outside the cold-start migrations where `SELECT … FROM
empixel_builder_layouts` still appears at the route layer. F3.3 will copy
every legacy row into `ctx.storage.layouts`; one release later, F3.5 drops
the helper's else branch and the legacy table is unreachable.

The `/entries` listing route uses a parallel
`readLegacyEntryMetaForCollection(ctx, db, collection)` helper that reads
just the per-entry metadata (entryId, enabled, timestamps — no `sections`)
because it merges across many rows. Same fallback story; same drop point in
F3.5.

The deterministic doc id `${collection}::${entryId}` keeps the storage
`get`/`put`/`delete` calls O(1) without going through `query({ where })`,
mirroring the legacy primary-key lookup.

### Write path (storage-only) — F3.2

`POST /layout`, `POST /toggle`, and any future writer call
`ctx.storage.layouts.put(...)` only. **No dual-write to the legacy table.**
The `content:afterDelete` hook is the one exception: it deletes from BOTH
layers because a pre-F3.3 row may live in either. Once F3.3 has copied
every legacy row over and a release passes, F3.5 drops the legacy DELETE.

`POST /layout` reads the existing row first (through the storage-or-legacy
helper) so the per-entry `enabled` flag isn't clobbered when the editor
saves a new section tree. `POST /toggle` does the symmetric thing in
reverse: it preserves the existing `sections` (or seeds `[]` on first
toggle) and flips just `enabled`.

### Migration flags — F3.2

`migration_spacer_v1` and `migration_slug_to_ulid_v1` previously lived in
the SQLite `empixel_builder_meta` table. F3.2 moves their truth source to
`ctx.kv` under the `state:migration:<key>` prefix. Two helpers wrap the
read/write path:

- `getMigrationFlag(ctx, db, key)` — KV-first; if KV is empty but the
  legacy meta table has the flag, **trust the legacy value** and sync it
  forward to KV. The next call skips the SQL lookup.
- `setMigrationFlag(ctx, db, key, value?)` — writes to BOTH ctx.kv and
  the legacy meta table during the transition so cold-start migrations
  (which run synchronously inside `getDb()` without an async ctx) still
  see the flag and short-circuit.

The existing cold-start migrations stay legacy-table-keyed for now — they
have no async ctx access. The exported helpers are scaffolding for the
F3.3 ctx.storage row migration, which runs from a route handler entry
where ctx is available.

### Data migration — F3.3 (`migration_to_storage_v1`)

`src/migrations/toStorageV1.ts` exports two symbols:

- `runMigrationToStorageV1(ctx, db) → Promise<{ migrated, skipped, conflicts }>`
  is the one-shot migration runner. Copies every row from the legacy
  `empixel_builder_layouts` table into `ctx.storage.layouts` so existing
  hosts upgrade transparently. The legacy table is left in place as a
  fallback for one version (F3.5 drops the fallback and the
  `better-sqlite3` peer dep).
- `ensureStorageMigrationRan(ctx, db)` is the **lazy gate** wrapper
  called from the top of every layout route handler. Idempotent and
  cheap on the hot path: after the first successful run it
  short-circuits via a process-local boolean (so subsequent requests in
  the same Node process don't pay even one `ctx.kv.get`); cold-process
  callers pay one KV read per request until the flag is honoured.

**Wire-up — lazy gate vs. lifecycle hook.** EmDash exposes
`plugin:install` and `plugin:activate` lifecycle hooks (verified in
`node_modules/emdash/dist/index-DjPMOfO0.d.mts:2789` and
`search-DkN-BqsS.mjs:7560`), but they only fire on state transitions
(`registered → installed → active`), not on every cold start. An
existing host that already has the plugin "active" wouldn't trigger
them when the package is upgraded — exactly the case this migration
needs to cover. The lazy gate runs on the very first request that
lands on a layout route after upgrade, costing one `ctx.kv.get` to
check the flag; subsequent requests within the same process are free
via the cache. Wired into `/layout` (GET + POST), `/entries` (GET),
`/toggle` (POST), and the `content:afterDelete` hook in `plugin.ts`.

**Idempotency.** The KV flag `state:migration:to_storage_v1` is the
**only** gate. Re-running with the flag already set returns zeros and
does not touch storage or SQLite. The flag is honoured from KV first;
if KV is empty but the legacy `empixel_builder_meta` table has the
flag (legacy installs that ran the migration pre-F3.2), the value is
synced forward to KV via `getMigrationFlag` so the next call avoids
the SQL lookup entirely.

**Conflict resolution.** If both a legacy row and a storage row exist
for the same `(collection, entryId)`, prefer the row with the newer
`updatedAt` (lex-compared — both the SQLite `current_timestamp`
`YYYY-MM-DD HH:MM:SS` and the modern `new Date().toISOString()`
formats are monotonic under string compare for a given clock). On
ties, **storage wins** — storage is the new source of truth post-
migration, so a tie defaults to "leave the storage row alone".
Conflict count is incremented in addition to the per-row
`migrated`/`skipped` count so the telemetry distinguishes "had to pick
a winner" from "fresh migrate" / "skip-already-newer".

**Failure semantics.** Per-row failures (bad sections JSON, transient
storage `put` error) are caught, logged via `ctx.log.warn`, and
recorded in the `skipped` counter — the loop keeps going. The KV flag
**is** set at the end even if some rows skipped, because the F3.2
`readLayoutFromStorageOrLegacy` helper still serves the legacy row
when the storage side is missing, so a partially-migrated state is
graceful-degraded rather than broken. The flag is **NOT** set when a
caller of the runner throws before reaching the flag write — for
example, if the SELECT itself blows up the runner returns to the
caller with the exception and the gate retries on the next request.

**Rollback story.** No inverse migration exists. The legacy table
stays populated until F3.5 drops it, so if a host needs to roll back
to a pre-F3.3 plugin version, the legacy rows are still there. The
ctx.storage rows would be orphaned, but a future re-run of F3.3 (after
re-upgrading) would consult the legacy table again and resolve
conflicts via `updatedAt`.

### Migration roadmap

- F3.1 — declarative only. Storage collection declared on `definePlugin`.
- F3.2 — route handlers go through `ctx.storage.layouts`.
  Writes are storage-only; reads fall back to the legacy table; deletes
  hit both. Migration flags moved to `ctx.kv`.
- F3.3 (this section) — one-shot migration `migration_to_storage_v1`
  copies every row from `empixel_builder_layouts` into
  `ctx.storage.layouts`. Flag stored in `ctx.kv`. Conflict resolution:
  newer `updatedAt` wins; ties go to storage. Wired through the lazy
  gate `ensureStorageMigrationRan` at the top of every layout route.
- F3.4 (Agent B) — **done 2026-05-09**. `getBuilderLayout` is now async,
  takes `Astro` (or any `BuilderLayoutContext`) as the first argument,
  and reads through the shared `_plugin_storage` table via
  `Astro.locals.emdash.db` (Kysely) when available, falling back to the
  legacy `empixel_builder_layouts` SQLite path via `getDb()` for one
  version. The frontend reader is the new owner of `src/components/db.ts`
  (handed off from Agent A — see `coordination/ownership.md`).
- F3.5 — drop the legacy fallback in `readLayoutFromStorageOrLegacy` and
  `readLegacyEntryMetaForCollection`, drop the legacy DELETE in
  `content:afterDelete`, drop the `better-sqlite3` peer dep + the SQLite
  singleton in `dbShared.ts`. Bumps to 0.9.0.

## API Routes

All routes are under `/_emdash/api/plugins/empixel-builder/<route>`.

### Collection name validation

Every route that interpolates `collection` into a SQL identifier
(`ec_${collection}`) MUST call `isValidCollection(name)` first. Helper at the
top of `plugin.ts` enforces the regex `/^[a-z0-9_]+$/`. Currently used by:
`layout` (GET + POST), `entries` (GET), `toggle` (POST). Skipping the check
re-introduces SQL injection — see audit C1.

### `layout` — GET + POST
**GET** `?pageId=<id>&collection=<name>` → Load layout.
- If `pageId` doesn't match the ULID format, resolves slug → ULID once
  via `ec_<collection>.slug`. This is needed only for the fresh-entry
  case (host CMS hands the builder a slug for an entry never saved
  through the builder before). On-disk rows are ULID-keyed after
  `runSlugToUlidMigration_v1` (see Migrations).
- Reads through `readLayoutFromStorageOrLegacy(ctx, db, collection,
  pageId)` (v0.9 — F3.2): tries `ctx.storage.layouts.get` first, falls
  back to a single direct SELECT against `empixel_builder_layouts` if
  the storage collection doesn't yet have the row. The fallback exists
  for one version while F3.3 migrates rows; F3.5 drops it.
- Returns `{ data: { sections: SectionBlock[] } }` or `{ data: null }`

**POST** `{ pageId, collection, sections }` → Save layout.
- Same slug → ULID resolution as GET — writes always land under the canonical ULID key.
- Reads the existing row first (storage-then-legacy) so the per-entry
  `enabled` flag isn't clobbered. Then writes through
  `ctx.storage.layouts.put(...)` ONLY (v0.9 — F3.2). The legacy table is
  no longer touched on writes; reads still consult it for one version.
- Returns `{ success: true }`

### `entries` — GET
**GET** `?collection=<name>&limit=<n>` → List all entries for a collection with builder metadata.
- Returns `{ data: Entry[], collection }` where `Entry = { id, slug, title, created_at, updated_at, builder_enabled }`
- Builder metadata (enabled flag + timestamps) merges
  `ctx.storage.layouts.query({ where: { collection } })` with
  `readLegacyEntryMetaForCollection(ctx, db, collection)`. Storage rows
  win on conflict because F3.2 writes only land in `ctx.storage`. Pages
  through the storage `query` cursor until `hasMore` clears so
  collections larger than 100 layouts produce complete metadata.
  The host's `ec_<collection>` table provides the entry rows
  themselves (`id`, `slug`, `title`, host timestamps).

### `collections` — GET
**GET** → Returns list of collection names where builder is enabled at collection level.
- Returns `{ data: string[] }` (stored in KV as `settings:enabledCollections`)

### `settings` — POST
**POST** `{ collection, enabled }` → Enable/disable builder for an entire collection.
- Validates `collection` via `isValidCollection(...)` (regex-allowlisted
  identifier — required because the auto-ALTER below interpolates the name
  into a DDL statement).
- On `enabled: true`, runs `ensureEmpixelBuilderColumn(db, collection, ctx)`
  before flipping the KV flag. See **Auto-augment `empixel_builder` column**
  below.
- Stored in KV key `settings:enabledCollections`
- Returns `{ success: true }`

### `toggle` — POST
**POST** `{ entryId, collection, enabled }` → Enable/disable builder for a specific entry.
- Resolves slug to ULID.
- Reads the existing row through `readLayoutFromStorageOrLegacy` so the
  current `sections` aren't lost on first toggle (or seeds `[]` when the
  row doesn't exist yet), then writes through `ctx.storage.layouts.put`
  with the new `enabled` value (v0.9 — F3.2). The legacy table is no
  longer touched on writes.
- Also runs `ensureEmpixelBuilderColumn(...)` before
  `UPDATE ec_<collection> SET empixel_builder = ?` so per-entry toggles
  work even when the collection-level `/settings` enable was skipped.
  Failures from the UPDATE itself now propagate (the previous soft-fail
  catch is gone since the column is guaranteed present after the helper
  runs).
- Returns `{ success: true }`

### `breakpoints` — GET + POST
**GET** → Returns breakpoints config.
- Returns `{ data: BreakpointsConfig }` (from KV key `settings:breakpoints`)
- Falls back to `DEFAULT_BREAKPOINTS_CONFIG` if not set

**POST** `{ enabled: BreakpointId[], overrides: BreakpointOverride[] }` → Save breakpoints config.
- Non-removable breakpoints (`desktop`, `tablet-portrait`, `mobile-portrait`) always included
- Returns `{ success: true, data: BreakpointsConfig }`

## Hooks

### `content:afterDelete`
On entry delete, cascade-delete the layout from BOTH `ctx.storage.layouts`
AND the legacy `empixel_builder_layouts` table (v0.9 — F3.2). Both layers
may carry the row pre-F3.3, so the dual delete is needed for clean
removal. Both calls are best-effort (logged via `logCaught` on failure).
F3.5 will drop the legacy DELETE once F3.3 has copied every row over.

## Database

Table: `empixel_builder_layouts`

```sql
CREATE TABLE IF NOT EXISTS empixel_builder_layouts (
  collection TEXT NOT NULL,
  entry_id   TEXT NOT NULL,
  sections   TEXT NOT NULL DEFAULT '[]',   -- JSON array of SectionBlock
  created_at TEXT DEFAULT (current_timestamp),
  updated_at TEXT DEFAULT (current_timestamp),
  enabled    INTEGER NOT NULL DEFAULT 0,   -- per-entry enable flag
  PRIMARY KEY (collection, entry_id)
)
```

Note: `entry_id` stores the ULID. Pre-0.8 rows that landed under a slug key are rewritten to their canonical ULID by `runSlugToUlidMigration_v1` on cold start (see "Slug → ULID layout migration" below). After that runs, both the route handlers and the frontend reader do a single direct `WHERE entry_id = ?` lookup — the legacy slug↔ULID fallback chain is gone.

Table: `empixel_builder_meta` (v0.6)

```sql
CREATE TABLE IF NOT EXISTS empixel_builder_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
)
```

Stores migration flags and other plugin metadata. Sync access from `getDb()` so migrations don't depend on async KV.

## Migrations (v0.6)

`runSpacerMigration(db)` runs once per database on first `getDb()` call. Steps:

1. Read `empixel_builder_meta` for `migration_spacer_v1`. If present, skip.
2. `SELECT collection, entry_id, sections FROM empixel_builder_layouts`.
3. For each row, JSON-parse, recursively walk the tree (children + slots), rewrite any `type: "spacer"` node to `type: "divider-spacer"` with mapped defaults:
   - `space: { sm: "32px", md: "64px", lg: "96px", xl: "128px" }[old.height]`
   - `divider.style: old.showDivider ? "solid" : "none"` plus default width/length/color/align.
4. `UPDATE` only rows that changed.
5. Write `INSERT OR REPLACE INTO empixel_builder_meta (key, value) VALUES ('migration_spacer_v1', <timestamp>)`.

Per-row failures are caught and logged; the migration flag is still written so the loop doesn't re-run forever. To re-run a failed migration, manually delete the meta row.

## Slug → ULID layout migration (v0.8.0)

`runSlugToUlidMigration_v1(db)` runs once per database on first `getDb()`
call, immediately after `runSpacerMigration`. Pre-0.8 the
`empixel_builder_layouts.entry_id` column accepted either a ULID or a slug
depending on which UI path saved the row, so the read paths walked a
slug↔ULID fallback chain on every request. This migration rewrites every
slug-keyed row to its canonical ULID and drops the multi-query fallback
from the readers.

Steps:

1. Read `empixel_builder_meta` for `migration_slug_to_ulid_v1`. If present, skip.
2. `SELECT collection, entry_id, updated_at FROM empixel_builder_layouts`.
   Filter to rows whose `entry_id` does not match the ULID format
   (`/^[0-9A-HJKMNP-TV-Z]{26}$/`).
3. For each candidate row, resolve the slug via
   `SELECT id FROM ec_<collection> WHERE slug = ?` (the same query the
   route handlers used pre-migration).
4. Rewrite — wrapped in a single `BEGIN ... COMMIT` so a partial failure
   rolls back. Conflict resolution when both `(collection, slug)` and
   `(collection, ulid)` already exist:
   - Compare `updated_at` (lexicographic compare on the SQLite
     `current_timestamp` ISO-8601 string is monotonic).
   - The newer row wins; the loser is `DELETE`d. On ties the ULID-keyed
     row wins because that's the canonical schema going forward.
5. Unresolvable rows (slug doesn't match any host entry) are LEFT IN
   PLACE and logged via `logCaught(null, ...)`. They're harmless once
   the read path matches by ULID — the row simply never gets returned.
   Manual recovery: rename the slug in the host CMS to match, or
   re-save the layout against the new entry.
6. Write `INSERT OR REPLACE INTO empixel_builder_meta (key, value)
   VALUES ('migration_slug_to_ulid_v1', <timestamp>)` to flag the run.

The migration is **idempotent and additive** — re-running after a
successful pass is a no-op, and aborting/re-running mid-pass restarts
from the same set of slug-keyed rows (the transaction rolls back on
failure). Rollback considerations: the migration only writes
`UPDATE` / `DELETE`, so reverting is a matter of restoring from a DB
backup. There's no inverse operation that turns ULIDs back into
slugs, but the legacy fallback paths in `plugin.ts` and `db.ts` would
need to be restored too if a downgrade were needed.

After this lands:

- `plugin.ts` `GET /layout` does ONE `SELECT ... WHERE entry_id = ?`
  query against the resolved ULID (slug-resolution at the route
  boundary is retained ONLY for the fresh-entry case where the host
  CMS hands the builder a slug for an entry that has never been
  saved before).
- `plugin.ts` `POST /layout` and `POST /toggle` likewise resolve at
  the boundary and write under the canonical ULID.
- `components/db.ts` `getBuilderLayout` does ONE `SELECT ...` against
  the resolved ULID. Pre-0.8 this function ran up to three queries
  (direct lookup → slug→ULID → ULID→slug fallback chain).

## `getBuilderLayout` cacheHint (v0.8.0 — F2.4)

`getBuilderLayout(collection, entryId, enabled?)` returns
`BuilderLayoutResult = { sections, cacheHint }` instead of the legacy
`SectionBlock[] | null`. The `cacheHint` matches EmDash's `CacheHint`
shape (`{ tags?: string[]; lastModified?: Date }` from
`emdash/dist/index-DjPMOfO0.d.mts`) and is suitable to pass straight to
`Astro.cache.set(...)` from a host page.

**`tags`** — always carries one entry,
`empixel:layout:<collection>:<entryId>`. Built from the `entryId`
argument the host actually passed (not post-slug-resolution), so admin
saves and host reads bind to the same identity. Future admin save
hooks call `cache.purgeByTags([builderLayoutCacheTag(...)])` and the
host page rerenders. The tag is exported as `builderLayoutCacheTag` so
external consumers can derive it without reaching into the layout
shape.

**`lastModified`** — parsed from the layout row's `updated_at` column
(SQLite `current_timestamp` ISO-8601 — already on the schema, no
column added). Helper coerces the SQLite `YYYY-MM-DD HH:MM:SS` format
into a UTC `Date`. Stamped even when the row exists but is disabled
(future enable still has to bust the cache); skipped when no row
exists or parsing fails (the tag alone is still enough to invalidate).

**Always present** — even on the early-exit paths (`enabled=false`,
invalid collection name, SQLite error) the function returns the
`cacheHint` so host pages can call `Astro.cache.set(cacheHint)`
unconditionally. A fresh save that lands later still emits the same
tag, so a previously-empty page invalidates correctly the moment the
admin creates a layout for it.

`BuilderWrapper.astro` plumbs the hint automatically — pass the full
`BuilderLayoutResult` and the wrapper calls `Astro.cache.set` for you
(legacy `SectionBlock[] | null` shape still accepted for transitional
hosts). Manual consumers destructure and call set themselves; pattern
documented in the README's "Caching builder layouts" section.

## KV Storage

| Key | Type | Purpose |
|-----|------|---------|
| `settings:enabledCollections` | `string[]` | Collections with builder enabled at collection level |
| `settings:breakpoints` | `BreakpointsConfig` | Global breakpoints config (enabled + px overrides) |
| `state:migration:<flag>` | `string` | One-shot migration flag (e.g. `state:migration:migration_spacer_v1`, `state:migration:to_storage_v1`). Mirrors the legacy `empixel_builder_meta` row during the F3.2/F3.5 transition. v0.9 — F3.2/F3.3. |

## Data Flow

### Editing
1. Builder.tsx fetches `GET /layout?pageId=&collection=`
2. Builder.tsx fetches `GET /breakpoints`
3. User edits → state update
4. Save → `POST /layout` + (if breakpointsDirty) `POST /breakpoints`

### Entry enable/disable
1. SettingsPage calls `GET /entries?collection=`
2. User toggles → `POST /toggle { entryId, collection, enabled }`

### Rendering (frontend, v0.9 — F3.4)
1. Astro page calls `await getBuilderLayout(Astro, collection, entryId, enabled?)` — async, takes the Astro request as the first arg.
2. `db.ts` reads `_plugin_storage` via `Astro.locals.emdash.db` (Kysely) when available, partitioned under `plugin_id = "empixel-builder", collection = "layouts"`. F3.2 routes write rows here; F3.3 migrates legacy rows in.
3. On a storage miss (no row yet, or pre-0.9 EmDash host without `db` on locals), the reader falls through to the legacy `empixel_builder_layouts` SQLite table via `getDb()` from `dbShared.ts`. Read-only fallback — kept until F3.5 drops the better-sqlite3 peer dependency.
4. Returns `BuilderLayoutResult = { sections: SectionBlock[] | null; cacheHint: { tags?: string[]; lastModified?: Date } }`. Same contract as v0.8 (F2.4) — only the call shape changed.
5. Host page passes the value (or the unawaited Promise) through `<BuilderWrapper sections={…}>` — wrapper resolves the Promise and auto-plumbs `Astro.cache.set(cacheHint)`. Manual consumers `await` and call set themselves.

## Non-Removable Breakpoints

```ts
const NON_REMOVABLE_BREAKPOINTS = ["desktop", "tablet-portrait", "mobile-portrait"];
```

These are always included when saving breakpoints config, regardless of user selection.

## TODO

- [ ] Add validation for section IDs (must be UUID v4)
- [ ] Add rate limiting to POST /layout
- [ ] Add audit logging (who edited, when)
- [ ] Migrate to separate `empixel_builder_breakpoints` table (currently KV)
- [ ] Add `DELETE /layout` explicit endpoint (currently only via hook)
