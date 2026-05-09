# empixel-builder — Backend/API

## Role
RESTful API layer for layout persistence and integration with EmDash plugin system.

## Files
- `src/index.ts` — Plugin descriptor (entry point)
- `src/plugin.ts` — 6 REST routes + content hook
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
- Resolves slug ↔ ULID automatically (tries `ec_<collection>` table)
- Returns `{ data: { sections: SectionBlock[] } }` or `{ data: null }`

**POST** `{ pageId, collection, sections }` → Save layout.
- Resolves slug to ULID before saving
- Upserts row in `empixel_builder_layouts`
- Returns `{ success: true }`

### `entries` — GET
**GET** `?collection=<name>&limit=<n>` → List all entries for a collection with builder metadata.
- Returns `{ data: Entry[], collection }` where `Entry = { id, slug, title, created_at, updated_at, builder_enabled }`
- Joins `ec_<collection>` with `empixel_builder_layouts` for `builder_enabled` flag

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
- Upserts `empixel_builder_layouts` row with `enabled` = 1/0.
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
On entry delete, cascade-delete layout from `empixel_builder_layouts`.
Prevents orphaned rows.

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

Note: `entry_id` stores the ULID (not slug). Legacy rows may use slug as `entry_id` — the GET/POST handlers include fallback logic for old slug-based rows.

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

## KV Storage

| Key | Type | Purpose |
|-----|------|---------|
| `settings:enabledCollections` | `string[]` | Collections with builder enabled at collection level |
| `settings:breakpoints` | `BreakpointsConfig` | Global breakpoints config (enabled + px overrides) |

## Data Flow

### Editing
1. Builder.tsx fetches `GET /layout?pageId=&collection=`
2. Builder.tsx fetches `GET /breakpoints`
3. User edits → state update
4. Save → `POST /layout` + (if breakpointsDirty) `POST /breakpoints`

### Entry enable/disable
1. SettingsPage calls `GET /entries?collection=`
2. User toggles → `POST /toggle { entryId, collection, enabled }`

### Rendering (frontend)
1. Astro page calls `getBuilderLayout(pageId, collection)`
2. `db.ts` queries `empixel_builder_layouts`
3. Returns deserialized `PageLayout | null`

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
