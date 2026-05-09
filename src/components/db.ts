import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";
import type { LayoutRow } from "../storage-types.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) on the plugin side; the frontend
// reader doesn't construct any identifiers itself, but we still
// validate to short-circuit obviously bad input before hitting the
// database.
const COLLECTION_RE = /^[a-z0-9_]+$/;

// Plugin id used to scope reads on the shared `_plugin_storage` table.
// Must match the `id` declared in `src/plugin.ts` `definePlugin({ id })` —
// EmDash partitions every plugin's rows under `(plugin_id, collection)`.
const PLUGIN_ID = "empixel-builder";
// Storage collection name — matches the key declared in
// `definePlugin({ storage: { layouts: ... } })` (src/plugin.ts F3.1).
const STORAGE_COLLECTION = "layouts";

/**
 * Cache hint emitted by `getBuilderLayout` so Astro pages can invalidate
 * when the layout row updates. Matches the `CacheHint` shape EmDash core
 * uses (see `node_modules/emdash/dist/index-DjPMOfO0.d.mts` — same `tags`
 * + `lastModified` pair as `getEmDashEntry` / `getEmDashCollection`).
 *
 * - `tags`        — `["empixel:layout:<collection>:<entryId>"]`. Admin
 *                    saves invalidate the host page by tag.
 * - `lastModified` — Parsed from the layout row's `updatedAt` ISO
 *                    timestamp set by the storage layer. Lets HTTP
 *                    caches that look at `Last-Modified` short-circuit
 *                    304s without going through tag invalidation.
 */
export interface BuilderCacheHint {
  tags?: string[];
  lastModified?: Date;
}

/**
 * Result returned by `getBuilderLayout` from v0.8.0. The `cacheHint` is
 * suitable to pass straight to `Astro.cache.set(...)` — see README's
 * "Caching builder layouts" section.
 */
export interface BuilderLayoutResult {
  /** The layout's section tree, or `null` when the entry has no layout / builder is disabled. */
  sections: SectionBlock[] | null;
  /** Pass to `Astro.cache.set(cacheHint)`. Always present so callers can call set unconditionally. */
  cacheHint: BuilderCacheHint;
}

/**
 * Minimal subset of the Astro request object the v0.9 reader consumes.
 * Accept `Astro` itself or any hand-built context with the same shape so
 * tests can mock the storage handle without standing up a full Astro
 * runtime, and so non-Astro consumers (a future API route or a custom
 * render path) can still call the helper.
 *
 * `locals.emdash.db` is the Kysely instance EmDash exposes on every
 * request via `Astro.locals.emdash`. Post-F3.5 it's the **only** read
 * path — there is no longer a legacy `better-sqlite3` fallback. Hosts
 * upgrading from a pre-0.9 EmDash that doesn't expose `db` on
 * `Astro.locals` will get null sections (and the cache tag, so a future
 * EmDash upgrade still busts cleanly).
 */
export interface BuilderLayoutContext {
  locals?: {
    emdash?: {
      db?: unknown;
      getPublicMediaUrl?: (storageKey: string) => string | undefined;
    };
  };
}

/**
 * Build the layout-scoped cache tag a host page should invalidate when the
 * admin saves a new layout for `(collection, entryId)`.
 *
 * Exported so external consumers (e.g. a custom save hook in another
 * plugin) can derive the same tag and call `cache.purgeByTags([...])`.
 */
export function builderLayoutCacheTag(collection: string, entryId: string): string {
  return `empixel:layout:${collection}:${entryId}`;
}

/**
 * Parse a stored `updatedAt` value into a `Date` for the
 * `cacheHint.lastModified` field. Returns `undefined` when parsing fails
 * so the hint stays valid (caller still has the tag).
 *
 * Accepts both shapes:
 *   - SQLite `current_timestamp` legacy column: `YYYY-MM-DD HH:MM:SS` (no `T`).
 *   - Storage-layer ISO timestamps: `YYYY-MM-DDTHH:MM:SS.sssZ` (already valid).
 */
function parseUpdatedAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Composite document id used by the plugin runtime to write rows into
 * `_plugin_storage` (`src/plugin.ts` § `layoutDocId`). The frontend reader
 * MUST use the identical key — every other query shape (filter on
 * `(plugin_id, collection)` and post-match on the JSON payload) either
 * misses entirely (`executeTakeFirst()` returns the wrong row) or collides
 * with stale orphan rows from earlier dev iterations whose `data` payload
 * no longer carries `collection` / `entryId`.
 *
 * Mirrored locally rather than imported from `src/plugin.ts` to keep the
 * frontend bundle clean — `plugin.ts` pulls in the full plugin runtime
 * (route handlers, hooks, etc.) which has no business landing in an Astro
 * frontend chunk.
 */
function layoutDocId(collection: string, entryId: string): string {
  return `${collection}::${entryId}`;
}

/**
 * Minimal interface for the Kysely-shaped query builder we actually need.
 * Any object satisfying this works — production uses the real Kysely
 * instance EmDash exposes (either on `Astro.locals.emdash.db` for
 * authenticated requests or via the `getDb()` runtime singleton for
 * anonymous public page renders); tests substitute a hand-rolled stub
 * that returns canned rows.
 */
interface MinimalKysely {
  selectFrom(table: string): MinimalSelectBuilder;
}
interface MinimalSelectBuilder {
  select(cols: string[]): MinimalSelectBuilder;
  where(field: string, op: string, value: unknown): MinimalSelectBuilder;
  executeTakeFirst(): Promise<Record<string, unknown> | undefined>;
}

function isMinimalKysely(value: unknown): value is MinimalKysely {
  return typeof value === "object" && value !== null && typeof (value as { selectFrom?: unknown }).selectFrom === "function";
}

/**
 * Resolve a Kysely handle for the current request.
 *
 * Order:
 *   1. `Astro.locals.emdash.db` — present on authenticated/admin requests
 *      (EmDash middleware `doInit` branch attaches the runtime's `db`).
 *   2. `getDb()` from `emdash/runtime` — the public accessor for the same
 *      singleton EmDash uses internally. Anonymous public page renders
 *      DO NOT receive `db` on `locals.emdash` (the middleware short-circuits
 *      to `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }`),
 *      so the runtime fallback is required for the actual host-page render
 *      path the builder targets.
 *
 * Returns `null` when no handle is reachable (test benches, pre-0.9 EmDash
 * hosts) — caller short-circuits to `{ sections: null, cacheHint }`.
 */
async function resolveKyselyHandle(astro: BuilderLayoutContext): Promise<MinimalKysely | null> {
  const fromLocals = astro?.locals?.emdash?.db;
  if (isMinimalKysely(fromLocals)) return fromLocals;
  try {
    // Dynamic import so test benches (which never wire `emdash/runtime`) and
    // non-Astro consumers can still call `getBuilderLayout` without the
    // module load forcing `getDb()` to throw at import time. The peer dep
    // (`emdash >= 0.9.0`) guarantees the export exists on real hosts.
    const runtime = (await import("emdash/runtime")) as { getDb?: () => Promise<unknown> };
    if (typeof runtime.getDb !== "function") return null;
    const db = await runtime.getDb();
    return isMinimalKysely(db) ? db : null;
  } catch {
    return null;
  }
}

/**
 * Pull a layout row from `_plugin_storage` (EmDash's plugin-scoped storage
 * table) using the canonical composite doc id `${collection}::${entryId}`.
 *
 * Single-row deterministic lookup — no scan, no orphan-row collision. The
 * plugin runtime writes rows under the same key (`src/plugin.ts` §
 * `layoutDocId`), so the read path is symmetric with the write path.
 *
 * Returns `null` when:
 *   - No row matches `(plugin_id, collection, id)`.
 *   - The stored JSON fails to parse.
 *   - The DB throws (table missing on pre-EmDash 0.9 hosts, permission
 *     errors, etc.) — page renders with no layout instead of throwing.
 */
async function readFromStorage(
  db: MinimalKysely,
  collection: string,
  entryId: string,
): Promise<LayoutRow | null> {
  try {
    const row = await db
      .selectFrom("_plugin_storage")
      .select(["data", "updated_at"])
      .where("plugin_id", "=", PLUGIN_ID)
      .where("collection", "=", STORAGE_COLLECTION)
      .where("id", "=", layoutDocId(collection, entryId))
      .executeTakeFirst() as { data?: string; updated_at?: string } | undefined;
    if (!row || typeof row.data !== "string") return null;
    let parsed: LayoutRow | undefined;
    try {
      parsed = JSON.parse(row.data) as LayoutRow;
    } catch {
      return null;
    }
    if (!parsed) return null;
    if (parsed.updatedAt === undefined && typeof row.updated_at === "string") {
      parsed.updatedAt = row.updated_at;
    }
    return parsed;
  } catch {
    // Database missing the `_plugin_storage` table (pre-EmDash 0.9 hosts),
    // permission errors, etc. — return null so the page renders with no
    // layout rather than throwing.
    return null;
  }
}

/**
 * Read a layout for `(collection, entryId)` and return the section tree
 * plus a `cacheHint` the caller passes to `Astro.cache.set(...)`.
 *
 * **v0.9 — F3.4/F3.5 final shape.** Async, takes `Astro` (or any
 * `BuilderLayoutContext`) as the first argument. Reads route through
 * EmDash's plugin storage (`_plugin_storage`, partitioned under
 * `plugin_id="empixel-builder", collection="layouts"`).
 *
 * **DB handle resolution (the F3.4 hotfix).** Authenticated requests
 * receive a Kysely instance on `Astro.locals.emdash.db`. Anonymous public
 * page renders — i.e. the actual host pages the builder targets — DO NOT
 * (the EmDash middleware short-circuits the locals payload to
 * `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }`). The
 * reader therefore falls back to `getDb()` from `emdash/runtime` (the
 * public accessor for the same singleton EmDash uses internally) when
 * `locals.emdash.db` is absent. Pre-0.9 hosts that don't expose either
 * still get `{ sections: null, cacheHint }` — the page renders without a
 * layout but the cache tag is still emitted so a future upgrade busts
 * cleanly.
 *
 * **Doc-id symmetry (the F3.4 hotfix).** Rows are looked up by the same
 * composite doc id the plugin runtime writes them under
 * (`${collection}::${entryId}`, mirrored from `src/plugin.ts § layoutDocId`).
 * The previous F3.4 query filtered only on `(plugin_id, collection)` and
 * called `executeTakeFirst()`, which returned an arbitrary plugin row —
 * the post-fetch `parsed.collection !== collection` guard then forced
 * null even when the right row existed. With the doc-id filter added,
 * the lookup is single-row deterministic.
 */
export async function getBuilderLayout(
  astro: BuilderLayoutContext,
  collection: string,
  entryId: string,
  enabled?: boolean,
): Promise<BuilderLayoutResult> {
  // The cache tag identifies the layout regardless of whether sections
  // exist on disk yet — admin saving a fresh layout against this entry
  // still has to invalidate the host page that rendered "no layout".
  const cacheHint: BuilderCacheHint = {
    tags: [builderLayoutCacheTag(collection, entryId)],
  };

  if (enabled === false) return { sections: null, cacheHint };
  if (!COLLECTION_RE.test(collection)) return { sections: null, cacheHint };

  // Resolve a Kysely handle — `Astro.locals.emdash.db` first (admin path),
  // `getDb()` from `emdash/runtime` second (anonymous public render path).
  // Hosts on a pre-0.9 EmDash without either get null sections.
  const handle = await resolveKyselyHandle(astro);
  if (!handle) return { sections: null, cacheHint };

  const storageRow = await readFromStorage(handle, collection, entryId);
  if (!storageRow) return { sections: null, cacheHint };

  const lastModified = parseUpdatedAt(storageRow.updatedAt);
  if (lastModified) cacheHint.lastModified = lastModified;
  // Storage rows that were saved disabled still carry sections —
  // disabled-row → null sections, hint intact (so a future enable still
  // busts the cache).
  const enabledFlag = storageRow.enabled === 1 || storageRow.enabled === true;
  if (!enabledFlag) return { sections: null, cacheHint };
  const sections = Array.isArray(storageRow.sections)
    ? stripUnknownBlocks(storageRow.sections)
    : null;
  return { sections, cacheHint };
}
