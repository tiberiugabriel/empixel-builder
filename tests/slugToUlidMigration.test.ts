import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";

import { runSlugToUlidMigration_v1 } from "../src/plugin.js";
import type { SqliteDb } from "../src/dbShared.js";

const _require = createRequire(import.meta.url);

interface BetterSqliteCtor {
  new (path: string): SqliteDb;
}

interface MetaRow {
  key: string;
  value: string | null;
}

interface LayoutRow {
  collection: string;
  entry_id: string;
  sections: string;
  enabled: number;
  updated_at: string | null;
}

// 26-char Crockford base32 — valid ULID shape. EmDash IDs always start with
// "01" (timestamp prefix), so the second char range matters less than the
// total length + alphabet. These constants stand in for real entry IDs.
const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";
const ULID_C = "01HXAB000000000000000000CC";

/**
 * Spin up a fresh tmpdir-backed SQLite file with the same baseline schema
 * `getDb()` would have created. Each test case wants a clean DB so we don't
 * cross-contaminate the migration flag between scenarios.
 */
function makeDb(sandbox: string, name: string): SqliteDb {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "test.db");
  const Database = _require("better-sqlite3") as BetterSqliteCtor;
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE empixel_builder_layouts (
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
    CREATE TABLE empixel_builder_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  // Stand-in for the host's collection table.
  db.exec(`
    CREATE TABLE ec_pages (
      id   TEXT PRIMARY KEY,
      slug TEXT
    )
  `);
  return db;
}

describe("runSlugToUlidMigration_v1", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "empixel-slug-migration-"));
  const dbs: SqliteDb[] = [];

  afterAll(() => {
    for (const db of dbs) {
      try {
        db.close();
      } catch {
        // best-effort
      }
    }
    rmSync(sandbox, { recursive: true, force: true });
  });

  // Helper: open a DB and remember it for cleanup.
  function open(name: string): SqliteDb {
    const db = makeDb(sandbox, name);
    dbs.push(db);
    return db;
  }

  function getMeta(db: SqliteDb, key: string): MetaRow | undefined {
    return db
      .prepare("SELECT key, value FROM empixel_builder_meta WHERE key = ?")
      .get(key) as MetaRow | undefined;
  }

  function getLayouts(db: SqliteDb): LayoutRow[] {
    return db
      .prepare(
        "SELECT collection, entry_id, sections, enabled, updated_at FROM empixel_builder_layouts ORDER BY entry_id"
      )
      .all() as LayoutRow[];
  }

  describe("base case", () => {
    it("rewrites slug-keyed rows to ULID-keyed rows and sets the flag", () => {
      const db = open("base");
      // Seed the host collection — slug → ULID mapping for two pages.
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_B, "contact");
      // Seed layouts under the slug keys (legacy state).
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "about", "[]");
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "contact", "[]");

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      const ids = layouts.map((r) => r.entry_id).sort();
      expect(ids).toEqual([ULID_A, ULID_B].sort());
      // Every row should now match the ULID format.
      for (const row of layouts) {
        expect(row.entry_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      }
      // KV flag set so subsequent calls become no-ops.
      const meta = getMeta(db, "migration_slug_to_ulid_v1");
      expect(meta).toBeDefined();
      expect(meta?.value).toBeTruthy();
    });
  });

  describe("idempotency", () => {
    it("is a no-op when the flag is already set", () => {
      const db = open("idempotent");
      db.prepare(
        "INSERT INTO empixel_builder_meta (key, value) VALUES (?, ?)"
      ).run("migration_slug_to_ulid_v1", "1234567890");
      // Intentionally seed a slug-keyed row that the migration WOULD have
      // moved if it ran. Because the flag is set, it should be left alone.
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "about", "[]");

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].entry_id).toBe("about");
    });

    it("re-running after a successful pass does nothing", () => {
      const db = open("rerun");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "about", "[]");

      runSlugToUlidMigration_v1(db);
      const flagFirst = getMeta(db, "migration_slug_to_ulid_v1")?.value;
      // Second invocation — flag should be present, no further work.
      runSlugToUlidMigration_v1(db);
      const flagSecond = getMeta(db, "migration_slug_to_ulid_v1")?.value;
      expect(flagSecond).toBe(flagFirst);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].entry_id).toBe(ULID_A);
    });
  });

  describe("conflict resolution", () => {
    it("prefers the newer row by updated_at and drops the loser", () => {
      const db = open("conflict-newer-ulid");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      // Slug row is older.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", "about", '[{"slug-row":1}]', "2024-01-01 00:00:00");
      // ULID row is newer — should win.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", ULID_A, '[{"ulid-row":1}]', "2025-06-15 12:00:00");

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].entry_id).toBe(ULID_A);
      // Newer ULID row's contents preserved.
      expect(layouts[0].sections).toContain("ulid-row");
    });

    it("when slug row is newer, keeps slug content and drops ULID row", () => {
      const db = open("conflict-newer-slug");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_B, "contact");
      // Slug row is newer.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", "contact", '[{"slug-row":1}]', "2026-01-01 00:00:00");
      // ULID row is older.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", ULID_B, '[{"ulid-row":1}]', "2024-06-15 12:00:00");

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].entry_id).toBe(ULID_B);
      // Newer slug row's contents preserved (renamed to ULID key).
      expect(layouts[0].sections).toContain("slug-row");
    });
  });

  describe("unresolved orphans", () => {
    it("leaves rows that don't resolve to a ULID in place but still sets the flag", () => {
      const db = open("unresolved");
      // No ec_pages row for this slug — the migration cannot resolve it.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "ghost-page", '[{"orphan":1}]');

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      // Row left untouched — orphan, but harmless once the read path matches by ULID.
      expect(layouts[0].entry_id).toBe("ghost-page");
      // Flag still set so the migration doesn't keep re-running.
      const meta = getMeta(db, "migration_slug_to_ulid_v1");
      expect(meta).toBeDefined();
    });

    it("preserves already-ULID-keyed rows and skips them", () => {
      const db = open("already-ulid");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", ULID_A, '[{"already-ulid":1}]');

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      expect(layouts).toHaveLength(1);
      expect(layouts[0].entry_id).toBe(ULID_A);
      expect(layouts[0].sections).toContain("already-ulid");
    });
  });

  describe("empty / no-op tables", () => {
    it("sets the flag even when the layouts table is empty", () => {
      const db = open("empty");
      runSlugToUlidMigration_v1(db);
      const meta = getMeta(db, "migration_slug_to_ulid_v1");
      expect(meta).toBeDefined();
      expect(meta?.value).toBeTruthy();
    });
  });

  describe("mixed batch", () => {
    beforeEach(() => {
      // No-op — just an explicit reset point if we add cross-test state.
    });

    it("migrates a mix of resolvable, conflicting, orphan, and already-ULID rows in one pass", () => {
      const db = open("mixed");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_A, "about");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_B, "contact");
      db.prepare("INSERT INTO ec_pages (id, slug) VALUES (?, ?)").run(ULID_C, "team");

      // Resolvable slug — should be renamed.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "about", '[{"r":1}]');
      // Conflict — both keys exist; ULID row newer.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", "contact", '[{"slug":1}]', "2024-01-01 00:00:00");
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)"
      ).run("pages", ULID_B, '[{"ulid":1}]', "2025-12-31 12:00:00");
      // Orphan slug — no host row.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", "ghost", '[{"o":1}]');
      // Already-ULID — leave alone.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, 1)"
      ).run("pages", ULID_C, '[{"k":1}]');

      runSlugToUlidMigration_v1(db);

      const layouts = getLayouts(db);
      const byKey = Object.fromEntries(layouts.map((r) => [r.entry_id, r]));
      // Resolvable slug → ULID_A.
      expect(byKey[ULID_A]).toBeDefined();
      expect(byKey[ULID_A].sections).toContain('"r":1');
      // Conflict resolved in favour of the newer ULID-keyed row.
      expect(byKey[ULID_B]).toBeDefined();
      expect(byKey[ULID_B].sections).toContain('"ulid":1');
      // Orphan still there under its slug key.
      expect(byKey["ghost"]).toBeDefined();
      // Already-ULID row preserved.
      expect(byKey[ULID_C]).toBeDefined();
      // Slug duplicates dropped.
      expect(byKey["about"]).toBeUndefined();
      expect(byKey["contact"]).toBeUndefined();
      expect(layouts).toHaveLength(4);
    });
  });
});
