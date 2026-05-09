import { definePlugin } from "emdash";
import type { RouteContext, PluginContext, PluginStorageConfig } from "emdash";
import type { SectionBlock, BreakpointsConfig, BreakpointId } from "./types.js";
import { DEFAULT_BREAKPOINTS_CONFIG, stripUnknownBlocks } from "./types.js";
import type { LayoutRow, StorageLayoutsCollection } from "./storage-types.js";
import { ensureStorageMigrationRan } from "./migrations/toStorageV1.js";
import { ensureLegacySpacingMigrationRan } from "./migrations/legacySpacingV1.js";

const KV_ENABLED = "settings:enabledCollections";
const KV_BREAKPOINTS = "settings:breakpoints";

// KV key prefix for one-shot migration flags. F3.2 moved migration flags off
// the legacy `empixel_builder_meta` table; F3.5 dropped the legacy table
// from the plugin's hot path entirely. The
// `to_storage_v1` migration still consults the legacy meta row when KV
// is empty (for hosts that flipped the flag pre-F3.2) — that lookup runs
// inside `toStorageV1.ts` against its own dynamically-imported SQLite
// handle, not `plugin.ts`.
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

// Whitelist for the `collection` user input. We don't interpolate it into
// raw SQL anymore (the route-handler reads go through `ctx.content` and
// `ctx.storage`), but the helper still validates each route param so a
// malformed collection name fails fast instead of cascading through
// EmDash's content layer.
const COLLECTION_RE = /^[a-z0-9_]+$/;

function isValidCollection(name: unknown): name is string {
  return typeof name === "string" && COLLECTION_RE.test(name);
}

// EmDash ULIDs are 26-char Crockford base32 strings starting with `01` (the
// timestamp prefix for any current/future date). Used to distinguish a row
// keyed by ULID vs. one that still carries a slug at the route boundary
// (fresh-entry case where the host CMS hands us a slug for an entry that
// has never been saved through the builder).
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
 * F3.5 read helper. Storage-only — `ctx.storage.layouts.get(layoutDocId)`
 * is the entire read path. The legacy SQLite fallback that lived here in
 * F3.2/F3.3 was dropped in F3.5; the `runMigrationToStorageV1` migration
 * (still triggered through the lazy gate) handles the one-shot copy from
 * the legacy table on cold start.
 *
 * Exported for unit tests only.
 */
export async function readLayoutFromStorage(
  ctx: { log: PluginContext["log"]; storage: PluginContext["storage"] },
  collection: string,
  entryId: string
): Promise<LayoutRow | null> {
  try {
    return await getLayouts(ctx).get(layoutDocId(collection, entryId));
  } catch (err) {
    logCaught(
      ctx,
      `readLayoutFromStorage: ctx.storage.layouts.get failed for ${collection}/${entryId}`,
      err
    );
    return null;
  }
}

/**
 * Read a one-shot migration flag. F3.2 moved migration flags into `ctx.kv`;
 * legacy values in the host's `empixel_builder_meta` table are still
 * honored during the F3.3 → F3.5 transition. After F3.5 the plugin no
 * longer has direct SQLite access; the legacy-meta sync-forward branch
 * lives inside `toStorageV1.ts` where the migration owns its own
 * dynamically-imported SQLite handle. Once the migration sets the flag
 * in KV, every other caller (the lazy gate, future migrations) just
 * reads from KV.
 *
 * Returns `true` if the migration has run. Errors are logged and treated as
 * "not migrated" so the caller can re-run safely.
 *
 * Exported for the F3.3 ctx.storage migration helper, which gates on the
 * `migration_to_storage_v1` flag.
 */
export async function getMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  key: string
): Promise<boolean> {
  try {
    const kvValue = await ctx.kv.get<string>(KV_MIGRATION_PREFIX + key);
    if (kvValue) return true;
  } catch (err) {
    logCaught(ctx, `getMigrationFlag: ctx.kv.get failed for ${key}`, err);
  }
  return false;
}

/**
 * Set a one-shot migration flag in `ctx.kv`.
 *
 * Pre-F3.5 this also mirrored to the legacy `empixel_builder_meta`
 * SQLite table so synchronous cold-start migrations could see the flag.
 * Post-F3.5 the plugin holds no SQLite handle, so the mirror is gone —
 * the only remaining cold-start migration (`runMigrationToStorageV1`)
 * runs through the async lazy gate and consults `ctx.kv` directly via
 * `getMigrationFlag`.
 *
 * Exported for the F3.3 migration that copies legacy rows into ctx.storage.
 */
export async function setMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  key: string,
  value: string = String(Date.now())
): Promise<void> {
  try {
    await ctx.kv.set(KV_MIGRATION_PREFIX + key, value);
  } catch (err) {
    logCaught(ctx, `setMigrationFlag: ctx.kv.set failed for ${key}`, err);
  }
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Plugin storage declaration. Maps to the legacy `empixel_builder_layouts`
 * data model — composite identity `(collection, entryId)`, enforced as a
 * unique composite index so EmDash's storage layer can serve `findOne`-style
 * lookups without a full scan.
 *
 * As of F3.5, **this is the entire data model** — the legacy
 * `empixel_builder_layouts` SQLite table is no longer touched by the
 * plugin runtime (the `runMigrationToStorageV1` cold-start migration
 * still consults it via dynamic-import on the very first request after
 * upgrade, but the route handlers never go near it).
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

/**
 * Resolve a slug → ULID against the host's `ec_<collection>` table via the
 * `ctx.content` capability surface. Returns the original input on any miss.
 * Used at the route boundary for the fresh-entry case (host CMS hands the
 * builder a slug for an entry that has never been saved through the builder
 * before).
 *
 * Implementation note. Pre-F3.5 this went through the plugin's own
 * `better-sqlite3` SELECT; F3.5 replaced that with a `ctx.db.selectFrom(...)`
 * Kysely call — but `PluginContext` (verified at
 * `node_modules/emdash/dist/types-D19uBYWn.d.mts:513`) never exposed a `db`
 * field. The cast was a type-level lie; at runtime `ctx.db === undefined` and
 * the lookup always failed, leaving every fresh-entry write keyed by the slug
 * (or the route returning empty for slug-only reads). We now go through
 * `ctx.content` (provided because the plugin declares the `content:read`
 * capability) which works across SQLite, Postgres, libSQL, D1, and Turso —
 * the multi-driver story F3.5 promised but didn't actually deliver.
 *
 * `ctx.content.get(collection, id)` only accepts an ID, so we page through
 * `ctx.content.list(...)` and pick the matching slug. Capped at 200 rows
 * because the slug→ULID branch is purely a fresh-entry convenience; a slug
 * that doesn't appear in the first 200 most-recent entries is almost
 * certainly stale and the layout will simply be returned as `null`.
 */
async function resolveSlugToUlid(
  ctx: RouteContext,
  collection: string,
  pageId: string
): Promise<string> {
  if (isUlid(pageId)) return pageId;
  if (!ctx.content) return pageId;
  try {
    const result = await ctx.content.list(collection, {
      limit: 100,
      orderBy: { createdAt: "desc" },
    });
    const match = result.items.find((it) => it.slug === pageId);
    if (match) return match.id;
    if (result.hasMore && result.cursor) {
      const next = await ctx.content.list(collection, {
        limit: 100,
        cursor: result.cursor,
        orderBy: { createdAt: "desc" },
      });
      const m2 = next.items.find((it) => it.slug === pageId);
      if (m2) return m2.id;
    }
  } catch (err) {
    logCaught(ctx, `resolveSlugToUlid: ctx.content.list(${collection}) failed for slug=${pageId}`, err);
  }
  return pageId;
}

/**
 * Per-entry merged shape returned by `/entries`. Consumed by
 * `PageSelector.tsx` and `BuilderPage.tsx` (post-F3.5peer regression fix —
 * see `prd-backend.md` § Read path / `/entries`).
 *
 * Exported for the unit test that drives the helper directly without going
 * through the HTTP layer.
 */
export interface EntryListItem {
  id: string;
  slug?: string;
  title?: string;
  created_at: string;
  updated_at: string;
  builder_enabled: boolean;
}

/**
 * `/entries` route core — list every host entry in `collection`, joined
 * with the per-entry builder metadata from `ctx.storage.layouts`.
 *
 * **Why `ctx.content` instead of `ctx.db`.** The legacy implementation
 * (and the F3.5 rewrite) reached for a Kysely handle on
 * `(ctx as { db?: unknown }).db`. That cast was a type-level lie:
 * `PluginContext` (verified at
 * `node_modules/emdash/dist/types-D19uBYWn.d.mts:513`) exposes `kv`,
 * `storage`, `content?`, `media?`, `http?`, `log`, `site`, `users?`,
 * `cron?`, `email?` — but **no `db` field**. At runtime the cast
 * resolved to `undefined` and the entire host-table SELECT was
 * skipped, leaving `items = []` and the page-selector table blank
 * (Bug 4) plus the topbar showing the ULID instead of the title
 * (cascade Bug 3 — `selected.title` falls back to `selected.id` when
 * the entries response doesn't contain the row).
 *
 * The plugin already declares the `content:read` capability, so
 * `ctx.content` is provided by EmDash's plugin runtime and works
 * transparently across SQLite, Postgres, libSQL, D1, and Turso. We
 * page through `ctx.content.list(collection, ...)` — which surfaces
 * `ContentItem.id` / `slug` / `data` (any non-system column lands in
 * `data` per `dist/content-C7G4QXkK.mjs:860 mapRow`) / `createdAt` /
 * `updatedAt` / `publishedAt` — and merge in the storage metadata
 * (enabled flag + timestamps) keyed by `entryId`.
 *
 * Storage rows whose `(collection, entryId)` does not match a host
 * entry are silently dropped. The two F3.2-iteration orphan rows in
 * `_plugin_storage` (id is the bare ULID with no `<collection>::`
 * prefix and no `data.collection` field) are also dropped because
 * `query({ where: { collection } })` filters by the JSON-extracted
 * `collection` field, which is `NULL` on those rows.
 */
export async function listEntriesForCollection(
  ctx: RouteContext,
  collection: string,
  limit: number
): Promise<EntryListItem[]> {
  // F3.3 lazy gate — `/entries` is a heavy read so make sure the
  // storage side is fully populated before merging. Idempotent.
  await ensureStorageMigrationRan(ctx);
  // F3.6.4 lazy gate — sequenced after the storage copy so legacy
  // SQLite rows have already landed in ctx.storage before this rewrites
  // their symbolic spacing values to px. Idempotent.
  await ensureLegacySpacingMigrationRan(ctx);

  // Pull per-entry metadata (enabled flag + timestamps) from
  // ctx.storage.layouts. Storage is the only source of truth as of F3.5.
  interface LayoutMeta {
    created_at?: string;
    updated_at?: string;
    enabled: number;
  }
  const meta: Record<string, LayoutMeta> = {};

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

  // Pre-0.9 EmDash hosts that don't expose `content` on the plugin context
  // (because the capability surface predates the multi-driver rewrite) get
  // an empty list rather than a 500 — the storage metadata is still useful
  // for the toggle write paths but the entries selector renders "No
  // entries found" instead of crashing.
  if (!ctx.content) {
    logCaught(
      ctx,
      `entries: ctx.content is unavailable (host EmDash version too old?), returning empty list`,
      new Error("ctx.content is undefined despite content:read capability")
    );
    return [];
  }

  const items: EntryListItem[] = [];
  try {
    let cursor: string | undefined;
    let fetched = 0;
    while (fetched < limit) {
      const pageSize = Math.min(100, limit - fetched);
      const page = await ctx.content.list(collection, {
        limit: pageSize,
        cursor,
        orderBy: { createdAt: "desc" },
      });
      for (const entry of page.items) {
        const id = entry.id;
        const slug = typeof entry.slug === "string" && entry.slug.length > 0 ? entry.slug : id;
        let title = slug;
        const data = entry.data ?? {};
        if (typeof data.title === "string" && data.title.length > 0) {
          title = data.title;
        } else if (typeof (data as { name?: unknown }).name === "string" && ((data as { name: string }).name).length > 0) {
          title = (data as { name: string }).name;
        }
        items.push({
          id,
          slug,
          title,
          created_at: meta[id]?.created_at ?? entry.createdAt,
          updated_at: meta[id]?.updated_at ?? entry.updatedAt,
          builder_enabled: (meta[id]?.enabled ?? 0) === 1,
        });
        fetched += 1;
        if (fetched >= limit) break;
      }
      if (!page.hasMore || !page.cursor) break;
      cursor = page.cursor;
    }
  } catch (err) {
    logCaught(ctx, `entries: ctx.content.list(${collection}) failed`, err);
  }

  return items;
}

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.9.0",
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

            // F3.3 lazy gate — migrate legacy SQLite rows into ctx.storage
            // on first request post-upgrade. After the KV flag is set this
            // is O(1). On non-SQLite hosts (Postgres / libSQL) the
            // migration is a graceful no-op (the legacy table never
            // existed) and the flag is set so future calls are free.
            await ensureStorageMigrationRan(ctx);
            // F3.6.4 lazy gate — sequenced after the storage copy so any
            // legacy symbolic spacing values (`paddingTop: "md"`) get
            // rewritten to px on the very first read post-upgrade.
            // Idempotent + cached after first run.
            await ensureLegacySpacingMigrationRan(ctx);

            // Fresh-entry case: the host CMS may pass a slug for an entry
            // that has never been saved through the builder before.
            // Resolve through `ctx.db` (Kysely) — works across SQLite,
            // Postgres, libSQL, etc.
            pageId = await resolveSlugToUlid(ctx, collection, pageId);

            // Storage-only read. The legacy SQLite fallback was removed
            // in F3.5; `runMigrationToStorageV1` is the bridge for old
            // installs.
            const row = await readLayoutFromStorage(ctx, collection, pageId);
            if (!row) return { data: null };
            const sections = stripUnknownBlocks(row.sections);
            return { data: { sections } };
          }

          if (method === "POST") {
            const body = ctx.input as { pageId?: string; collection?: string; sections?: SectionBlock[] } | undefined;
            let pageId = body?.pageId;
            const { collection, sections } = body ?? {};
            if (!pageId || !collection || !sections) {
              return badRequest("pageId, collection and sections are required");
            }
            if (!isValidCollection(collection)) {
              return badRequest("Invalid collection name");
            }

            // F3.3 lazy gate — same as GET. Idempotent + cached after first run.
            await ensureStorageMigrationRan(ctx);
            // F3.6.4 lazy gate — same as GET. Sequenced after F3.3.
            await ensureLegacySpacingMigrationRan(ctx);
            // Same as GET: slug → ULID at the route boundary so the row is
            // always written under its canonical ULID key.
            pageId = await resolveSlugToUlid(ctx, collection, pageId);

            // Preserve the per-entry `enabled` flag if the row already exists
            // (POST /toggle owns it, POST /layout shouldn't clobber it).
            const existing = await readLayoutFromStorage(ctx, collection, pageId);
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

          // The pre-F3.5 implementation auto-augmented the host's
          // `ec_<collection>` table with an `empixel_builder INTEGER`
          // column on first enable. Hosts on EmDash 0.9.x are expected
          // to declare the column in `seed.json` (or accept that the
          // plugin's mirror UPDATE in `/toggle` is best-effort). The
          // automatic ALTER required direct SQLite access; with the
          // multi-driver storage abstraction the schema-augmentation
          // step is back to seed-driven.
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

          const items = await listEntriesForCollection(ctx, collection, limit);
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

          // F3.3 lazy gate — toggle is one of the first writes a host hits
          // post-upgrade, so we want the migration to have run before we
          // start putting fresh rows alongside un-migrated legacy rows.
          await ensureStorageMigrationRan(ctx);
          // F3.6.4 lazy gate — sequenced after F3.3 so toggle reads see
          // already-normalised spacing values.
          await ensureLegacySpacingMigrationRan(ctx);
          // Resolve slug → ULID at the route boundary for fresh entries.
          entryId = await resolveSlugToUlid(ctx, collection, entryId);

          // Storage-only write. Preserves any existing `sections` (or seeds an
          // empty array on first toggle) and flips `enabled`.
          const existing = await readLayoutFromStorage(ctx, collection, entryId);
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

          // Note: pre-F3.5 the plugin mirrored the enable bit onto
          // `ec_<collection>.empixel_builder` for downstream host queries
          // (via auto-ALTER + direct SQLite UPDATE). F3.5 attempted to keep
          // the mirror via `ctx.db.updateTable(...)` (Kysely), but
          // `PluginContext` exposes no `db` field — so the mirror was a
          // no-op all along. The plugin only declares `content:read`;
          // adding `content:write` purely to maintain a duplicate enabled
          // bit fails KISS. Hosts that need to filter on the
          // `empixel_builder` column should instead read from
          // `_plugin_storage` (filter by `plugin_id = "empixel-builder"`,
          // `collection = "layouts"`, JSON-extract `data.collection` and
          // `data.enabled`). The column itself can stay declared in
          // `seed.json` for back-compat — it just won't be kept in sync
          // by the plugin.

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
          await ensureStorageMigrationRan(ctx);
          // F3.6.4 lazy gate — keeps the migration chain consistent
          // even on the delete codepath. Idempotent + cached.
          await ensureLegacySpacingMigrationRan(ctx);

          // Cascade delete from `ctx.storage.layouts`. The legacy DELETE
          // that lived here pre-F3.5 is gone — once F3.3 has copied
          // every legacy row into storage (or cleared a non-SQLite host
          // through a no-op), the legacy table is effectively dead from
          // the plugin's perspective.
          try {
            await getLayouts(ctx).delete(layoutDocId(event.collection, entryId));
          } catch (err) {
            logCaught(
              ctx,
              `content:afterDelete: ctx.storage.layouts.delete failed for ${event.collection}/${entryId}`,
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
