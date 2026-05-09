/**
 * F3.6.4 — one-shot data migration `migration_legacy_spacing_v1`.
 *
 * Pre-F3.6 layouts could carry symbolic spacing values like
 * `paddingTop: "md"` instead of CSS lengths. The frontend rendering path
 * previously translated those via the `spacingMap` constant in
 * `src/components/SectionContainer.astro`:
 *
 *   none → "0",  sm → "32px",  md → "48px",  lg → "64px",  xl → "96px"
 *
 * F3.6.4 normalises the data side: every `paddingTop/Right/Bottom/Left`
 * (and `marginTop/Right/Bottom/Left`) symbolic value across every
 * `style / styleHover / styleDark` plus the per-breakpoint variants
 * (`styleBreakpoints[bp]`, `styleHoverBreakpoints[bp]`) gets rewritten
 * to its px equivalent at rest. After this lands in 0.9.6, paired with
 * Agent B's concurrent drop of the `spacingMap` fallback in
 * `SectionContainer.astro`, the symbolic-spacing path is fully retired.
 *
 * **Brief upgrade glitch.** The migration runs through the lazy gate
 * (alongside `migration_to_storage_v1`) which fires on the first request
 * to a layout route. Hosts upgrading 0.9.5 → 0.9.6 may see padding /
 * margin render as the unparsed string (e.g. `"md"`) for one request
 * until the lazy gate runs and rewrites the row. KISS — running the
 * migration on every layout read would add a meaningful per-request
 * cost.
 *
 * Idempotency contract:
 *
 * - The KV flag `state:migration:legacy_spacing_v1` is the **only** gate.
 *   Re-running with the flag already set is a no-op (returns zeros, does
 *   not touch storage).
 * - Per-row failures (storage `put` error, malformed `data.sections`)
 *   are caught + logged via `ctx.log.warn`; the loop keeps going. The
 *   KV flag is still set at the end of a normal run because the rewrite
 *   is forward-compatible — a row with un-rewritten symbolic values
 *   simply renders as the unparsed string from F3.6.4 onwards (no
 *   `spacingMap` fallback). A re-run after a partial pass is a no-op
 *   for any row that did succeed.
 * - The KV flag is **NOT** set when an exception escapes the runner
 *   (e.g. `ctx.kv.set` blowing up, or the `query` itself throwing
 *   mid-page). The next request retries from the top.
 */

import type { PluginContext } from "emdash";

import { layoutDocId, getMigrationFlag, setMigrationFlag } from "../plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../storage-types.js";
import type {
  BaseBlockConfig,
  BreakpointStyleEntry,
  CssProps,
  SectionBlock,
} from "../types.js";

/**
 * KV flag key (suffix — full key is `state:migration:${MIGRATION_KEY}` via
 * `setMigrationFlag` / `getMigrationFlag`). Exported so the test suite can
 * pre-seed / clear the flag without re-deriving the prefix.
 */
export const MIGRATION_KEY = "legacy_spacing_v1";

/**
 * Verbatim mapping from legacy symbolic spacing values → CSS lengths.
 *
 * Mirrors the `spacingMap` in `src/components/SectionContainer.astro`
 * (lines 23-25 at the time of writing — values: none="0", sm="32px",
 * md="48px", lg="64px", xl="96px"). Any drift here from the existing
 * fallback values would cause a one-time visual regression for hosts
 * that hit the lazy gate. Keep these locked to whatever the fallback
 * says today.
 */
export const LEGACY_SPACING_TO_PX: Readonly<Record<string, string>> = {
  none: "0",
  sm: "32px",
  md: "48px",
  lg: "64px",
  xl: "96px",
};

/**
 * Style-key allowlist. Only these CSS keys are rewritten; everything
 * else (gap, font-size, etc.) is left alone. The `spacingMap` fallback
 * in `SectionContainer.astro` only fires for `paddingTop/Right/Bottom/
 * Left`, but we extend coverage to `marginTop/Right/Bottom/Left` here
 * because (a) the broader plan in the report calls out spacing as a
 * unit, (b) future legacy values landing on margin keys would otherwise
 * never normalise, and (c) the cost is one extra lookup per
 * (block × style-bag) so the migration's runtime is unchanged.
 */
const SPACING_KEYS = [
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
] as const;

/** Counts returned to the caller for logging + telemetry. */
export interface LegacySpacingMigrationCounts {
  /** Rows where one or more spacing values were rewritten. */
  migrated: number;
  /** Rows that already had no symbolic values (or had storage errors). */
  skipped: number;
  /** Total rows touched (read from storage and written back when changed). */
  rowsTouched: number;
}

const ZERO_COUNTS: LegacySpacingMigrationCounts = {
  migrated: 0,
  skipped: 0,
  rowsTouched: 0,
};

/**
 * Process-local cache: once the migration has run inside this Node process
 * (or the KV flag was already set when we first checked), subsequent calls
 * short-circuit without touching `ctx.kv.get`. Mirrors the
 * `migrationRanThisProcess` cache in `toStorageV1.ts`.
 */
let migrationRanThisProcess = false;

/** Test-only helper. Resets the process-local "migration already ran"
 *  short-circuit so tests can re-run the migration against a fresh ctx. */
export function _resetMigrationCacheForTests(): void {
  migrationRanThisProcess = false;
}

/**
 * Rewrite one CSS-bag (the `style` / `styleHover` / `styleDark` shape) in
 * place. Returns `true` when at least one key was rewritten so the caller
 * can avoid an unnecessary `put`.
 */
function rewriteCssBag(bag: CssProps | BreakpointStyleEntry | undefined): boolean {
  if (!bag || typeof bag !== "object") return false;
  let changed = false;
  for (const key of SPACING_KEYS) {
    const value = (bag as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const replacement = LEGACY_SPACING_TO_PX[value];
    if (replacement !== undefined) {
      (bag as Record<string, unknown>)[key] = replacement;
      changed = true;
    }
  }
  return changed;
}

/**
 * Rewrite all CSS bags on one block's config (style, styleHover,
 * styleDark, plus every entry in styleBreakpoints / styleHoverBreakpoints).
 * Returns true when any bag was modified.
 */
function rewriteBlockConfig(config: BaseBlockConfig | undefined): boolean {
  if (!config) return false;
  let changed = false;
  if (rewriteCssBag(config.style)) changed = true;
  if (rewriteCssBag(config.styleHover)) changed = true;
  if (rewriteCssBag(config.styleDark)) changed = true;
  if (config.styleBreakpoints && typeof config.styleBreakpoints === "object") {
    for (const bp of Object.keys(config.styleBreakpoints)) {
      if (rewriteCssBag(config.styleBreakpoints[bp])) changed = true;
    }
  }
  if (config.styleHoverBreakpoints && typeof config.styleHoverBreakpoints === "object") {
    for (const bp of Object.keys(config.styleHoverBreakpoints)) {
      if (rewriteCssBag(config.styleHoverBreakpoints[bp])) changed = true;
    }
  }
  return changed;
}

/**
 * Recursively rewrite every block's config in a section subtree (children
 * + slots). Returns true when any block was modified.
 */
function rewriteBlocks(blocks: SectionBlock[] | undefined): boolean {
  if (!Array.isArray(blocks)) return false;
  let changed = false;
  for (const block of blocks) {
    if (rewriteBlockConfig(block.config)) changed = true;
    if (Array.isArray(block.children) && rewriteBlocks(block.children)) {
      changed = true;
    }
    if (Array.isArray(block.slots)) {
      for (const slot of block.slots) {
        if (rewriteBlocks(slot)) changed = true;
      }
    }
  }
  return changed;
}

/**
 * Pure helper exported for tests — rewrite one `LayoutRow.sections` tree
 * in place. Returns true when at least one symbolic spacing value was
 * replaced anywhere in the tree.
 */
export function rewriteSectionsInPlace(sections: SectionBlock[]): boolean {
  return rewriteBlocks(sections);
}

/**
 * Lazy gate. Called at the top of route handlers that touch
 * `ctx.storage.layouts` — sequenced after `ensureStorageMigrationRan`
 * (the F3.3 migration) so legacy SQLite rows have already been copied
 * to storage before this rewrites them.
 *
 * Idempotent and cheap on the hot path:
 *
 * - First call after a process boot: hits `ctx.kv.get` once. If the flag
 *   is set, caches `true` and returns. If not, runs the migration.
 * - Subsequent calls: O(1) — process-local cache hit.
 *
 * Errors are caught and logged. We **do not** propagate failures back
 * to the request handler — graceful fallback is preferable to blocking
 * a save. The render-time fallback in `SectionContainer.astro` is gone
 * (Agent B's F3.6.4 frontend half), so a row with un-rewritten symbolic
 * values renders as the unparsed string until the next process retries
 * the migration.
 */
export async function ensureLegacySpacingMigrationRan(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  }
): Promise<LegacySpacingMigrationCounts> {
  if (migrationRanThisProcess) return ZERO_COUNTS;
  try {
    const counts = await runMigrationLegacySpacingV1(ctx);
    migrationRanThisProcess = true;
    return counts;
  } catch (err) {
    // Don't poison the process-local cache on failure — the next request
    // gets another shot. The flag is only set inside the runner on success.
    const data = { err: err instanceof Error ? err.message : String(err) };
    ctx.log.error("[empixel-builder] ensureLegacySpacingMigrationRan failed", data);
    return ZERO_COUNTS;
  }
}

/**
 * Iterate every row in `ctx.storage.layouts.query({ where: { collection } })`
 * for the supplied collection list, paged through the cursor until exhausted.
 * Yields each `(id, row)` pair so the caller can rewrite + put.
 */
async function* iterateAllLayouts(
  layouts: StorageLayoutsCollection,
  collection: string
): AsyncGenerator<{ id: string; data: LayoutRow }> {
  let cursor: string | undefined;
  for (;;) {
    const page = await layouts.query({
      where: { collection },
      limit: 100,
      cursor,
    });
    for (const item of page.items) yield item;
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
}

/**
 * One-shot data migration runner. Public surface so unit tests can drive
 * it directly without going through the lazy gate (which adds the
 * process-local cache layer).
 *
 * Behaviour:
 *
 * 1. If `state:migration:legacy_spacing_v1` is already set in `ctx.kv`,
 *    returns zero counts immediately.
 * 2. Otherwise, queries `ctx.storage.layouts` for every known collection
 *    (we discover collections by reading `KV_ENABLED` plus a small
 *    fallback set — see implementation note below).
 * 3. For each row, walks the section tree and rewrites every
 *    `paddingTop/Right/Bottom/Left` + `marginTop/Right/Bottom/Left`
 *    value matching one of `none/sm/md/lg/xl` to its px equivalent.
 * 4. Writes the row back via `ctx.storage.layouts.put(...)` only when at
 *    least one value changed (saves roundtrips on already-migrated rows).
 * 5. On success, sets the KV flag so subsequent calls short-circuit.
 *
 * **Why we discover collections by enumerating `query({ where })`** —
 * EmDash's storage layer does not surface a "give me every row across
 * every collection" cursor, so we list collections via the
 * `settings:enabledCollections` KV key (the same source of truth the
 * `/collections` route returns) and fall back to a hardcoded
 * `["pages", "posts"]` set when the KV is empty (covers the default
 * EmDash schema). Layouts in collections outside this enumeration are
 * not migrated by this pass; if a host has a non-default collection
 * with builder-enabled rows, they need to flag the collection as
 * builder-enabled at the collection level (which is the mechanism the
 * admin UI uses) before the migration runs. Worst case: the
 * `spacingMap` fallback is gone (Agent B's drop), so legacy values
 * render as the literal string until the host enables the collection.
 */
export async function runMigrationLegacySpacingV1(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  }
): Promise<LegacySpacingMigrationCounts> {
  const alreadyRan = await getMigrationFlag(ctx, MIGRATION_KEY);
  if (alreadyRan) return { ...ZERO_COUNTS };

  const counts: LegacySpacingMigrationCounts = {
    migrated: 0,
    skipped: 0,
    rowsTouched: 0,
  };

  // Discover the collection list. KV-first (the canonical source for
  // builder-enabled collections), fall back to the EmDash default set
  // for hosts that have never opened the settings page.
  let collections: string[] = [];
  try {
    const enabled = await ctx.kv.get<string[]>("settings:enabledCollections");
    if (Array.isArray(enabled)) collections = enabled;
  } catch (err) {
    const data = { err: err instanceof Error ? err.message : String(err) };
    ctx.log.warn(
      "[empixel-builder] runMigrationLegacySpacingV1: ctx.kv.get(settings:enabledCollections) failed",
      data
    );
  }
  if (collections.length === 0) collections = ["pages", "posts"];
  // De-dupe in case hosts have both flagged collections and the default
  // set passes through. Order doesn't matter — every collection is a
  // separate query.
  collections = [...new Set(collections)];

  const layouts = ctx.storage.layouts as StorageLayoutsCollection;

  for (const collection of collections) {
    try {
      for await (const { id, data: row } of iterateAllLayouts(layouts, collection)) {
        counts.rowsTouched += 1;

        // Defensive: a malformed row could theoretically have a
        // non-array `sections` field. Skip without crashing.
        if (!Array.isArray(row.sections)) {
          counts.skipped += 1;
          ctx.log.warn(
            `[empixel-builder] runMigrationLegacySpacingV1: row ${id} has non-array sections — skipping`,
            { collection, sectionsType: typeof row.sections }
          );
          continue;
        }

        // structuredClone to avoid mutating the storage layer's internal
        // reference (some drivers cache rows in-memory between get/put).
        const next: LayoutRow = {
          ...row,
          sections: structuredClone(row.sections),
        };
        const changed = rewriteSectionsInPlace(next.sections);

        if (!changed) {
          counts.skipped += 1;
          continue;
        }

        // Also bump updatedAt so downstream cache invalidators (the
        // `cacheHint.lastModified` path on `getBuilderLayout`) see a
        // fresh stamp and bust any cached page that rendered with the
        // unparsed symbolic value before the migration ran.
        next.updatedAt = new Date().toISOString();

        try {
          await layouts.put(id, next);
          counts.migrated += 1;
        } catch (err) {
          const data = { err: err instanceof Error ? err.message : String(err) };
          ctx.log.warn(
            `[empixel-builder] runMigrationLegacySpacingV1: put failed for ${id} — leaving row unchanged, will retry on next pass`,
            data
          );
          counts.skipped += 1;
        }
      }
    } catch (err) {
      // A `query` failure for one collection shouldn't block the others.
      // Log + continue. The flag is still set at the end so we don't
      // pay the cost on every request, but a re-run after a process
      // bounce + cache reset would pick up rows we missed.
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationLegacySpacingV1: query failed for collection=${collection}`,
        data
      );
    }
  }

  await setMigrationFlag(ctx, MIGRATION_KEY);

  ctx.log.info("[empixel-builder] migration_legacy_spacing_v1 complete", {
    migrated: counts.migrated,
    skipped: counts.skipped,
    rowsTouched: counts.rowsTouched,
  });

  return counts;
}

/**
 * Layout doc id helper re-export so external callers (mostly tests) don't
 * have to reach into `plugin.ts` separately when seeding fixture rows
 * keyed by the same `${collection}::${entryId}` shape the runner expects.
 */
export { layoutDocId };
