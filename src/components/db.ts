import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";
import { getDb as getSharedDb } from "../dbShared.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) so they MUST be validated. Loose input
// here is unlikely (host caller), but the cost is one regex test per load.
const COLLECTION_RE = /^[a-z0-9_]+$/;

// EmDash ULIDs — 26-char Crockford base32. Used to short-circuit the slug
// → ULID resolution when the host already passed a canonical id.
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * Cache hint emitted by `getBuilderLayout` so Astro pages can invalidate
 * when the layout row updates. Matches the `CacheHint` shape EmDash core
 * uses (see `node_modules/emdash/dist/index-DjPMOfO0.d.mts` — same `tags`
 * + `lastModified` pair as `getEmDashEntry` / `getEmDashCollection`).
 *
 * - `tags`        — `["empixel:layout:<collection>:<entryId>"]`. Admin
 *                    saves invalidate the host page by tag.
 * - `lastModified` — Parsed from the layout row's `updated_at` column
 *                    (SQLite `current_timestamp` ISO-8601). Lets HTTP
 *                    caches that look at `Last-Modified` short-circuit
 *                    304s without going through tag invalidation.
 *
 * Re-declared locally rather than importing `CacheHint` from `emdash` so
 * the package keeps a hard runtime peer dep on the type but nothing else
 * — the `Astro.cache.set` consumer pattern only requires structural
 * compatibility.
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
 * Parse the `updated_at` column (SQLite `current_timestamp` ISO-8601) into
 * a `Date` for the `cacheHint.lastModified` field. Returns `undefined`
 * when parsing fails so the hint stays valid (caller still has the tag).
 */
function parseUpdatedAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  // SQLite emits `YYYY-MM-DD HH:MM:SS` (no `T`). Date accepts that on V8
  // but to be safe across runtimes we replace the space with `T` and
  // append `Z` so it's parsed as UTC (matches what `current_timestamp`
  // actually stores).
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Read a layout from `empixel_builder_layouts`. Returns the section tree
 * plus a `cacheHint` the caller passes to `Astro.cache.set(...)`.
 *
 * Pre-0.8 this returned `SectionBlock[] | null`; v0.8 wraps that in
 * `{ sections, cacheHint }` so admin saves can invalidate the host page
 * by tag (`empixel:layout:<collection>:<entryId>`). `BuilderWrapper.astro`
 * calls `Astro.cache.set` automatically; manual consumers destructure
 * the result and call set themselves.
 */
export function getBuilderLayout(
  collection: string,
  entryId: string,
  enabled?: boolean,
): BuilderLayoutResult {
  // The cache tag identifies the layout regardless of whether sections
  // exist on disk yet — admin saving a fresh layout against this entry
  // still has to invalidate the host page that rendered "no layout".
  const cacheHint: BuilderCacheHint = {
    tags: [builderLayoutCacheTag(collection, entryId)],
  };

  if (enabled === false) return { sections: null, cacheHint };
  if (!COLLECTION_RE.test(collection)) return { sections: null, cacheHint };
  try {
    // Shared handle owned by `dbShared.ts`; the plugin runtime opens the
    // same file for writes, so this reader piggy-backs on that connection
    // instead of opening a second one. The default path is
    // `<process.cwd()>/data.db` unless `empixelBuilder({ databasePath })`
    // overrode it at plugin construction time.
    const db = getSharedDb();

    // Resolve slug → ULID up front when the caller passed a slug. Layouts on
    // disk are ULID-keyed (after `runSlugToUlidMigration_v1`), so a single
    // direct query is enough — the previous slug↔ULID fallback chain is gone.
    let lookupId = entryId;
    if (!ULID_RE.test(entryId)) {
      const idRow = db
        .prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`)
        .get(entryId) as { id: string } | undefined;
      if (idRow && idRow.id) lookupId = idRow.id;
    }

    const row = db
      .prepare(
        "SELECT sections, enabled, updated_at FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?",
      )
      .get(collection, lookupId) as
      | { sections: string; enabled: number; updated_at: string | null }
      | undefined;

    if (!row) return { sections: null, cacheHint };

    // Stamp `lastModified` from the row even when the layout is disabled —
    // a future enable still has to bust the cache, and the timestamp on
    // the row is the freshest signal we have either way.
    const lastModified = parseUpdatedAt(row.updated_at);
    if (lastModified) cacheHint.lastModified = lastModified;

    if (!row.enabled) return { sections: null, cacheHint };

    const parsed = JSON.parse(row.sections) as SectionBlock[];
    return { sections: stripUnknownBlocks(parsed), cacheHint };
  } catch {
    return { sections: null, cacheHint };
  }
}
