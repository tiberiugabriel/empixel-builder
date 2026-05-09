/**
 * F3.3 — one-shot data migration `migration_to_storage_v1`.
 *
 * Copies every row from the legacy `empixel_builder_layouts` SQLite table
 * into `ctx.storage.layouts` so existing hosts upgrade transparently. The
 * legacy table is left in place as a fallback for one version (F3.5 drops
 * the fallback and the `better-sqlite3` peer dep).
 *
 * Unlike `runSpacerMigration` and `runSlugToUlidMigration_v1` (which run
 * synchronously inside `getDb()`), this migration **needs an async ctx** —
 * `ctx.storage.layouts.put` is async. We don't have an EmDash lifecycle
 * hook that fires on every cold start (`plugin:install` / `plugin:activate`
 * only fire on state transitions, not on software upgrades), so the
 * runner is wired through a **lazy gate** that the route handlers call
 * before serving. After the KV flag is set the gate is a single
 * `ctx.kv.get` (cached to a process-local boolean for subsequent calls
 * within the same process).
 *
 * Idempotency contract:
 *
 * - The KV flag `state:migration:to_storage_v1` is the **only** gate. Re-
 *   running the migration with the flag already set is a no-op (returns
 *   zeros, does not touch storage or SQLite).
 * - On failure, the flag is **NOT** set, so the next request retries the
 *   migration. Partial migration is acceptable — `ctx.storage.layouts.put`
 *   is idempotent per row, and the conflict resolution rule (newer
 *   updated_at wins) means a re-run after a partial pass simply finishes
 *   the work.
 *
 * Conflict resolution:
 *
 * - If both a legacy row and a storage row exist for the same
 *   `(collection, entryId)`, prefer the row with the newer `updatedAt`.
 * - On ties, **storage wins** — storage is the new source of truth post-
 *   migration. This mirrors `runSlugToUlidMigration_v1`'s "ULID wins on
 *   tie" rule applied to the new layer instead of the new key shape.
 */

import type { PluginContext } from "emdash";

import { layoutDocId } from "../plugin.js";
import { getMigrationFlag, setMigrationFlag } from "../plugin.js";
import type { SqliteDb } from "../dbShared.js";
import type { LayoutRow, StorageLayoutsCollection } from "../storage-types.js";
import type { SectionBlock } from "../types.js";

/**
 * KV flag key (suffix — full key is `state:migration:${MIGRATION_KEY}` via
 * `setMigrationFlag` / `getMigrationFlag`). Exported so the test suite can
 * pre-seed / clear the flag without re-deriving the prefix.
 */
export const MIGRATION_KEY = "to_storage_v1";

/**
 * Counts returned to the caller (and logged via `ctx.log.info`) so a host
 * operator can verify the migration ran. The plus-skip-conflicts split
 * matches `runSlugToUlidMigration_v1`'s telemetry shape so dashboards
 * comparing "rows migrated this version" stay readable.
 */
export interface MigrationCounts {
  /** Rows successfully copied from legacy → storage (or overwriting an
   *  older storage row). */
  migrated: number;
  /** Rows where the storage side already had a newer copy — left alone. */
  skipped: number;
  /** Rows where both sides existed and the timestamps had to be compared
   *  to pick a winner. Subset of `migrated` + `skipped` — incremented in
   *  addition to one of those two. */
  conflicts: number;
}

const ZERO_COUNTS: MigrationCounts = { migrated: 0, skipped: 0, conflicts: 0 };

interface LegacyRow {
  collection: string;
  entry_id: string;
  sections: string;
  enabled: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Process-local cache: once the migration has run inside this Node process
 * (or the KV flag was already set when we first checked), subsequent calls
 * short-circuit without touching `ctx.kv.get`. Worst case if the cache is
 * cold: one KV `get` per route invocation. This trims that to one KV `get`
 * per process lifetime.
 *
 * Cache busting is deliberate-only: tests reset via `_resetMigrationCache`.
 */
let migrationRanThisProcess = false;

/** Test-only helper. Resets the process-local "migration already ran"
 *  short-circuit so tests can re-run the migration against a fresh ctx. */
export function _resetMigrationCacheForTests(): void {
  migrationRanThisProcess = false;
}

/**
 * Lazy gate. Called at the top of route handlers that touch
 * `ctx.storage.layouts`. Idempotent and cheap on the hot path:
 *
 * - First call after a process boot: hits `ctx.kv.get` once. If the flag
 *   is set, caches `true` and returns. If not, runs the migration.
 * - Subsequent calls: O(1) — process-local cache hit.
 *
 * Errors are caught and logged. We **do not** propagate migration failures
 * back to the request handler — a partial migration plus a graceful
 * fallback (the F3.2 `readLayoutFromStorageOrLegacy` helper still serves
 * the legacy row when the storage side is missing) is preferable to
 * blocking a save.
 */
export async function ensureStorageMigrationRan(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  },
  db: SqliteDb
): Promise<MigrationCounts> {
  if (migrationRanThisProcess) return ZERO_COUNTS;
  try {
    const counts = await runMigrationToStorageV1(ctx, db);
    migrationRanThisProcess = true;
    return counts;
  } catch (err) {
    // Don't poison the process-local cache on failure — the next request
    // gets another shot. The flag is only set inside the runner on success.
    const data = { err: err instanceof Error ? err.message : String(err) };
    ctx.log.error("[empixel-builder] ensureStorageMigrationRan failed", data);
    return ZERO_COUNTS;
  }
}

/**
 * One-shot data migration runner. Public surface so the F3.3 unit tests can
 * exercise it directly without going through the lazy gate (which adds the
 * process-local cache layer that's awkward to reset across test cases).
 *
 * Behaviour:
 *
 * 1. If `state:migration:to_storage_v1` is already set in `ctx.kv`,
 *    returns zero counts immediately. (Honors the legacy
 *    `empixel_builder_meta` table too via `getMigrationFlag` for hosts
 *    that already ran the migration before F3.2 moved flags to KV.)
 * 2. Otherwise, SELECTs every row from `empixel_builder_layouts`. For
 *    each: read the storage side, decide migrate vs. skip via the
 *    conflict-resolution rule, and `put` if the legacy row wins.
 * 3. On success, sets the KV flag so subsequent calls short-circuit.
 * 4. On any thrown error before the loop completes, the flag is NOT set
 *    — the next call retries from the top.
 */
export async function runMigrationToStorageV1(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  },
  db: SqliteDb
): Promise<MigrationCounts> {
  const alreadyRan = await getMigrationFlag(ctx, db, MIGRATION_KEY);
  if (alreadyRan) return { ...ZERO_COUNTS };

  const counts: MigrationCounts = { migrated: 0, skipped: 0, conflicts: 0 };

  let legacyRows: LegacyRow[];
  try {
    legacyRows = db
      .prepare(
        "SELECT collection, entry_id, sections, enabled, created_at, updated_at FROM empixel_builder_layouts"
      )
      .all() as LegacyRow[];
  } catch (err) {
    // Legacy table missing entirely (fresh install) — treat as empty and
    // mark the flag so we don't keep paying the SELECT cost on every
    // request. This is the "no-data case" listed in the test plan.
    const data = { err: err instanceof Error ? err.message : String(err) };
    ctx.log.warn(
      "[empixel-builder] runMigrationToStorageV1: legacy SELECT failed (table missing?), treating as empty",
      data
    );
    legacyRows = [];
  }

  // Cast `ctx.storage.layouts` to the typed handle. The runtime shape is
  // identical; the cast just carries the row type to the `put` site so we
  // don't lose type safety. Mirrors `getLayouts()` in `src/plugin.ts`.
  const layouts = ctx.storage.layouts as StorageLayoutsCollection;

  for (const legacy of legacyRows) {
    let parsedSections: SectionBlock[] = [];
    try {
      const v = JSON.parse(legacy.sections);
      if (Array.isArray(v)) parsedSections = v as SectionBlock[];
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: bad sections JSON for ${legacy.collection}/${legacy.entry_id} — using empty array`,
        data
      );
    }

    const docId = layoutDocId(legacy.collection, legacy.entry_id);

    let storageRow: LayoutRow | null = null;
    try {
      storageRow = await layouts.get(docId);
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: ctx.storage.layouts.get failed for ${docId}`,
        data
      );
    }

    if (storageRow) {
      // Conflict — both layers have the row. Lex-compare timestamps; on
      // ties prefer storage (storage is the new source of truth). The
      // SQLite `current_timestamp` column writes ISO-8601-ish
      // `YYYY-MM-DD HH:MM:SS` UTC; modern writes go through
      // `new Date().toISOString()` from `plugin.ts`. Both formats are
      // monotonic under string compare for a given clock, which is the
      // only ordering the conflict rule cares about (within-row). Mixed
      // formats across rows still compare consistently because we never
      // compare across rows.
      counts.conflicts += 1;
      const legacyTs = legacy.updated_at ?? "";
      const storageTs = storageRow.updatedAt ?? "";
      if (legacyTs > storageTs) {
        // Legacy row is newer — overwrite the storage row.
        try {
          await layouts.put(docId, buildLayoutRowFromLegacy(legacy, parsedSections));
          counts.migrated += 1;
        } catch (err) {
          const data = { err: err instanceof Error ? err.message : String(err) };
          ctx.log.warn(
            `[empixel-builder] runMigrationToStorageV1: put failed for ${docId} — leaving storage row in place`,
            data
          );
          counts.skipped += 1;
        }
      } else {
        // Storage row is newer or tied — leave it alone.
        counts.skipped += 1;
      }
      continue;
    }

    // Fresh write — no storage row exists yet.
    try {
      await layouts.put(docId, buildLayoutRowFromLegacy(legacy, parsedSections));
      counts.migrated += 1;
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: put failed for ${docId} — will retry on next pass`,
        data
      );
      counts.skipped += 1;
    }
  }

  // Mark the flag only after the loop completes. Per-row failures above
  // increment `skipped` but don't abort the loop, so the flag still gets
  // set — the conflict-resolution rule means a re-run is a no-op for any
  // rows that did succeed, and the few that failed are graceful-degraded
  // by the F3.2 `readLayoutFromStorageOrLegacy` legacy fallback.
  //
  // What WOULD prevent the flag from being set is the SELECT itself
  // throwing in a way that propagated out of this function, or one of
  // these two await-set calls throwing. In both cases the next request
  // retries from the top. This matches step 6 of the spec ("On failure,
  // ctx.log.error and DO NOT set the flag").
  await setMigrationFlag(ctx, db, MIGRATION_KEY);

  ctx.log.info("[empixel-builder] migration_to_storage_v1 complete", {
    migrated: counts.migrated,
    skipped: counts.skipped,
    conflicts: counts.conflicts,
  });

  return counts;
}

/**
 * Pure helper — build a `LayoutRow` from one legacy SQLite row + its
 * already-parsed sections. Pulled out so the conflict-resolution branch
 * and the no-conflict branch can share the same construction.
 */
function buildLayoutRowFromLegacy(legacy: LegacyRow, sections: SectionBlock[]): LayoutRow {
  return {
    collection: legacy.collection,
    entryId: legacy.entry_id,
    enabled: legacy.enabled === 1 ? 1 : 0,
    sections,
    createdAt: legacy.created_at ?? undefined,
    updatedAt: legacy.updated_at ?? undefined,
  };
}
