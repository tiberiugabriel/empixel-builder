import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { ensureEmpixelBuilderColumn } from "../src/plugin.js";
import type { SqliteDb } from "../src/dbShared.js";

// `better-sqlite3` is a peer dependency, so resolve it through createRequire
// (matches the pattern in `src/dbShared.ts`).
const _require = createRequire(import.meta.url);

interface BetterSqliteCtor {
  new (path: string): SqliteDb;
}

interface ColumnRow {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

// `ensureEmpixelBuilderColumn` calls `logCaught(ctx, ...)` on non-duplicate
// errors. The duplicate-column path doesn't call the logger, so a stub is
// only needed for the negative case. Capture calls so the assertion can
// confirm we logged (and didn't throw) on a missing table.
function makeLogStub(): { ctx: { log: { warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void } }; calls: { level: string; args: unknown[] }[] } {
  const calls: { level: string; args: unknown[] }[] = [];
  return {
    ctx: {
      log: {
        warn: (...args) => calls.push({ level: "warn", args }),
        error: (...args) => calls.push({ level: "error", args }),
      },
    },
    calls,
  };
}

describe("ensureEmpixelBuilderColumn", () => {
  // Use a tmpdir scratch DB. `:memory:` would also work but a real file makes
  // the test closer to production behaviour and allows multiple connections
  // if we ever extend coverage there.
  const sandbox = mkdtempSync(join(tmpdir(), "empixel-ensure-col-"));
  const dbPath = join(sandbox, "test.db");
  let db: SqliteDb;

  beforeAll(() => {
    const Database = _require("better-sqlite3") as BetterSqliteCtor;
    db = new Database(dbPath);
    // Simulate the host's collection table — id + the usual baseline columns.
    db.exec(`
      CREATE TABLE ec_pages (
        id   TEXT PRIMARY KEY,
        slug TEXT
      )
    `);
  });

  afterAll(() => {
    db.close();
    rmSync(sandbox, { recursive: true, force: true });
  });

  function getColumns(table: string): ColumnRow[] {
    return db.prepare(`PRAGMA table_info(${table})`).all() as ColumnRow[];
  }

  it("adds the empixel_builder column when it does not exist", () => {
    expect(getColumns("ec_pages").map((c) => c.name)).not.toContain("empixel_builder");
    const stub = makeLogStub();
    ensureEmpixelBuilderColumn(db, "pages", stub.ctx);
    const cols = getColumns("ec_pages");
    const col = cols.find((c) => c.name === "empixel_builder");
    expect(col).toBeDefined();
    expect(col?.type.toUpperCase()).toBe("INTEGER");
    expect(col?.notnull).toBe(1);
    expect(col?.dflt_value).toBe("0");
    // No log calls on the success path.
    expect(stub.calls).toEqual([]);
  });

  it("is idempotent — calling twice does not throw and does not log", () => {
    const stub = makeLogStub();
    expect(() => ensureEmpixelBuilderColumn(db, "pages", stub.ctx)).not.toThrow();
    expect(() => ensureEmpixelBuilderColumn(db, "pages", stub.ctx)).not.toThrow();
    // Duplicate column is swallowed silently — no log noise.
    expect(stub.calls).toEqual([]);
  });

  it("logs (does not throw) when the target table is missing", () => {
    const stub = makeLogStub();
    expect(() => ensureEmpixelBuilderColumn(db, "missing_table", stub.ctx)).not.toThrow();
    // Non-duplicate error → routed through logCaught (warn level by default).
    expect(stub.calls.length).toBeGreaterThan(0);
    expect(stub.calls[0].level).toBe("warn");
  });
});
