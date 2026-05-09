import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import {
  getBuilderLayout,
  builderLayoutCacheTag,
} from "../src/components/db.js";
import {
  _resetDbForTests,
  getDb,
  setDefaultDatabasePath,
} from "../src/dbShared.js";

// 26-char Crockford base32 — valid ULID shape.
const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";

const sandbox = mkdtempSync(join(tmpdir(), "empixel-get-layout-"));
let counter = 0;

function freshDbPath(): string {
  counter += 1;
  return join(sandbox, `test-${counter}.db`);
}

/**
 * Bootstrap a clean SQLite file with the canonical layouts schema and a
 * stand-in `ec_<collection>` table the slug → ULID resolution can read.
 */
function bootstrap(collection: string): string {
  const path = freshDbPath();
  setDefaultDatabasePath(path);
  const db = getDb();
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
    CREATE TABLE IF NOT EXISTS ec_${collection} (
      id   TEXT PRIMARY KEY,
      slug TEXT
    )
  `);
  return path;
}

describe("builderLayoutCacheTag", () => {
  it("encodes collection and entry id", () => {
    expect(builderLayoutCacheTag("posts", ULID_A)).toBe(
      `empixel:layout:posts:${ULID_A}`,
    );
  });
});

describe("getBuilderLayout", () => {
  beforeEach(() => {
    _resetDbForTests();
  });

  afterAll(() => {
    _resetDbForTests();
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("returns null sections + tagged cacheHint when the layout row is missing", () => {
    bootstrap("pages");
    const result = getBuilderLayout("pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    // No row — no `lastModified`.
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns null sections + cacheHint when the host short-circuits with enabled=false", () => {
    bootstrap("pages");
    const result = getBuilderLayout("pages", ULID_A, false);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    // Short-circuit path doesn't touch SQLite, so no timestamp either.
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns sections + lastModified for an enabled layout row", () => {
    bootstrap("pages");
    const db = getDb();
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)",
    ).run("pages", ULID_A, JSON.stringify([]), "2026-05-09 14:30:15");
    const result = getBuilderLayout("pages", ULID_A);
    expect(Array.isArray(result.sections)).toBe(true);
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeInstanceOf(Date);
    // Parsed UTC: SQLite emits `YYYY-MM-DD HH:MM:SS` and we treat it as UTC.
    expect(result.cacheHint.lastModified?.toISOString()).toBe(
      "2026-05-09T14:30:15.000Z",
    );
  });

  it("emits lastModified even when the row exists but is disabled", () => {
    // Admin can save a layout while keeping it disabled; saving a future
    // enable still has to bust the cache, so the timestamp is meaningful
    // even on the disabled-row path.
    bootstrap("pages");
    const db = getDb();
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 0, ?)",
    ).run("pages", ULID_A, JSON.stringify([]), "2026-05-09 12:00:00");
    const result = getBuilderLayout("pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.lastModified?.toISOString()).toBe(
      "2026-05-09T12:00:00.000Z",
    );
  });

  it("resolves slug → ULID before deriving the cache tag", () => {
    // The cache tag binds to the `entryId` argument the host actually
    // passed, regardless of slug→ULID resolution. Hosts pass `entry.data.id`
    // (always a ULID via `getEmDashEntry`), but the slug path matters for
    // the fresh-entry case where the host CMS hands the builder a slug.
    bootstrap("pages");
    const db = getDb();
    db.prepare(`INSERT INTO ec_pages (id, slug) VALUES (?, ?)`).run(
      ULID_B,
      "hello-world",
    );
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)",
    ).run("pages", ULID_B, JSON.stringify([]), "2026-05-09 09:00:00");

    const result = getBuilderLayout("pages", "hello-world");
    expect(Array.isArray(result.sections)).toBe(true);
    // Tag uses the slug (the argument the host passed) — that's the
    // identity the host page asked for. Saves go through the same slug
    // → ULID resolution and emit the same tag, so the bind is consistent.
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:hello-world`,
    ]);
    expect(result.cacheHint.lastModified?.toISOString()).toBe(
      "2026-05-09T09:00:00.000Z",
    );
  });

  it("returns the tagged hint even when the collection name is invalid", () => {
    // The reader hard-fails an invalid collection name so it never ends
    // up in a SQL identifier (`ec_<collection>`). Even on this rejection
    // path the caller still gets a `cacheHint` it can pass to
    // `Astro.cache.set` — we don't want a dead branch where the host
    // forgets to call set just because input was malformed.
    bootstrap("pages");
    const result = getBuilderLayout("PaGeS!!", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:PaGeS!!:${ULID_A}`,
    ]);
  });
});
