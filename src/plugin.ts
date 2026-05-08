import { definePlugin } from "emdash";
import type { RouteContext } from "emdash";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { SectionBlock, BreakpointsConfig, BreakpointId } from "./types.js";
import { DEFAULT_BREAKPOINTS_CONFIG, stripUnknownBlocks } from "./types.js";

const KV_ENABLED = "settings:enabledCollections";
const KV_BREAKPOINTS = "settings:breakpoints";

const NON_REMOVABLE_BREAKPOINTS: BreakpointId[] = ["desktop", "tablet-portrait", "mobile-portrait"];
const _require = createRequire(import.meta.url);

// Whitelist for SQL identifiers built from the `collection` user input. The
// collection name is interpolated into table names like `ec_${collection}`,
// so it MUST be validated before any dynamic statement is prepared. Anything
// else risks SQL injection.
const COLLECTION_RE = /^[a-z0-9_]+$/;

function isValidCollection(name: unknown): name is string {
  return typeof name === "string" && COLLECTION_RE.test(name);
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

interface SqliteStatement {
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
  run(...args: unknown[]): void;
}

interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

let _db: SqliteDb | null = null;

function getDb(): SqliteDb {
  if (_db) return _db;
  const Database = _require("better-sqlite3");
  _db = new Database(join(process.cwd(), "data.db")) as SqliteDb;
  _db.exec(`
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
  _db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  try {
    _db.exec("ALTER TABLE empixel_builder_layouts ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0");
  } catch {
    // column already exists
  }

  runSpacerMigration(_db);

  return _db;
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

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.7.0",
    capabilities: ["read:content"],
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
            // Resolve slug to ULID if it doesn't look like a ULID (doesn't start with 01)
            let originalSlug = pageId;
            if (!pageId.startsWith("01")) {
              try {
                const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(pageId) as { id: string } | undefined;
                if (row && row.id) pageId = row.id;
              } catch { /* ignore */ }
            } else {
              try {
                const slugRow = db.prepare(`SELECT slug FROM ec_${collection} WHERE id = ?`).get(pageId) as { slug: string } | undefined;
                if (slugRow && slugRow.slug) originalSlug = slugRow.slug;
              } catch { /* ignore */ }
            }

            const row = db
              .prepare("SELECT sections FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
              .get(collection, pageId) as { sections: string } | undefined;
              
            // Fallback for old layouts saved by slug
            if (!row && originalSlug !== pageId) {
               const fallbackRow = db
                 .prepare("SELECT sections FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
                 .get(collection, originalSlug) as { sections: string } | undefined;
               if (fallbackRow) {
                 const fallbackSections = stripUnknownBlocks(JSON.parse(fallbackRow.sections) as SectionBlock[]);
                 return { data: { sections: fallbackSections } };
               }
            }

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
            if (!pageId.startsWith("01")) {
              try {
                const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(pageId) as { id: string } | undefined;
                if (row && row.id) pageId = row.id;
              } catch { /* ignore */ }
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
                } catch {
                  // ignore
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
          if (!entryId.startsWith("01")) {
            try {
              const row = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(entryId) as { id: string } | undefined;
              if (row && row.id) entryId = row.id;
            } catch { /* ignore */ }
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

          // Try to sync the value back to the document table if the column exists
          try {
            db.prepare(`UPDATE ec_${collection} SET empixel_builder = ? WHERE id = ?`).run(body?.enabled ? 1 : 0, entryId);
          } catch {
            // column might not exist or be named differently, ignore
          }

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
        handler: async (event: { id?: string; entry?: { id: string }; collection?: string }) => {
          try {
            const entryId = event.id ?? event.entry?.id;
            if (event.collection && entryId) {
              getDb()
                .prepare("DELETE FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
                .run(event.collection, entryId);
            }
          } catch {
            // ignore cleanup errors
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
