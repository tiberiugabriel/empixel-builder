import { describe, it, expect, beforeEach } from "vitest";
import type { PluginContext, KVAccess, LogAccess } from "emdash";

import {
  runMigrationLegacySpacingV1,
  ensureLegacySpacingMigrationRan,
  rewriteSectionsInPlace,
  _resetMigrationCacheForTests,
  MIGRATION_KEY,
  LEGACY_SPACING_TO_PX,
  layoutDocId,
} from "../src/migrations/legacySpacingV1.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import type { SectionBlock } from "../src/types.js";

/**
 * F3.6.4 — `migration_legacy_spacing_v1` data migration.
 *
 * Walks every row in `ctx.storage.layouts` and rewrites any
 * `paddingTop/Right/Bottom/Left` + `marginTop/Right/Bottom/Left`
 * values matching the legacy symbolic set (`none/sm/md/lg/xl`) to
 * their px equivalents (matching the old `spacingMap` in
 * `SectionContainer.astro`):
 *
 *   none → "0", sm → "32px", md → "48px", lg → "64px", xl → "96px"
 *
 * Covers `style`, `styleHover`, `styleDark`, `styleBreakpoints[bp]`,
 * `styleHoverBreakpoints[bp]`, recursively into `block.children` and
 * `block.slots`. Idempotent + KV-flag-gated alongside
 * `migration_to_storage_v1`.
 */

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

/**
 * In-memory storage stub. Tracks every `put` so tests can assert
 * write-vs-skip telemetry. The `query` implementation honours
 * `where: { collection }` against the row's `data.collection` field
 * because the migration uses that filter.
 */
function makeStorageStub(): {
  collection: StorageLayoutsCollection;
  store: Map<string, LayoutRow>;
  putCalls: Array<{ id: string; data: LayoutRow }>;
} {
  const store = new Map<string, LayoutRow>();
  const putCalls: Array<{ id: string; data: LayoutRow }> = [];
  const collection: StorageLayoutsCollection = {
    async get(id) {
      return store.get(id) ?? null;
    },
    async put(id, data) {
      putCalls.push({ id, data });
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
      for (const { id, data } of items) {
        putCalls.push({ id, data });
        store.set(id, data);
      }
    },
    async deleteMany(ids) {
      let n = 0;
      for (const id of ids) if (store.delete(id)) n += 1;
      return n;
    },
    async query(options) {
      const where = options?.where ?? {};
      const targetCollection = (where as { collection?: string }).collection;
      const filtered = [...store.entries()].filter(([, row]) =>
        targetCollection === undefined ? true : row.collection === targetCollection
      );
      return {
        items: filtered.map(([id, data]) => ({ id, data })),
        hasMore: false,
      };
    },
    async count() {
      return store.size;
    },
  };
  return { collection, store, putCalls };
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

beforeEach(() => {
  _resetMigrationCacheForTests();
});

const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";
const ULID_C = "01HXAB000000000000000000CC";

function makeRow(args: {
  collection?: string;
  entryId?: string;
  sections: SectionBlock[];
  enabled?: 0 | 1;
  updatedAt?: string;
}): LayoutRow {
  return {
    collection: args.collection ?? "pages",
    entryId: args.entryId ?? ULID_A,
    enabled: args.enabled ?? 1,
    sections: args.sections,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: args.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("LEGACY_SPACING_TO_PX — verbatim values from SectionContainer.astro", () => {
  it("matches the spacingMap fallback values exactly", () => {
    expect(LEGACY_SPACING_TO_PX.none).toBe("0");
    expect(LEGACY_SPACING_TO_PX.sm).toBe("32px");
    expect(LEGACY_SPACING_TO_PX.md).toBe("48px");
    expect(LEGACY_SPACING_TO_PX.lg).toBe("64px");
    expect(LEGACY_SPACING_TO_PX.xl).toBe("96px");
  });
});

describe("rewriteSectionsInPlace — pure helper", () => {
  it("rewrites padding* values on style", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          style: {
            paddingTop: "md",
            paddingRight: "sm",
            paddingBottom: "lg",
            paddingLeft: "xl",
            color: "red", // unrelated, must be preserved
          },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].config.style).toEqual({
      paddingTop: "48px",
      paddingRight: "32px",
      paddingBottom: "64px",
      paddingLeft: "96px",
      color: "red",
    });
  });

  it("rewrites margin* values on style", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          style: {
            marginTop: "none",
            marginRight: "sm",
            marginBottom: "md",
            marginLeft: "lg",
          },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].config.style).toEqual({
      marginTop: "0",
      marginRight: "32px",
      marginBottom: "48px",
      marginLeft: "64px",
    });
  });

  it("rewrites styleHover and styleDark independently", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          styleHover: { paddingTop: "md" },
          styleDark: { paddingBottom: "xl" },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].config.styleHover).toEqual({ paddingTop: "48px" });
    expect(sections[0].config.styleDark).toEqual({ paddingBottom: "96px" });
  });

  it("rewrites styleBreakpoints[bp] and styleHoverBreakpoints[bp]", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          styleBreakpoints: {
            "tablet-portrait": { paddingTop: "sm", paddingBottom: "lg", _px: 768 },
            "mobile-portrait": { paddingLeft: "md", _px: 480 },
          },
          styleHoverBreakpoints: {
            "tablet-portrait": { marginRight: "xl", _px: 768 },
          },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].config.styleBreakpoints!["tablet-portrait"]).toEqual({
      paddingTop: "32px",
      paddingBottom: "64px",
      _px: 768,
    });
    expect(sections[0].config.styleBreakpoints!["mobile-portrait"]).toEqual({
      paddingLeft: "48px",
      _px: 480,
    });
    expect(sections[0].config.styleHoverBreakpoints!["tablet-portrait"]).toEqual({
      marginRight: "96px",
      _px: 768,
    });
  });

  it("recurses into block.children", () => {
    const sections: SectionBlock[] = [
      {
        id: "outer",
        type: "container",
        config: { style: {} },
        children: [
          {
            id: "inner",
            type: "text",
            config: {
              style: { paddingTop: "md" },
            },
          },
        ],
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].children![0].config.style).toEqual({ paddingTop: "48px" });
  });

  it("recurses into block.slots (multi-column container)", () => {
    const sections: SectionBlock[] = [
      {
        id: "outer",
        type: "container",
        config: {},
        slots: [
          [
            { id: "s0a", type: "text", config: { style: { paddingTop: "sm" } } },
            { id: "s0b", type: "text", config: { style: { paddingBottom: "lg" } } },
          ],
          [{ id: "s1a", type: "text", config: { style: { marginTop: "md" } } }],
        ],
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].slots![0][0].config.style).toEqual({ paddingTop: "32px" });
    expect(sections[0].slots![0][1].config.style).toEqual({ paddingBottom: "64px" });
    expect(sections[0].slots![1][0].config.style).toEqual({ marginTop: "48px" });
  });

  it("returns false when there is nothing to rewrite", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          style: { paddingTop: "12px", paddingBottom: "0" },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(false);
    expect(sections[0].config.style).toEqual({ paddingTop: "12px", paddingBottom: "0" });
  });

  it("ignores non-spacing keys with symbolic values", () => {
    // Other CSS keys may carry "md" as a legitimate font-size or similar
    // (hypothetical) — rewriting them would be wrong. Only the
    // padding/margin allowlist is touched.
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          style: { fontSize: "md", gap: "sm", paddingTop: "md" },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(true);
    expect(sections[0].config.style).toEqual({
      fontSize: "md",
      gap: "sm",
      paddingTop: "48px",
    });
  });

  it("ignores values that are not in the legacy set (string passthrough)", () => {
    const sections: SectionBlock[] = [
      {
        id: "a",
        type: "container",
        config: {
          style: {
            paddingTop: "12px", // already px
            paddingRight: "var(--gap)", // CSS var
            paddingBottom: "auto", // not in set
          },
        },
      },
    ];
    const changed = rewriteSectionsInPlace(sections);
    expect(changed).toBe(false);
    expect(sections[0].config.style).toEqual({
      paddingTop: "12px",
      paddingRight: "var(--gap)",
      paddingBottom: "auto",
    });
  });
});

describe("runMigrationLegacySpacingV1 — base case", () => {
  it("rewrites legacy values across multiple rows + collections, sets the KV flag", async () => {
    const { collection: layouts, store: storageStore, putCalls } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub({
      "settings:enabledCollections": ["pages", "posts"],
    });
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        collection: "pages",
        entryId: ULID_A,
        sections: [
          {
            id: "outer",
            type: "container",
            config: {
              style: { paddingTop: "md", paddingBottom: "lg" },
            },
            children: [
              {
                id: "inner",
                type: "text",
                config: { style: { marginTop: "sm" } },
              },
            ],
          },
        ],
      })
    );
    storageStore.set(
      layoutDocId("posts", ULID_B),
      makeRow({
        collection: "posts",
        entryId: ULID_B,
        sections: [
          {
            id: "x",
            type: "container",
            config: { style: { paddingLeft: "xl" } },
          },
        ],
      })
    );

    const counts = await runMigrationLegacySpacingV1(ctx);

    expect(counts.migrated).toBe(2);
    expect(counts.skipped).toBe(0);
    expect(counts.rowsTouched).toBe(2);

    const a = storageStore.get(layoutDocId("pages", ULID_A));
    expect(a!.sections[0].config.style).toEqual({
      paddingTop: "48px",
      paddingBottom: "64px",
    });
    expect(a!.sections[0].children![0].config.style).toEqual({ marginTop: "32px" });

    const b = storageStore.get(layoutDocId("posts", ULID_B));
    expect(b!.sections[0].config.style).toEqual({ paddingLeft: "96px" });

    // Flag must be present in KV.
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();

    // Two put calls (one per migrated row).
    expect(putCalls).toHaveLength(2);

    // Success path logs to info with the counts.
    expect(
      calls.info.some((c) => /migration_legacy_spacing_v1 complete/.test(c.msg))
    ).toBe(true);
  });
});

describe("runMigrationLegacySpacingV1 — idempotency", () => {
  it("no-ops when KV flag is already set (returns zeros, doesn't touch storage)", async () => {
    const { collection: layouts, store: storageStore, putCalls } = makeStorageStub();
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        sections: [
          {
            id: "a",
            type: "container",
            config: { style: { paddingTop: "md" } },
          },
        ],
      })
    );

    const { kv } = makeKvStub({
      [`state:migration:${MIGRATION_KEY}`]: "already-ran-ts",
    });
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 0, rowsTouched: 0 });
    expect(putCalls).toHaveLength(0);
    // Row is unchanged.
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections[0].config.style).toEqual({
      paddingTop: "md",
    });
  });

  it("re-running after a successful pass is a no-op (process cache cleared)", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await runMigrationLegacySpacingV1(ctx);
    expect(first.migrated).toBe(1);

    const second = await runMigrationLegacySpacingV1(ctx);
    expect(second).toEqual({ migrated: 0, skipped: 0, rowsTouched: 0 });
  });
});

describe("runMigrationLegacySpacingV1 — no legacy values present", () => {
  it("skips rows with no symbolic values but still sets the KV flag", async () => {
    const { collection: layouts, store: storageStore, putCalls } = makeStorageStub();
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        sections: [
          {
            id: "a",
            type: "container",
            config: { style: { paddingTop: "12px", paddingBottom: "24px" } },
          },
        ],
      })
    );

    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);

    expect(counts.migrated).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(counts.rowsTouched).toBe(1);
    expect(putCalls).toHaveLength(0); // No write needed.
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
  });
});

describe("runMigrationLegacySpacingV1 — empty storage", () => {
  it("empty storage → flag still set, zero rowsTouched", async () => {
    const { collection: layouts } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 0, rowsTouched: 0 });
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
  });
});

describe("runMigrationLegacySpacingV1 — collection discovery", () => {
  it("uses settings:enabledCollections when present", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    // A layout under a non-default collection (`articles`) is rewritten only
    // when `settings:enabledCollections` includes it.
    storageStore.set(
      layoutDocId("articles", ULID_C),
      makeRow({
        collection: "articles",
        entryId: ULID_C,
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );

    const { kv } = makeKvStub({
      "settings:enabledCollections": ["articles"],
    });
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);
    expect(counts.migrated).toBe(1);
    expect(
      storageStore.get(layoutDocId("articles", ULID_C))!.sections[0].config.style
    ).toEqual({ paddingTop: "48px" });
  });

  it("falls back to ['pages', 'posts'] when settings:enabledCollections is empty", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        collection: "pages",
        entryId: ULID_A,
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );

    const { kv } = makeKvStub(); // No KV entry.
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);
    expect(counts.migrated).toBe(1);
  });
});

describe("runMigrationLegacySpacingV1 — failure paths", () => {
  it("per-row put failure increments skipped + warns 'will retry'", async () => {
    const stub = makeStorageStub();
    stub.store.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );
    const flakyLayouts: StorageLayoutsCollection = {
      ...stub.collection,
      async put() {
        throw new Error("simulated storage outage");
      },
    };
    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: flakyLayouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);
    expect(counts.migrated).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(counts.rowsTouched).toBe(1);
    expect(calls.warn.some((c) => /will retry on next pass/.test(c.msg))).toBe(true);
  });

  it("malformed sections (non-array) is skipped + warned", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    const bad = makeRow({
      sections: "not-an-array" as unknown as SectionBlock[],
    });
    storageStore.set(layoutDocId("pages", ULID_A), bad);

    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationLegacySpacingV1(ctx);
    expect(counts.migrated).toBe(0);
    expect(counts.skipped).toBe(1);
    expect(counts.rowsTouched).toBe(1);
    expect(calls.warn.some((c) => /non-array sections/.test(c.msg))).toBe(true);
  });
});

describe("ensureLegacySpacingMigrationRan — process-local cache", () => {
  it("first call runs the migration; second call is a no-op (cached)", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );

    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await ensureLegacySpacingMigrationRan(ctx);
    expect(first.migrated).toBe(1);

    // Tamper with the KV store to simulate "what if the flag got nuked"
    // — the process-local cache should still short-circuit.
    kvStore.delete(`state:migration:${MIGRATION_KEY}`);

    const second = await ensureLegacySpacingMigrationRan(ctx);
    expect(second).toEqual({ migrated: 0, skipped: 0, rowsTouched: 0 });
  });
});

describe("runMigrationLegacySpacingV1 — updatedAt bumped on rewrite", () => {
  it("bumps updatedAt to a fresh ISO timestamp on rewritten rows", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    const beforeIso = "2026-01-01T00:00:00.000Z";
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        updatedAt: beforeIso,
        sections: [
          { id: "a", type: "container", config: { style: { paddingTop: "md" } } },
        ],
      })
    );

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    await runMigrationLegacySpacingV1(ctx);

    const after = storageStore.get(layoutDocId("pages", ULID_A));
    expect(after!.updatedAt).toBeDefined();
    expect(after!.updatedAt).not.toBe(beforeIso);
    // Must be a valid ISO timestamp.
    expect(() => new Date(after!.updatedAt!).toISOString()).not.toThrow();
  });

  it("does NOT bump updatedAt on rows that did not need rewriting", async () => {
    const { collection: layouts, store: storageStore } = makeStorageStub();
    const beforeIso = "2026-01-01T00:00:00.000Z";
    storageStore.set(
      layoutDocId("pages", ULID_A),
      makeRow({
        updatedAt: beforeIso,
        sections: [
          {
            id: "a",
            type: "container",
            config: { style: { paddingTop: "12px" } },
          },
        ],
      })
    );

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    await runMigrationLegacySpacingV1(ctx);

    const after = storageStore.get(layoutDocId("pages", ULID_A));
    expect(after!.updatedAt).toBe(beforeIso);
  });
});
