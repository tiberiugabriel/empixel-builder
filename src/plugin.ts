import { definePlugin } from "emdash";
import type { RouteContext, PluginContext } from "emdash";
import type { SectionBlock, BreakpointsConfig, BreakpointId } from "./types.js";
import { DEFAULT_BREAKPOINTS_CONFIG, stripUnknownBlocks } from "./types.js";
import { getDb as getSharedDb, type SqliteDb } from "./dbShared.js";

const KV_ENABLED = "settings:enabledCollections";
const KV_BREAKPOINTS = "settings:breakpoints";

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

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.8.0",
    capabilities: ["content:read"],
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

            const row = db
              .prepare("SELECT sections FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
              .get(collection, pageId) as { sections: string } | undefined;

            if (!row) return { data: null };
            const sections = stripUnknownBlocks(JSON.parse(row.sections) as SectionBlock[]);
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

            db
              .prepare(`
                INSERT INTO empixel_builder_layouts (collection, entry_id, sections, updated_at)
                VALUES (?, ?, ?, current_timestamp)
                ON CONFLICT(collection, entry_id) DO UPDATE SET
                  sections = excluded.sections,
                  updated_at = current_timestamp
              `)
              .run(collection, pageId, JSON.stringify(sections));
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
          const rows = db
            .prepare("SELECT entry_id, created_at, updated_at, enabled FROM empixel_builder_layouts WHERE collection = ?")
            .all(collection);
          const meta = Object.fromEntries((rows as { entry_id: string; created_at: string; updated_at: string; enabled: number }[]).map((r) => [r.entry_id, r]));

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

          db
            .prepare(`
              INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at)
              VALUES (?, ?, '[]', ?, current_timestamp)
              ON CONFLICT(collection, entry_id) DO UPDATE SET
                enabled = excluded.enabled,
                updated_at = current_timestamp
            `)
            .run(collection, entryId, body?.enabled ? 1 : 0);

          // Per-entry toggle can fire without /settings ever being called for
          // this collection. Self-heal the schema here too — hosts no longer
          // need to declare the column in seed.json. Once the column is
          // guaranteed present, the UPDATE below can fail loudly; the previous
          // soft-fail catch (column-missing) is no longer needed.
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
          try {
            const entryId = event.id ?? event.entry?.id;
            if (event.collection && entryId) {
              getDb()
                .prepare("DELETE FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
                .run(event.collection, entryId);
            }
          } catch (err) {
            // Cleanup is best-effort; orphaned layout rows are harmless until
            // the same entry id is re-created in the same collection.
            logCaught(ctx, `content:afterDelete: cleanup of empixel_builder_layouts failed for ${event.collection}/${event.id ?? event.entry?.id ?? "?"}`, err);
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
