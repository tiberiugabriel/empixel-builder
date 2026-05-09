import { definePlugin } from "emdash";
import type { RouteContext, PluginContext, PluginStorageConfig } from "emdash";
import type { SectionBlock, BreakpointsConfig, BreakpointId } from "./types.js";
import { DEFAULT_BREAKPOINTS_CONFIG, stripUnknownBlocks } from "./types.js";
import { getDb as getSharedDb, type SqliteDb } from "./dbShared.js";
import type { LayoutRow, StorageLayoutsCollection } from "./storage-types.js";
import { ensureStorageMigrationRan } from "./migrations/toStorageV1.js";

const KV_ENABLED = "settings:enabledCollections";
const KV_BREAKPOINTS = "settings:breakpoints";

// KV key prefix for one-shot migration flags. F3.2 moved migration flags off
// the legacy `empixel_builder_meta` table; legacy values are still honored
// during the transition and lazily synced to KV on first read (see
// `getMigrationFlag`). F3.5 will drop the legacy table.
const KV_MIGRATION_PREFIX = "state:migration:";

const NON_REMOVABLE_BREAKPOINTS: BreakpointId[] = ["desktop", "tablet-portrait", "mobile-portrait"];

// When set to "1", caught-but-soft-failed errors escalate from warn → error so
// they're easier to spot during local debugging. The default (off) keeps the
// log volume sane in production while still leaving a breadcrumb (warn).
const EMPIXEL_DEBUG = process.env.EMPIXEL_DEBUG === "1";

/**
 * Log a caught exception without changing control flow. Soft-fail callers wrap
 * a fallback path around the exception; this helper just makes sure the
 * exception is *visible* (previously these were swallowed silently). Use
 * `ctx` for plugin routes / hooks so it routes through EmDash's logger; pass
 * `null` at module-load time and the helper falls back to `console`.
 */
function logCaught(
  ctx: { log: PluginContext["log"] } | null,
  message: string,
  err: unknown
): void {
  const data = { err: err instanceof Error ? err.message : String(err) };
  if (ctx) {
    if (EMPIXEL_DEBUG) ctx.log.error(message, data);
    else ctx.log.warn(message, data);
  } else {
    if (EMPIXEL_DEBUG) console.error(`[empixel-builder] ${message}:`, err);
    else console.warn(`[empixel-builder] ${message}:`, err);
  }
}

// Whitelist for SQL identifiers built from the `collection` user input. The
// collection name is interpolated into table names like `ec_${collection}`,
// so it MUST be validated before any dynamic statement is prepared. Anything
// else risks SQL injection.
const COLLECTION_RE = /^[a-z0-9_]+$/;

function isValidCollection(name: unknown): name is string {
  return typeof name === "string" && COLLECTION_RE.test(name);
}

// EmDash ULIDs are 26-char Crockford base32 strings starting with `01` (the
// timestamp prefix for any current/future date). Used to distinguish a row
// keyed by ULID vs. one that still carries a slug. The cheaper `startsWith
// ("01")` heuristic appeared in the legacy fallback paths; tightening it to a
// real format check avoids treating slugs that happen to start with "01" as
// ULIDs (e.g. `"01-introduction"`).
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function isUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_RE.test(value);
}

/**
 * Deterministic document id used for `ctx.storage.layouts.put / get / delete`.
 * The storage collection takes a single string `id`; we encode the composite
 * `(collection, entryId)` pair as `${collection}::${entryId}` so direct
 * point-lookups stay O(1) without going through `query({ where })`. Composite
 * indexes on `(collection, entryId)` (declared via `PLUGIN_STORAGE`) make
 * `query` lookups cheap too — the doc-id encoding is a perf detail, not a
 * correctness requirement.
 *
 * Exported for the F3.3 migration helper and unit tests.
 */
export function layoutDocId(collection: string, entryId: string): string {
  return `${collection}::${entryId}`;
}

/**
 * Narrow `ctx.storage.layouts` from EmDash's generic `PluginStorage<...>` map
 * to the typed `StorageLayoutsCollection` we declared in
 * `src/storage-types.ts`. The runtime shape is identical; this cast just
 * carries the row-type through to the call site so writes and reads stay
 * type-safe. PLUGIN_STORAGE guarantees the `layouts` key exists.
 */
function getLayouts(ctx: { storage: PluginContext["storage"] }): StorageLayoutsCollection {
  return ctx.storage.layouts as StorageLayoutsCollection;
}

/**
 * F3.2 read helper. Tries `ctx.storage.layouts.get(layoutDocId)` first; if the
 * row is missing AND the legacy `empixel_builder_layouts` table is reachable,
 * falls back to a single direct SELECT. Returns the typed `LayoutRow` shape so
 * callers don't have to re-parse JSON or worry about `enabled` coercion.
 *
 * The legacy fallback is short-lived — F3.3 migrates rows out of the legacy
 * table, F3.5 will drop the fallback altogether. Until then, hosts upgrading
 * mid-version still read their old layouts correctly. The fallback is the
 * single source of truth for legacy reads — every route handler that reads a
 * layout goes through here.
 *
 * Exported for unit tests only.
 */
export async function readLayoutFromStorageOrLegacy(
  ctx: { log: PluginContext["log"]; storage: PluginContext["storage"] },
  db: SqliteDb,
  collection: string,
  entryId: string
): Promise<LayoutRow | null> {
  // Storage-first: F3.2 writes only land in `ctx.storage.layouts`, so a
  // post-F3.2 row is always served from here.
  let storageRow: LayoutRow | null = null;
  try {
    storageRow = await getLayouts(ctx).get(layoutDocId(collection, entryId));
  } catch (err) {
    logCaught(
      ctx,
      `readLayoutFromStorageOrLegacy: ctx.storage.layouts.get failed for ${collection}/${entryId}`,
      err
    );
  }
  if (storageRow) return storageRow;

  // Legacy fallback. Pre-F3.3 rows live in `empixel_builder_layouts` only —
  // until the migration runs we still need to serve them. After F3.3 lands and
  // a release later F3.5 drops this branch, this function reduces to the
  // storage-only path.
  try {
    const row = db
      .prepare(
        "SELECT sections, enabled, created_at, updated_at FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?"
      )
      .get(collection, entryId) as
      | { sections: string; enabled: number; created_at: string | null; updated_at: string | null }
      | undefined;
    if (!row) return null;
    let sections: SectionBlock[] = [];
    try {
      const parsed = JSON.parse(row.sections);
      if (Array.isArray(parsed)) sections = parsed as SectionBlock[];
    } catch (err) {
      logCaught(
        ctx,
        `readLayoutFromStorageOrLegacy: failed to parse sections JSON for ${collection}/${entryId}`,
        err
      );
    }
    return {
      collection,
      entryId,
      enabled: row.enabled === 1 ? 1 : 0,
      sections,
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  } catch (err) {
    logCaught(
      ctx,
      `readLayoutFromStorageOrLegacy: legacy SELECT failed for ${collection}/${entryId}`,
      err
    );
    return null;
  }
}

/**
 * Per-entry metadata used by the `/entries` route to merge layout-side data
 * with host-CMS rows. Subset of `LayoutRow` — we don't need `sections` here.
 */
interface LayoutEntryMeta {
  entryId: string;
  enabled: 0 | 1;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Read all `LayoutEntryMeta` rows for a collection from the legacy table.
 * Encapsulated so F3.5 can drop the fallback in one place once F3.3 has
 * copied every legacy row into ctx.storage. Errors are logged and treated as
 * "no rows", so the entries route still serves storage-only data.
 */
function readLegacyEntryMetaForCollection(
  ctx: { log: PluginContext["log"] },
  db: SqliteDb,
  collection: string
): LayoutEntryMeta[] {
  try {
    const rows = db
      .prepare(
        "SELECT entry_id, created_at, updated_at, enabled FROM empixel_builder_layouts WHERE collection = ?"
      )
      .all(collection) as Array<{ entry_id: string; created_at: string; updated_at: string; enabled: number }>;
    return rows.map((r) => ({
      entryId: r.entry_id,
      enabled: r.enabled === 1 ? 1 : 0,
      createdAt: r.created_at ?? undefined,
      updatedAt: r.updated_at ?? undefined,
    }));
  } catch (err) {
    logCaught(ctx, `readLegacyEntryMetaForCollection: legacy SELECT failed for ${collection}`, err);
    return [];
  }
}

/**
 * Read a one-shot migration flag. F3.2 moved migration flags into `ctx.kv`;
 * legacy values in `empixel_builder_meta` are still honored during the
 * transition. If the legacy meta says "migrated" but KV doesn't, sync the
 * value to KV so future reads avoid the legacy lookup.
 *
 * Returns `true` if the migration has run. Errors are logged and treated as
 * "not migrated" so the caller can re-run safely.
 *
 * Exported for the F3.3 ctx.storage migration helper, which gates on the
 * `migration_to_storage_v1` flag.
 */
export async function getMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  db: SqliteDb,
  key: string
): Promise<boolean> {
  try {
    const kvValue = await ctx.kv.get<string>(KV_MIGRATION_PREFIX + key);
    if (kvValue) return true;
  } catch (err) {
    logCaught(ctx, `getMigrationFlag: ctx.kv.get failed for ${key}`, err);
  }

  // Legacy fallback. If the meta table says "migrated" but KV doesn't, sync
  // the flag forward so subsequent reads skip the SQL.
  try {
    const row = db
      .prepare("SELECT value FROM empixel_builder_meta WHERE key = ?")
      .get(key) as { value: string } | undefined;
    if (row) {
      try {
        await ctx.kv.set(KV_MIGRATION_PREFIX + key, row.value ?? String(Date.now()));
      } catch (err) {
        logCaught(ctx, `getMigrationFlag: ctx.kv.set sync failed for ${key}`, err);
      }
      return true;
    }
  } catch (err) {
    logCaught(ctx, `getMigrationFlag: legacy meta lookup failed for ${key}`, err);
  }
  return false;
}

/**
 * Set a one-shot migration flag. Writes to `ctx.kv`. Mirrors the write to the
 * legacy `empixel_builder_meta` table so cold-start migrations (which run
 * synchronously inside `getDb()` without access to ctx) can still see the
 * flag and short-circuit. The legacy mirror disappears in F3.5.
 *
 * Exported for the F3.3 migration that copies legacy rows into ctx.storage.
 */
export async function setMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  db: SqliteDb,
  key: string,
  value: string = String(Date.now())
): Promise<void> {
  try {
    await ctx.kv.set(KV_MIGRATION_PREFIX + key, value);
  } catch (err) {
    logCaught(ctx, `setMigrationFlag: ctx.kv.set failed for ${key}`, err);
  }
  try {
    db.prepare("INSERT OR REPLACE INTO empixel_builder_meta (key, value) VALUES (?, ?)").run(
      key,
      value
    );
  } catch (err) {
    logCaught(ctx, `setMigrationFlag: legacy meta upsert failed for ${key}`, err);
  }
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Ensures the `empixel_builder INTEGER NOT NULL DEFAULT 0` column exists on
 * `ec_<collection>`. Hosts no longer need to declare the column in
 * `seed.json` — the plugin augments the schema itself the first time the
 * builder is enabled (or first toggled) for a collection.
 *
 * Idempotent. SQLite raises a "duplicate column name" error when the column
 * already exists; we swallow that specific case and continue. Any other
 * failure (table missing, locked DB, corrupt schema) is logged via
 * `logCaught` so the canonical state in `empixel_builder_layouts` still
 * advances.
 *
 * Caller MUST validate `collection` via `isValidCollection(...)` before
 * calling this — the name is interpolated into a DDL statement and bypasses
 * prepared-statement parameterisation (SQLite doesn't accept identifiers as
 * bound parameters).
 */
export function ensureEmpixelBuilderColumn(
  db: SqliteDb,
  collection: string,
  ctx: { log: PluginContext["log"] } | null = null
): void {
  try {
    db.exec(
      `ALTER TABLE ec_${collection} ADD COLUMN empixel_builder INTEGER NOT NULL DEFAULT 0`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate column/i.test(msg)) {
      // Column already present — the host site declared it in seed.json or a
      // previous enable already augmented the schema. Nothing to do.
      return;
    }
    logCaught(ctx, `ensureEmpixelBuilderColumn: ALTER TABLE ec_${collection} failed`, err);
  }
}

// Tracks which shared SQLite handles have already been initialised by the
// plugin runtime. The shared singleton lives in `dbShared.ts` and is reused
// by the frontend reader (`components/db.ts`); we only need to run schema
// setup + migrations once per handle, but if the host swaps to a different
// `databasePath` and the singleton reopens, we need to re-init the new file.
const initialisedHandles = new WeakSet<SqliteDb>();

function getDb(): SqliteDb {
  const db = getSharedDb();
  if (initialisedHandles.has(db)) return db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_layouts (
      collection TEXT NOT NULL,
      entry_id   TEXT NOT NULL,
      sections   TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (current_timestamp),
      updated_at TEXT DEFAULT (current_timestamp),
      enabled    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection, entry_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  try {
    db.exec("ALTER TABLE empixel_builder_layouts ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0");
  } catch (err) {
    // Most of the time this is the harmless "duplicate column" error from
    // SQLite — the column already exists from a previous run. We still log it
    // so genuine failures (corrupt schema, locked DB) aren't lost.
    logCaught(null, "ALTER TABLE add column 'enabled' failed (likely already present)", err);
  }

  runSpacerMigration(db);
  runSlugToUlidMigration_v1(db);

  initialisedHandles.add(db);
  return db;
}

/**
 * One-time migration: rewrite legacy `spacer` blocks → `divider-spacer`.
 * Idempotent — flagged in `empixel_builder_meta` after first successful run.
 */
function runSpacerMigration(db: SqliteDb): void {
  const FLAG = "migration_spacer_v1";
  try {
    const existing = db.prepare("SELECT value FROM empixel_builder_meta WHERE key = ?").get(FLAG);
    if (existing) return;

    const HEIGHT_TO_PX: Record<string, string> = {
      sm: "32px", md: "64px", lg: "96px", xl: "128px",
    };

    interface OldBlock {
      id: string;
      type: string;
      config?: Record<string, unknown>;
      children?: OldBlock[];
      slots?: OldBlock[][];
    }

    function transform(blocks: OldBlock[]): { changed: boolean; out: OldBlock[] } {
      let changed = false;
      const out: OldBlock[] = [];
      for (const b of blocks) {
        let next: OldBlock = b;
        if (b.type === "spacer") {
          changed = true;
          const oldCfg = (b.config ?? {}) as { height?: string; showDivider?: boolean };
          next = {
            ...b,
            type: "divider-spacer",
            config: {
              ...(b.config ?? {}),
              space: HEIGHT_TO_PX[oldCfg.height ?? "md"] ?? "64px",
              divider: {
                style: oldCfg.showDivider ? "solid" : "none",
                width: "1px",
                length: "100%",
                color: "#000000",
                colorAlpha: 0.12,
                align: "center",
              },
            },
          };
        }
        if (next.children && next.children.length) {
          const childRes = transform(next.children);
          if (childRes.changed) {
            changed = true;
            next = { ...next, children: childRes.out };
          }
        }
        if (next.slots && next.slots.length) {
          const newSlots: OldBlock[][] = [];
          let slotChanged = false;
          for (const slot of next.slots) {
            const res = transform(slot);
            if (res.changed) slotChanged = true;
            newSlots.push(res.out);
          }
          if (slotChanged) {
            changed = true;
            next = { ...next, slots: newSlots };
          }
        }
        out.push(next);
      }
      return { changed, out };
    }

    const rows = db
      .prepare("SELECT collection, entry_id, sections FROM empixel_builder_layouts")
      .all() as Array<{ collection: string; entry_id: string; sections: string }>;
    const updateStmt = db.prepare(
      "UPDATE empixel_builder_layouts SET sections = ?, updated_at = current_timestamp WHERE collection = ? AND entry_id = ?"
    );

    let migrated = 0;
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.sections);
        if (!Array.isArray(parsed)) continue;
        const result = transform(parsed as OldBlock[]);
        if (result.changed) {
          updateStmt.run(JSON.stringify(result.out), row.collection, row.entry_id);
          migrated += 1;
        }
      } catch (err) {
        console.error(
          `[empixel-builder] spacer migration: failed to migrate ${row.collection}/${row.entry_id}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    db.prepare("INSERT OR REPLACE INTO empixel_builder_meta (key, value) VALUES (?, ?)").run(
      FLAG,
      String(Date.now())
    );

    if (migrated > 0) {
      console.log(`[empixel-builder] migrated ${migrated} layout(s) from spacer → divider-spacer`);
    }
  } catch (err) {
    console.error(
      "[empixel-builder] spacer migration failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * One-time migration: rewrite every `empixel_builder_layouts.entry_id` that is
 * still keyed by slug to its canonical ULID. Pre-0.8 routes accepted both, and
 * the read paths walked a slug↔ULID fallback chain on every request. After
 * this migration runs, every row is keyed by ULID and the readers can do a
 * single direct lookup.
 *
 * Idempotent — flagged in `empixel_builder_meta.migration_slug_to_ulid_v1`
 * after first successful run. Wrapped in a transaction so a partial failure
 * doesn't leave the table mid-state.
 *
 * Conflict resolution: if both `(collection, slug)` and `(collection, ulid)`
 * rows exist (the user saved under both keys at different times), keep the
 * newer of the two by `updated_at` and DELETE the loser. When timestamps tie,
 * the ULID-keyed row wins because that's the canonical schema going forward.
 *
 * Unresolvable rows (slug doesn't match any `ec_<collection>.slug`) are LEFT
 * IN PLACE and logged. Deleting them is too aggressive — the user may rename
 * an entry's slug via the host CMS and want to recover the layout manually
 * by re-saving against the new slug. Orphans are harmless: the read path
 * after this migration only matches by ULID, so unresolved slug rows simply
 * never get returned (until somebody fixes them by hand).
 */
export function runSlugToUlidMigration_v1(db: SqliteDb): void {
  const FLAG = "migration_slug_to_ulid_v1";
  try {
    const existing = db.prepare("SELECT value FROM empixel_builder_meta WHERE key = ?").get(FLAG);
    if (existing) return;

    interface Row {
      collection: string;
      entry_id: string;
      updated_at: string | null;
    }

    const rows = db
      .prepare("SELECT collection, entry_id, updated_at FROM empixel_builder_layouts")
      .all() as Row[];

    // Filter to rows that still look slug-shaped — anything that already
    // matches the ULID format is canonical and skipped.
    const slugRows = rows.filter((r) => !ULID_RE.test(r.entry_id));

    if (slugRows.length === 0) {
      // Nothing to migrate. Mark the flag so we don't keep running this
      // every cold start.
      db.prepare("INSERT OR REPLACE INTO empixel_builder_meta (key, value) VALUES (?, ?)").run(
        FLAG,
        String(Date.now())
      );
      return;
    }

    // Resolve slug → ULID via `ec_<collection>` for each row. Cache the
    // resolution by `(collection, slug)` so we don't re-prepare/run for
    // duplicates inside the same migration pass.
    const resolutionCache = new Map<string, string | null>();
    function resolveSlug(collection: string, slug: string): string | null {
      const key = `${collection}::${slug}`;
      if (resolutionCache.has(key)) return resolutionCache.get(key) ?? null;
      // Validate collection so we don't end up running DDL/DML against
      // attacker-shaped table names if a row got planted by hand. The
      // canonical write paths already validate, but defence-in-depth.
      if (!isValidCollection(collection)) {
        resolutionCache.set(key, null);
        return null;
      }
      let resolved: string | null = null;
      try {
        const idRow = db
          .prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`)
          .get(slug) as { id: string } | undefined;
        if (idRow && typeof idRow.id === "string" && ULID_RE.test(idRow.id)) {
          resolved = idRow.id;
        }
      } catch (err) {
        // Table missing / locked / corrupt → log and leave the row in place.
        // We log at module load time; runtime ctx isn't threaded down here.
        logCaught(
          null,
          `slug→ULID migration: ec_${collection} lookup for slug=${slug} failed`,
          err
        );
      }
      resolutionCache.set(key, resolved);
      return resolved;
    }

    // Wrap the rewrite in a transaction. better-sqlite3's prepare/run is
    // synchronous, so a manual BEGIN / COMMIT is the simplest way to keep
    // the table consistent if any single statement throws mid-pass.
    const updateStmt = db.prepare(
      "UPDATE empixel_builder_layouts SET entry_id = ?, updated_at = current_timestamp WHERE collection = ? AND entry_id = ?"
    );
    const deleteStmt = db.prepare(
      "DELETE FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?"
    );
    const conflictRowStmt = db.prepare(
      "SELECT entry_id, updated_at FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?"
    );

    let migrated = 0;
    let unresolved = 0;
    let conflictsResolved = 0;

    db.exec("BEGIN");
    try {
      for (const row of slugRows) {
        const ulid = resolveSlug(row.collection, row.entry_id);
        if (!ulid) {
          unresolved += 1;
          continue;
        }

        // Check for a pre-existing canonical row at (collection, ulid). If
        // present, resolve the conflict and DELETE the slug-keyed loser.
        const existingUlid = conflictRowStmt.get(row.collection, ulid) as
          | { entry_id: string; updated_at: string | null }
          | undefined;

        if (existingUlid) {
          // Conflict — keep the newer row by updated_at (lexicographic
          // string compare works on the SQLite `current_timestamp` ISO-8601
          // format and is monotonic). When equal, prefer the canonical
          // ULID-keyed row.
          const slugTs = row.updated_at ?? "";
          const ulidTs = existingUlid.updated_at ?? "";
          if (slugTs > ulidTs) {
            // Slug row is newer — overwrite the ULID row's contents by
            // deleting the existing ULID row and renaming the slug row.
            deleteStmt.run(row.collection, ulid);
            updateStmt.run(ulid, row.collection, row.entry_id);
          } else {
            // ULID row is newer or tied — drop the slug row.
            deleteStmt.run(row.collection, row.entry_id);
          }
          conflictsResolved += 1;
        } else {
          // No conflict — straight rename.
          updateStmt.run(ulid, row.collection, row.entry_id);
          migrated += 1;
        }
      }

      db.prepare("INSERT OR REPLACE INTO empixel_builder_meta (key, value) VALUES (?, ?)").run(
        FLAG,
        String(Date.now())
      );

      db.exec("COMMIT");
    } catch (innerErr) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // best-effort
      }
      throw innerErr;
    }

    if (migrated > 0 || conflictsResolved > 0 || unresolved > 0) {
      console.log(
        `[empixel-builder] slug→ULID migration: migrated=${migrated} conflicts=${conflictsResolved} unresolved=${unresolved}`
      );
    }
  } catch (err) {
    console.error(
      "[empixel-builder] slug→ULID migration failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Plugin storage declaration. Maps to the existing `empixel_builder_layouts`
 * data model — composite identity `(collection, entryId)`, enforced as a
 * unique composite index so EmDash's storage layer can serve `findOne`-style
 * lookups without a full scan.
 *
 * **Additive only in F3.1.** This declaration just exposes
 * `ctx.storage.layouts` to the plugin context; the existing SQL routes in
 * this file continue to read/write `empixel_builder_layouts` directly via
 * `getDb()`. F3.2 rewrites the route handlers onto `ctx.storage`; F3.3
 * migrates rows out of the legacy table; F3.5 drops the `better-sqlite3`
 * peer dependency once the writers are off it.
 *
 * Declared `as const satisfies PluginStorageConfig` so TS keeps the literal
 * types intact for the `StorageLayoutsCollection` consumer side, while still
 * widening the value to the shape `definePlugin` expects.
 */
const PLUGIN_STORAGE = {
  layouts: {
    indexes: [["collection", "entryId"]],
    uniqueIndexes: [["collection", "entryId"]],
  },
} as const satisfies PluginStorageConfig;

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.8.0",
    capabilities: ["content:read"],
    storage: PLUGIN_STORAGE,
    routes: {
      // GET  ?pageId=&collection=  → load layout
      // POST { pageId, collection, sections } → save layout
      layout: {
        handler: async (ctx: RouteContext) => {
          const method = ctx.request.method;
          const url = new URL(ctx.request.url);

          if (method === "GET") {
            let pageId = url.searchParams.get("pageId");
            const collection = url.searchParams.get("collection");
            if (!pageId || !collection) {
              return badRequest("pageId and collection are required");
            }
            if (!isValidCollection(collection)) {
              return badRequest("Invalid collection name");
            }

            const db = getDb();
            // F3.3 lazy gate — migrate legacy rows into ctx.storage on first
            // request post-upgrade. After the KV flag is set this is O(1).
            await ensureStorageMigrationRan(ctx, db);
            // Fresh-entry case: the host CMS may pass a slug for an entry
            // that has never been saved through the builder before. We still
            // need slug → ULID resolution at the route boundary so the
            // single direct lookup below works. Rows on disk are already
            // ULID-keyed after `runSlugToUlidMigration_v1` (cold start);
            // the legacy fallback chain that walked both keys is gone.
            if (!isUlid(pageId)) {
              try {
                const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(pageId) as { id: string } | undefined;
                if (row && row.id) pageId = row.id;
              } catch (err) {
                logCaught(ctx, `layout GET: slug→ULID lookup failed for ec_${collection}`, err);
              }
            }

            // Storage-first read with legacy table fallback. F3.3 will copy
            // legacy rows over once and F3.5 will drop the fallback.
            const row = await readLayoutFromStorageOrLegacy(ctx, db, collection, pageId);
            if (!row) return { data: null };
            const sections = stripUnknownBlocks(row.sections);
            return { data: { sections } };
          }

          if (method === "POST") {
            const body = ctx.input as { pageId?: string; collection?: string; sections?: SectionBlock[] } | undefined;
            let { pageId } = body ?? {};
            const { collection, sections } = body ?? {};
            if (!pageId || !collection || !sections) {
              return badRequest("pageId, collection and sections are required");
            }
            if (!isValidCollection(collection)) {
              return badRequest("Invalid collection name");
            }

            const db = getDb();
            // F3.3 lazy gate — same as GET. Idempotent + cached after first run.
            await ensureStorageMigrationRan(ctx, db);
            // Same as GET: slug → ULID at the route boundary so the row is
            // always written under its canonical ULID key. After
            // `runSlugToUlidMigration_v1` no row should remain keyed by
            // slug, so the upsert below targets a single canonical row.
            if (!isUlid(pageId)) {
              try {
                const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(pageId) as { id: string } | undefined;
                if (row && row.id) pageId = row.id;
              } catch (err) {
                logCaught(ctx, `layout POST: slug→ULID lookup failed for ec_${collection}`, err);
              }
            }

            // Preserve the per-entry `enabled` flag if the row already exists
            // (POST /toggle owns it, POST /layout shouldn't clobber it).
            const existing = await readLayoutFromStorageOrLegacy(ctx, db, collection, pageId);
            const enabled: 0 | 1 = existing && (existing.enabled === true || existing.enabled === 1) ? 1 : 0;
            const now = new Date().toISOString();
            const next: LayoutRow = {
              collection,
              entryId: pageId,
              enabled,
              sections,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            };

            // Storage-only write. F3.3 will migrate any leftover legacy rows
            // into ctx.storage; F3.5 drops the legacy table entirely. Until
            // then the legacy row is left in place — `readLayoutFromStorageOrLegacy`
            // prefers the storage row, so the legacy one is shadowed.
            await getLayouts(ctx).put(layoutDocId(collection, pageId), next);
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },

      // GET → returns list of collections with builder enabled
      collections: {
        handler: async (ctx: RouteContext) => {
          const enabled = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          return { data: enabled };
        },
      },

      // POST { collection, enabled } → toggle builder on/off for a collection
      settings: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
          }
          const body = ctx.input as { collection?: string; enabled?: boolean } | undefined;
          if (!body?.collection) {
            return new Response(
              JSON.stringify({ error: { message: "collection is required" } }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!isValidCollection(body.collection)) {
            return badRequest("Invalid collection name");
          }

          // Augment the schema on first enable so hosts don't need to declare
          // the column in seed.json. Idempotent — re-enabling or disabling
          // doesn't re-run the ALTER once the column exists. Always-on so a
          // re-enable on a fresh DB picks the column up too.
          if (body.enabled) {
            ensureEmpixelBuilderColumn(getDb(), body.collection, ctx);
          }

          const current = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          const updated = body.enabled
            ? (current.includes(body.collection) ? current : [...current, body.collection])
            : current.filter((c) => c !== body.collection);
          await ctx.kv.set(KV_ENABLED, updated);
          return { success: true };
        },
      },

      // GET ?collection=pages&limit=50 → list entries for page selector
      entries: {
        handler: async (ctx: RouteContext) => {
          const url = new URL(ctx.request.url);
          const collection = url.searchParams.get("collection") ?? "pages";
          const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);

          if (!isValidCollection(collection)) {
            return { error: "Invalid collection name" };
          }

          const db = getDb();
          // F3.3 lazy gate — `/entries` is a heavy read so make sure the
          // storage side is fully populated before merging. Idempotent.
          await ensureStorageMigrationRan(ctx, db);

          // Pull per-entry metadata (enabled flag + timestamps) from
          // ctx.storage.layouts first; merge any legacy rows that haven't yet
          // been migrated by F3.3. Storage rows win on conflict because F3.2
          // writes only land there.
          interface LayoutMeta {
            created_at?: string;
            updated_at?: string;
            enabled: number;
          }
          const meta: Record<string, LayoutMeta> = {};

          // Legacy rows first so storage rows overwrite them on collision.
          // Wrapped in a helper so F3.5 can drop the fallback cleanly once
          // F3.3 has copied every legacy row into ctx.storage.
          for (const r of readLegacyEntryMetaForCollection(ctx, db, collection)) {
            meta[r.entryId] = {
              created_at: r.createdAt,
              updated_at: r.updatedAt,
              enabled: r.enabled,
            };
          }

          try {
            // The storage `query` API paginates with a 100-row default cap.
            // Loop until `hasMore` clears so collections larger than one page
            // still produce complete metadata.
            let cursor: string | undefined;
            for (;;) {
              const page = await getLayouts(ctx).query({
                where: { collection },
                limit: 100,
                cursor,
              });
              for (const item of page.items) {
                const row = item.data;
                meta[row.entryId] = {
                  created_at: row.createdAt,
                  updated_at: row.updatedAt,
                  enabled: row.enabled === true || row.enabled === 1 ? 1 : 0,
                };
              }
              if (!page.hasMore || !page.cursor) break;
              cursor = page.cursor;
            }
          } catch (err) {
            logCaught(ctx, `entries: ctx.storage.layouts.query failed for collection=${collection}`, err);
          }

          let items: { id: string; slug?: string; title?: string; created_at: string; updated_at: string; builder_enabled: boolean }[] = [];
          try {
            const table = `ec_${collection}`;
            const contentRows = db
              .prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ?`)
              .all(limit);

            items = (contentRows as { id: string; slug?: string; title?: string; name?: string; data?: string; created_at: string; updated_at: string }[]).map((entry) => {
              const id = entry.id; // Use real database ID
              const slug = entry.slug ?? id;
              let title = slug;

              if (entry.title) {
                title = entry.title;
              } else if (entry.name) {
                title = entry.name;
              } else if (entry.data) {
                try {
                  const dataObj = JSON.parse(entry.data);
                  if (dataObj && dataObj.title) {
                    title = dataObj.title;
                  }
                } catch (err) {
                  logCaught(ctx, `entries: failed to parse data JSON for entry ${entry.id}`, err);
                }
              }

              return {
                id,
                slug,
                title,
                created_at: meta[id]?.created_at ?? entry.created_at,
                updated_at: meta[id]?.updated_at ?? entry.updated_at,
                builder_enabled: (meta[id]?.enabled ?? 0) === 1,
              };
            });
          } catch (e: unknown) {
            console.error(`[empixel-builder] Failed to fetch entries from ec_${collection}:`, e instanceof Error ? e.message : String(e));
            // Return empty array if table doesn't exist
          }

          return { data: items, collection };
        },
      },

      // POST { entryId, collection, enabled } → toggle builder on/off for a specific entry
      toggle: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method !== "POST") {
            return { error: "Method Not Allowed" };
          }
          const body = ctx.input as { entryId?: string; collection?: string; enabled?: boolean } | undefined;
          let entryId = body?.entryId;
          const collection = body?.collection;

          if (!entryId || !collection) {
            return { error: "entryId and collection are required" };
          }
          if (!isValidCollection(collection)) {
            return { error: "Invalid collection name" };
          }

          const db = getDb();
          // F3.3 lazy gate — toggle is one of the first writes a host hits
          // post-upgrade, so we want the migration to have run before we
          // start putting fresh rows alongside un-migrated legacy rows.
          await ensureStorageMigrationRan(ctx, db);
          // Resolve slug → ULID at the route boundary for fresh entries; on-disk
          // rows are ULID-keyed after `runSlugToUlidMigration_v1`.
          if (!isUlid(entryId)) {
            try {
              const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(entryId) as { id: string } | undefined;
              if (row && row.id) entryId = row.id;
            } catch (err) {
              logCaught(ctx, `toggle: slug→ULID lookup failed for ec_${collection}`, err);
            }
          }

          // Storage-only write. Preserves any existing `sections` (or seeds an
          // empty array on first toggle) and flips `enabled`. Reads consult
          // both ctx.storage and the legacy table so a pre-F3.3 row is
          // upgraded into the storage collection on the first toggle after
          // upgrade.
          const existing = await readLayoutFromStorageOrLegacy(ctx, db, collection, entryId);
          const now = new Date().toISOString();
          const next: LayoutRow = {
            collection,
            entryId,
            enabled: body?.enabled ? 1 : 0,
            sections: existing?.sections ?? [],
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          await getLayouts(ctx).put(layoutDocId(collection, entryId), next);

          // Per-entry toggle can fire without /settings ever being called for
          // this collection. Self-heal the schema here too — hosts no longer
          // need to declare the column in seed.json. The UPDATE below mirrors
          // the enable bit onto the host's `ec_<collection>.empixel_builder`
          // column for downstream consumers (host queries that filter by it).
          ensureEmpixelBuilderColumn(db, collection, ctx);
          db.prepare(`UPDATE ec_${collection} SET empixel_builder = ? WHERE id = ?`).run(body?.enabled ? 1 : 0, entryId);

          return { success: true };
        },
      },

      // GET → returns breakpoints config; POST { enabled, overrides } → saves it
      breakpoints: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method === "GET") {
            const stored = await ctx.kv.get<BreakpointsConfig>(KV_BREAKPOINTS);
            const config: BreakpointsConfig = {
              enabled: Array.isArray(stored?.enabled) ? stored!.enabled : DEFAULT_BREAKPOINTS_CONFIG.enabled,
              overrides: Array.isArray(stored?.overrides) ? stored!.overrides : [],
            };
            return { data: config };
          }
          if (ctx.request.method === "POST") {
            const body = ctx.input as Partial<BreakpointsConfig> | undefined;
            if (!body || !Array.isArray(body.enabled)) {
              return new Response(
                JSON.stringify({ error: { message: "enabled array is required" } }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            // Non-removable breakpoints are always included
            const enabled = Array.from(new Set([...NON_REMOVABLE_BREAKPOINTS, ...body.enabled])) as BreakpointId[];
            const config: BreakpointsConfig = {
              enabled,
              overrides: Array.isArray(body.overrides) ? body.overrides : [],
            };
            await ctx.kv.set(KV_BREAKPOINTS, config);
            return { success: true, data: config };
          }
          return new Response("Method Not Allowed", { status: 405 });
        },
      },
    },
    hooks: {
      "content:afterDelete": {
        handler: async (
          event: { id?: string; entry?: { id: string }; collection?: string },
          ctx: PluginContext
        ) => {
          const entryId = event.id ?? event.entry?.id;
          if (!event.collection || !entryId) return;

          // F3.3 lazy gate — make sure any legacy row for the about-to-be-
          // deleted entry has already been migrated to storage so the
          // cascade delete below removes it from the canonical layer too.
          // Idempotent + cached.
          await ensureStorageMigrationRan(ctx, getDb());

          // Cascade delete from BOTH layers — pre-F3.3 the row may live in the
          // legacy table only; post-F3.2 writes only land in ctx.storage. Both
          // are best-effort; orphaned layout rows are harmless until the same
          // entry id is re-created in the same collection.
          try {
            await getLayouts(ctx).delete(layoutDocId(event.collection, entryId));
          } catch (err) {
            logCaught(
              ctx,
              `content:afterDelete: ctx.storage.layouts.delete failed for ${event.collection}/${entryId}`,
              err
            );
          }
          try {
            getDb()
              .prepare("DELETE FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
              .run(event.collection, entryId);
          } catch (err) {
            logCaught(
              ctx,
              `content:afterDelete: legacy DELETE failed for ${event.collection}/${entryId}`,
              err
            );
          }
        },
      },
    },
    admin: {
      entry: "empixel-builder/admin",
      pages: [
        { path: "/editor", label: "EmPixel Builder" },
      ],
      fieldWidgets: [
        { name: "page-builder", label: "EmPixel Builder", fieldTypes: ["boolean"] },
      ],
    },
  });
}
