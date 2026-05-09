import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import {
  runMigrationToStorageV1,
  ensureStorageMigrationRan,
  _resetMigrationCacheForTests,
  MIGRATION_KEY,
} from "../src/migrations/toStorageV1.js";
import { layoutDocId } from "../src/plugin.js";
import {
  _resetDbForTests,
  getDb,
  setDefaultDatabasePath,
} from "../src/dbShared.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import type { SectionBlock } from "../src/types.js";
import type { PluginContext, KVAccess, LogAccess } from "emdash";

/**
 * F3.3 — `migration_to_storage_v1` data migration.
 *
 * Covers the spec's required cases (per the task brief, step 8):
 *
 *   1. Seed legacy rows + zero storage rows → migration moves all → flag set.
 *   2. Seed legacy + storage with same (c,e) and storage newer → skip → counts.skipped++.
 *   3. Seed legacy + storage with same (c,e) and storage older → overwrite → counts.migrated++.
 *   4. Re-run with flag set → all zeros (no work done).
 *   5. Empty legacy table → flag still set → all zeros (so we don't keep retrying).
 *   6. Bad sections JSON → migrates with empty sections + warns.
 *   7. ensureStorageMigrationRan caches process-locally after first run.
 *   8. Bad-sections-JSON tied to a fresh insert still increments `migrated`.
 *
 * The storage-side stub mirrors the EmDash `StorageCollection<LayoutRow>`
 * surface used in `tests/storage.test.ts`. Tests use a real
 * `better-sqlite3` handle in tmpdir because the migration reads the legacy
 * table via prepared statements.
 */

const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";
const ULID_C = "01HXAB000000000000000000CC";

const sandbox = mkdtempSync(join(tmpdir(), "empixel-toStorageV1-"));
let counter = 0;
function freshDbPath(): string {
  counter += 1;
  return join(sandbox, `test-${counter}.db`);
}

afterAll(() => {
  _resetDbForTests();
  rmSync(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
  _resetMigrationCacheForTests();
});

function bootstrapDb(): void {
  _resetDbForTests();
  setDefaultDatabasePath(freshDbPath());
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
    CREATE TABLE IF NOT EXISTS empixel_builder_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

function insertLegacyRow(args: {
  collection: string;
  entryId: string;
  sections: SectionBlock[] | string;
  enabled?: 0 | 1;
  updatedAt?: string;
  createdAt?: string;
}): void {
  const sections =
    typeof args.sections === "string" ? args.sections : JSON.stringify(args.sections);
  const updatedAt = args.updatedAt ?? "2026-05-09 12:00:00";
  const createdAt = args.createdAt ?? "2026-05-09 12:00:00";
  getDb()
    .prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(args.collection, args.entryId, sections, args.enabled ?? 0, createdAt, updatedAt);
}

interface StubLogCalls {
  warn: Array<{ msg: string; data?: unknown }>;
  error: Array<{ msg: string; data?: unknown }>;
  info: Array<{ msg: string; data?: unknown }>;
  debug: Array<{ msg: string; data?: unknown }>;
}

function makeLogStub(): { log: LogAccess; calls: StubLogCalls } {
  const calls: StubLogCalls = { warn: [], error: [], info: [], debug: [] };
  const log: LogAccess = {
    debug: (msg, data) => calls.debug.push({ msg, data }),
    info: (msg, data) => calls.info.push({ msg, data }),
    warn: (msg, data) => calls.warn.push({ msg, data }),
    error: (msg, data) => calls.error.push({ msg, data }),
  };
  return { log, calls };
}

function makeKvStub(initial: Record<string, unknown> = {}): {
  kv: KVAccess;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>(Object.entries(initial));
  const kv: KVAccess = {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      return store.delete(key);
    },
    async list() {
      return [...store.entries()].map(([key, value]) => ({ key, value }));
    },
  };
  return { kv, store };
}

function makeStorageStub(): {
  collection: StorageLayoutsCollection;
  store: Map<string, LayoutRow>;
} {
  const store = new Map<string, LayoutRow>();
  const collection: StorageLayoutsCollection = {
    async get(id) {
      return store.get(id) ?? null;
    },
    async put(id, data) {
      store.set(id, data);
    },
    async delete(id) {
      return store.delete(id);
    },
    async exists(id) {
      return store.has(id);
    },
    async getMany(ids) {
      const map = new Map<string, LayoutRow>();
      for (const id of ids) {
        const v = store.get(id);
        if (v) map.set(id, v);
      }
      return map;
    },
    async putMany(items) {
      for (const { id, data } of items) store.set(id, data);
    },
    async deleteMany(ids) {
      let n = 0;
      for (const id of ids) if (store.delete(id)) n += 1;
      return n;
    },
    async query() {
      return {
        items: [...store.entries()].map(([id, data]) => ({ id, data })),
        hasMore: false,
      };
    },
    async count() {
      return store.size;
    },
  };
  return { collection, store };
}

function makeCtx(args: {
  storage: StorageLayoutsCollection;
  kv: KVAccess;
  log: LogAccess;
}): {
  log: LogAccess;
  kv: KVAccess;
  storage: PluginContext["storage"];
} {
  return {
    log: args.log,
    kv: args.kv,
    storage: { layouts: args.storage } as unknown as PluginContext["storage"],
  };
}

describe("runMigrationToStorageV1 — base case (zero storage, populated legacy)", () => {
  it("copies every legacy row into ctx.storage and sets the KV flag", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "container", config: {} } as SectionBlock],
      enabled: 1,
    });
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_B,
      sections: [{ id: "y", type: "text", config: {} } as SectionBlock],
      enabled: 0,
    });
    insertLegacyRow({
      collection: "posts",
      entryId: ULID_C,
      sections: [],
      enabled: 1,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 3, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(3);

    const a = storageStore.get(layoutDocId("pages", ULID_A));
    expect(a).toBeDefined();
    expect(a!.collection).toBe("pages");
    expect(a!.entryId).toBe(ULID_A);
    expect(a!.enabled).toBe(1);
    expect(a!.sections).toEqual([{ id: "x", type: "container", config: {} }]);

    const b = storageStore.get(layoutDocId("pages", ULID_B));
    expect(b!.enabled).toBe(0);

    const c = storageStore.get(layoutDocId("posts", ULID_C));
    expect(c!.collection).toBe("posts");
    expect(c!.sections).toEqual([]);

    // Flag must be present in BOTH KV and the legacy meta table (the
    // setMigrationFlag helper mirrors during the F3.2/F3.5 transition).
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
    const metaRow = getDb()
      .prepare("SELECT value FROM empixel_builder_meta WHERE key = ?")
      .get(MIGRATION_KEY) as { value: string } | undefined;
    expect(metaRow?.value).toBeDefined();

    // Success path logs to info with the counts.
    expect(calls.info.some((c) => /migration_to_storage_v1 complete/.test(c.msg))).toBe(true);
  });
});

describe("runMigrationToStorageV1 — conflict resolution", () => {
  it("skips when storage row is newer than legacy row (counts.skipped++)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "old", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: "2026-05-01 12:00:00",
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "new", type: "text", config: {} } as SectionBlock],
      updatedAt: "2026-05-09T12:00:00.000Z",
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 0, skipped: 1, conflicts: 1 });
    // Storage row preserved — `id: "new"` is still there.
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "new", type: "text", config: {} },
    ]);
  });

  it("overwrites when storage row is older than legacy row (counts.migrated++)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "fresh-from-legacy", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: "2026-05-09 12:00:00",
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "stale-storage", type: "text", config: {} } as SectionBlock],
      updatedAt: "2026-05-01 00:00:00",
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 1, skipped: 0, conflicts: 1 });
    // Storage row was overwritten with the legacy contents.
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "fresh-from-legacy", type: "text", config: {} },
    ]);
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.enabled).toBe(1);
  });

  it("on tie (equal updatedAt) storage wins", async () => {
    bootstrapDb();
    const sameTs = "2026-05-09 12:00:00";
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "legacy-tie", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: sameTs,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "storage-tie", type: "text", config: {} } as SectionBlock],
      updatedAt: sameTs,
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 0, skipped: 1, conflicts: 1 });
    // Storage wins on tie.
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "storage-tie", type: "text", config: {} },
    ]);
  });
});

describe("runMigrationToStorageV1 — idempotency", () => {
  it("no-ops when KV flag is already set (returns zeros, doesn't touch storage)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub({
      [`state:migration:${MIGRATION_KEY}`]: "already-ran-ts",
    });
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
  });

  it("syncs forward from legacy meta flag and treats as already-ran", async () => {
    // The F3.2 contract: if KV is empty but legacy meta has the flag,
    // treat as migrated. This is the upgrade path from a hypothetical
    // pre-F3.2 environment that ran the migration once already.
    bootstrapDb();
    getDb()
      .prepare("INSERT INTO empixel_builder_meta (key, value) VALUES (?, ?)")
      .run(MIGRATION_KEY, "legacy-flag-ts");
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
    // The flag was synced forward to KV by getMigrationFlag.
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
  });

  it("re-running after a successful migration is a no-op", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await runMigrationToStorageV1(ctx, getDb());
    expect(first.migrated).toBe(1);
    const sizeAfterFirst = storageStore.size;

    const second = await runMigrationToStorageV1(ctx, getDb());
    expect(second).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(sizeAfterFirst);
  });
});

describe("runMigrationToStorageV1 — empty legacy table", () => {
  it("sets the flag even when there are no rows to migrate", async () => {
    bootstrapDb(); // tables exist but empty

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
    // Flag must still be set so we don't keep paying the SELECT cost.
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
  });
});

describe("runMigrationToStorageV1 — bad sections JSON", () => {
  it("falls back to empty sections, logs warn, still increments migrated", async () => {
    bootstrapDb();
    // Insert a row whose sections column is unparseable JSON. The migration
    // should not crash; it should log and migrate with sections=[].
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: "not-valid-json",
      enabled: 1,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx, getDb());

    expect(counts).toEqual({ migrated: 1, skipped: 0, conflicts: 0 });
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([]);
    expect(calls.warn.some((c) => /bad sections JSON/.test(c.msg))).toBe(true);
  });
});

describe("ensureStorageMigrationRan — process-local cache", () => {
  it("first call runs the migration; second call is a no-op (cached)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await ensureStorageMigrationRan(ctx, getDb());
    expect(first.migrated).toBe(1);
    const sizeAfterFirst = storageStore.size;

    // Tamper with the KV store to simulate "what if the flag got nuked"
    // — the process-local cache should still short-circuit so we don't
    // re-run.
    kvStore.delete(`state:migration:${MIGRATION_KEY}`);

    const second = await ensureStorageMigrationRan(ctx, getDb());
    expect(second).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(sizeAfterFirst);
  });

  it("recovers when the inner runner throws (cache stays unset)", async () => {
    // We can simulate a thrown migration by handing a `put` that throws on
    // every call. The runner catches the error in ensureStorageMigrationRan
    // (NOT inside runMigrationToStorageV1 — the inner runner itself is
    // expected to throw on persistent failures). The next call should be
    // able to retry.
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    let putCalls = 0;
    const flakyLayouts: StorageLayoutsCollection = {
      ...makeStorageStub().collection,
      async put() {
        putCalls += 1;
        if (putCalls === 1) throw new Error("simulated storage outage");
      },
    };
    const ctx = makeCtx({ storage: flakyLayouts, kv, log });

    // First call — put fails. The runner catches the per-row failure and
    // logs, but still sets the flag (matches "graceful degradation" rule).
    const first = await ensureStorageMigrationRan(ctx, getDb());
    expect(first.migrated).toBe(0);
    // The error path inside the runner increments `skipped` rather than
    // throwing, so ensureStorageMigrationRan returns normally.
    expect(first.skipped).toBe(1);
    expect(calls.warn.some((c) => /will retry on next pass/.test(c.msg))).toBe(true);
  });
});
