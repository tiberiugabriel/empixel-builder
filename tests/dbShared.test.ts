import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import {
  _resetDbForTests,
  getDb,
  resolveDatabasePath,
  setDefaultDatabasePath,
} from "../src/dbShared.js";

describe("resolveDatabasePath", () => {
  beforeEach(() => {
    _resetDbForTests();
  });

  it("falls back to <cwd>/data.db when no option and no default are set", () => {
    const resolved = resolveDatabasePath();
    expect(resolved.endsWith("data.db")).toBe(true);
  });

  it("honours the explicit option ahead of the configured default", () => {
    setDefaultDatabasePath("/tmp/configured.db");
    expect(resolveDatabasePath({ databasePath: "/tmp/explicit.db" })).toBe("/tmp/explicit.db");
  });

  it("falls back to the configured default when no explicit option is passed", () => {
    setDefaultDatabasePath("/tmp/configured.db");
    expect(resolveDatabasePath()).toBe("/tmp/configured.db");
  });
});

describe("getDb", () => {
  // Real SQLite handles need a writable location. We park them under tmpdir
  // and clean up at the end so the test doesn't leave files in the repo.
  const sandbox = mkdtempSync(join(tmpdir(), "empixel-dbshared-"));
  const dbA = join(sandbox, "a.db");
  const dbB = join(sandbox, "b.db");

  beforeEach(() => {
    _resetDbForTests();
  });

  afterAll(() => {
    _resetDbForTests();
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("returns the same instance for repeated calls with the same path", () => {
    const first = getDb({ databasePath: dbA });
    const second = getDb({ databasePath: dbA });
    expect(second).toBe(first);
  });

  it("returns a fresh instance when the path changes", () => {
    const first = getDb({ databasePath: dbA });
    const second = getDb({ databasePath: dbB });
    expect(second).not.toBe(first);
  });
});
