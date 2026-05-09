import { createRequire } from "node:module";
import { join } from "node:path";

// `better-sqlite3` is a peer dependency, so we resolve it lazily through
// `createRequire` (matches the previous pattern in `plugin.ts` / `components/db.ts`).
const _require = createRequire(import.meta.url);

interface SqliteStatement {
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
  run(...args: unknown[]): void;
}

export interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

export interface DbOptions {
  /**
   * Absolute or relative path to the SQLite file. Defaults to
   * `<process.cwd()>/data.db` (the host EmDash site's database).
   */
  databasePath?: string;
}

let cached: SqliteDb | null = null;
let cachedPath: string | null = null;
let configuredPath: string | null = null;

/**
 * Record a default database path supplied at plugin construction time
 * (`empixelBuilder({ databasePath })`). Later callers of `getDb()` that
 * don't pass an explicit `databasePath` will resolve to this value before
 * falling back to `<cwd>/data.db`.
 */
export function setDefaultDatabasePath(databasePath: string | undefined): void {
  configuredPath = databasePath ?? null;
}

export function resolveDatabasePath(opts?: DbOptions): string {
  if (opts?.databasePath) return opts.databasePath;
  if (configuredPath) return configuredPath;
  return join(process.cwd(), "data.db");
}

/**
 * Returns a process-wide shared SQLite handle. Subsequent calls return the
 * same instance unless `databasePath` differs from the cached path — in which
 * case the cached connection is closed and reopened against the new path.
 *
 * Both the plugin runtime (`src/plugin.ts`) and the frontend reader
 * (`src/components/db.ts`) go through this factory so the host site holds at
 * most one open file handle to the layouts DB.
 */
export function getDb(opts?: DbOptions): SqliteDb {
  const target = resolveDatabasePath(opts);
  if (cached && cachedPath === target) return cached;
  if (cached) {
    try {
      cached.close();
    } catch {
      // Closing a stale handle is best-effort. If `better-sqlite3` is unhappy
      // (e.g. the file was already removed), the next `new Database()` below
      // will surface a real error if the new path is also broken.
    }
  }
  const Database = _require("better-sqlite3");
  cached = new Database(target) as SqliteDb;
  cachedPath = target;
  return cached;
}

/**
 * Test-only helper. Drops the cached handle and any configured path so each
 * test starts from a clean slate. Used by the unit test for `getDb()` where
 * we hand it a `:memory:` path and want to verify caching behaviour rather
 * than testing the underlying SQLite driver itself.
 */
export function _resetDbForTests(): void {
  if (cached) {
    try {
      cached.close();
    } catch {
      // best-effort
    }
  }
  cached = null;
  cachedPath = null;
  configuredPath = null;
}
