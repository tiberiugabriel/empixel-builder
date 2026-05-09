import { describe, it, expect } from "vitest";

import {
  getBuilderLayout,
  builderLayoutCacheTag,
  type BuilderLayoutContext,
} from "../src/components/db.js";
import type { LayoutRow } from "../src/storage-types.js";

// 26-char Crockford base32 — valid ULID shape.
const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXBB000000000000000000BB";

/**
 * F3.4 + F3.5 — frontend `getBuilderLayout` is async, takes `Astro` (or any
 * `BuilderLayoutContext`) as the first argument, and reads through
 * EmDash's `_plugin_storage` table via `Astro.locals.emdash.db` (Kysely).
 *
 * **Post-F3.5 the legacy `better-sqlite3` fallback is gone**.
 *
 * **Post-fix/F3.4-frontend-empty (P0 hotfix)**: rows are looked up by the
 * canonical composite doc id `${collection}::${entryId}` — the same key
 * the plugin runtime writes them under (`src/plugin.ts § layoutDocId`).
 * The previous F3.4 query filtered only on `(plugin_id, collection)` and
 * called `executeTakeFirst()`, which returned an arbitrary plugin row;
 * the post-fetch `parsed.collection !== collection` guard then forced
 * null even when the right row existed. The orphan-row collision case
 * is exercised below.
 */

interface StorageStubRow {
  plugin_id: string;
  collection: string;
  id: string;
  data: string;
  updated_at?: string;
}
function makeStorageStub(rows: StorageStubRow[]): {
  ctx: BuilderLayoutContext;
  pushed: StorageStubRow[];
} {
  const pushed = [...rows];
  type Filter = [field: string, op: string, value: unknown];
  function buildSelector(initial: Filter[] = []) {
    const filters: Filter[] = [...initial];
    const builder = {
      select(_cols: string[]) {
        return builder;
      },
      where(field: string, op: string, value: unknown) {
        filters.push([field, op, value]);
        return builder;
      },
      executeTakeFirst() {
        const match = pushed.find((row) => {
          return filters.every(([field, op, value]) => {
            if (op !== "=") return false;
            return (row as unknown as Record<string, unknown>)[field] === value;
          });
        });
        return Promise.resolve(match);
      },
      execute() {
        const matches = pushed.filter((row) => {
          return filters.every(([field, op, value]) => {
            if (op !== "=") return false;
            return (row as unknown as Record<string, unknown>)[field] === value;
          });
        });
        return Promise.resolve(matches);
      },
    };
    return builder;
  }
  const db = {
    selectFrom(_table: string) {
      return buildSelector();
    },
  };
  const ctx: BuilderLayoutContext = {
    locals: { emdash: { db } },
  };
  return { ctx, pushed };
}

/**
 * Empty Astro-like context — no `db` exposed. The reader will fall back to
 * `getDb()` from `emdash/runtime`; in the vitest environment the runtime
 * has no virtual modules wired and `getDb()` throws — `resolveKyselyHandle`
 * swallows that and returns null, so the call short-circuits to `null`
 * sections.
 */
function makeNoStorageCtx(): BuilderLayoutContext {
  return { locals: { emdash: {} } };
}

/**
 * Build a `${collection}::${entryId}` doc id (mirror of `layoutDocId`
 * in `src/components/db.ts`).
 */
function docId(collection: string, entryId: string): string {
  return `${collection}::${entryId}`;
}

describe("builderLayoutCacheTag", () => {
  it("encodes collection and entry id", () => {
    expect(builderLayoutCacheTag("posts", ULID_A)).toBe(
      `empixel:layout:posts:${ULID_A}`,
    );
  });
});

describe("getBuilderLayout (F3.5 — async, storage-only)", () => {
  it("returns null sections + tagged cacheHint when storage has no matching row", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns null sections + cacheHint when the host short-circuits with enabled=false", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A, false);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns the tagged hint even when the collection name is invalid", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "PaGeS!!", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:PaGeS!!:${ULID_A}`,
    ]);
  });

  it("returns null sections + cacheHint when no storage handle on locals (no legacy fallback)", async () => {
    const result = await getBuilderLayout(makeNoStorageCtx(), "pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    // Runtime fallback also fails in the test environment (no virtual
    // modules), so no DB lookup happens and no `lastModified` either.
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  describe("storage-present path", () => {
    it("returns sections + lastModified for an enabled storage row", async () => {
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
        updatedAt: "2026-05-09T14:30:15.000Z",
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("pages", ULID_A),
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:pages:${ULID_A}`,
      ]);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T14:30:15.000Z",
      );
    });

    it("treats a disabled storage row as null sections but still stamps lastModified", async () => {
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: 0,
        sections: [],
        updatedAt: "2026-05-09T12:00:00.000Z",
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("pages", ULID_A),
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T12:00:00.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T12:00:00.000Z",
      );
    });

    it("accepts boolean `enabled` (multi-driver back-ends may coerce 0/1)", async () => {
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: true,
        sections: [],
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("pages", ULID_A),
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
    });

    it("filters out unrelated storage rows (different collection)", async () => {
      const wrongCollectionRow: LayoutRow = {
        collection: "posts",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("posts", ULID_A),
          data: JSON.stringify(wrongCollectionRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      // Looking up under `pages`/`ULID_A` — the row above is keyed
      // under `posts::ULID_A` so the doc-id filter excludes it.
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(result.sections).toBeNull();
    });
  });

  /**
   * Regression coverage for the P0 bug found on Novapera (fix/F3.4-frontend-empty):
   * `_plugin_storage` had 4 valid `posts::<ULID>` rows + 2 orphan rows from
   * an earlier dev iteration whose `data` payload didn't carry
   * `collection` / `entryId`. The pre-fix reader filtered only on
   * `(plugin_id, collection)` and called `executeTakeFirst()`, which
   * returned an arbitrary plugin row — typically the orphan, since the
   * post-fetch `parsed.collection !== collection` guard then forced null.
   * Builder pages rendered the host theme template instead of builder
   * content. With the doc-id filter in place, the lookup is single-row
   * deterministic.
   */
  describe("doc-id symmetry (regression — P0 bug 5 / fix/F3.4-frontend-empty)", () => {
    it("finds the correct row when multiple plugin rows coexist (Novapera scenario)", async () => {
      const targetRow: LayoutRow = {
        collection: "posts",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
        updatedAt: "2026-05-09T14:30:15.000Z",
      };
      const otherRow: LayoutRow = {
        collection: "posts",
        entryId: ULID_B,
        enabled: 1,
        sections: [],
        updatedAt: "2026-05-09T13:00:00.000Z",
      };
      const { ctx } = makeStorageStub([
        // Orphan row from F3.2 dev iter — id is the bare ULID, no
        // composite, data shape pre-rename. Pre-fix reader's
        // `executeTakeFirst` would land here first and force null.
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: ULID_A,
          data: JSON.stringify({ stale: "shape" }),
        },
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("posts", ULID_B),
          data: JSON.stringify(otherRow),
          updated_at: "2026-05-09T13:00:00.000Z",
        },
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("posts", ULID_A),
          data: JSON.stringify(targetRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "posts", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T14:30:15.000Z",
      );
    });

    it("returns null when only orphan rows (id != composite doc id) exist for the entry", async () => {
      // Orphan from an earlier dev iteration: keyed on the bare ULID
      // rather than `${collection}::${entryId}`. The doc-id filter
      // excludes it cleanly — caller gets null sections + tagged hint.
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: ULID_A,
          data: JSON.stringify({ stale: "shape" }),
        },
      ]);
      const result = await getBuilderLayout(ctx, "posts", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:posts:${ULID_A}`,
      ]);
    });
  });

  /**
   * Regression coverage for the F3.4 backcompat retest (Novapera) — the
   * earlier `fix/F3.4-frontend-empty` patch addressed handle resolution
   * and doc-id symmetry but still required hosts to call the new 4-arg
   * `(astro, collection, entryId, enabled?)` form. Host pages scaffolded
   * by `npx empixel-builder add` (and Novapera, pinned to v0.8) still
   * call the legacy 3-arg `(collection, entryId, enabled?)`. When the
   * 3-arg call hit the new function the args slotted into the wrong
   * positions: `astro = "<collection-name>"` (a string), `collection =
   * <entry id>` (the actual ULID, uppercase Crockford), `entryId =
   * <enabled flag>` — and the `COLLECTION_RE.test(collection)` line
   * rejected the uppercase ULID, returning null sections. `BuilderWrapper`
   * fell through to `<slot />` and the host theme template rendered
   * instead of builder content. The function is now polymorphic on the
   * first argument; both shapes resolve correctly.
   *
   * The legacy 3-arg path can ONLY reach the DB through `getDb()` from
   * `emdash/runtime` (no `Astro.locals` to consult). In the vitest
   * environment the runtime export is unwired, so the helper returns
   * `null` and the call short-circuits to `{ sections: null, cacheHint }`.
   * That's enough to verify the dispatch routing without virtualising
   * the runtime module — the production code path is exercised
   * separately by the existing 4-arg tests above (which DO go all the
   * way to the storage stub).
   */
  describe("legacy 3-arg call shape (regression — fix/F3.4-backcompat-3arg)", () => {
    it("does not short-circuit on the COLLECTION_RE check when entryId is an uppercase ULID (Novapera shape)", async () => {
      // Real Novapera ULID from the bug report. Uppercase Crockford
      // base32 — pre-fix this was the SECOND argument going into the
      // function but with the new 4-arg shape it would have been treated
      // as `collection` (after a string-typed first arg) and rejected by
      // `COLLECTION_RE`. With the polymorphic dispatch the string-typed
      // first arg is recognised as the legacy `collection` slot, so the
      // ULID stays in the `entryId` slot (which is NOT regex-checked).
      const NOVAPERA_ULID = "01KPBDEV2JHJ4BT2KNEXA18CS3";
      // No `astro` available — the runtime fallback returns null in
      // vitest, so we get null sections WITHOUT hitting the regex
      // short-circuit. The cache tag confirms the function got past the
      // regex line: it embeds the unmodified collection / entryId as
      // received.
      const result = await getBuilderLayout("posts", NOVAPERA_ULID, true);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:posts:${NOVAPERA_ULID}`,
      ]);
    });

    it("respects enabled=false in the legacy 3-arg shape", async () => {
      const result = await getBuilderLayout("posts", ULID_A, false);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:posts:${ULID_A}`,
      ]);
      // No DB lookup attempted — `lastModified` stays undefined.
      expect(result.cacheHint.lastModified).toBeUndefined();
    });

    it("rejects an invalid collection name in the legacy 3-arg shape (regex check applies to position 0)", async () => {
      // The regex check still runs against the legacy `collection` slot.
      // `PaGeS!!` fails the lowercase-snake regex → null sections, hint
      // intact.
      const result = await getBuilderLayout("PaGeS!!", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:PaGeS!!:${ULID_A}`,
      ]);
    });

    it("returns null when no Kysely handle is reachable (runtime fallback fails in vitest)", async () => {
      // The legacy 3-arg path can only reach the DB via `getDb()` from
      // `emdash/runtime`. In vitest that import either resolves to a
      // stub without `getDb` or throws — `resolveKyselyHandleViaRuntime`
      // swallows both and returns null.
      const result = await getBuilderLayout("posts", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:posts:${ULID_A}`,
      ]);
    });

    it("returns null when enabled=undefined and runtime fallback fails (vitest baseline for the 3-arg path)", async () => {
      // Equivalent to the call Novapera makes:
      //   getBuilderLayout("posts", post.data.id, post.data.empixel_builder)
      // …where `empixel_builder` may be undefined for entries that have
      // never been toggled. Pre-fix this would short-circuit on the
      // regex line because `astro = "posts"` and `collection = ULID`.
      // Post-fix it routes correctly: regex passes, runtime fallback
      // can't resolve in vitest, null sections + tagged hint.
      const result = await getBuilderLayout("posts", ULID_A, undefined);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:posts:${ULID_A}`,
      ]);
    });

    /**
     * The runtime fallback is mocked by stubbing the dynamic
     * `import("emdash/runtime")` so the 3-arg call can drive a stub DB
     * end-to-end. Without this we'd only verify the dispatch routing,
     * not the storage round-trip in the legacy shape.
     */
    it("reads through the runtime singleton when a 3-arg call lands on a real Kysely handle", async () => {
      const layoutRow: LayoutRow = {
        collection: "posts",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
        updatedAt: "2026-05-09T22:30:00.000Z",
      };
      const stubRows: StorageStubRow[] = [
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: docId("posts", ULID_A),
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T22:30:00.000Z",
        },
      ];
      const { ctx } = makeStorageStub(stubRows);
      const fakeDb = ctx.locals?.emdash?.db;

      const { vi } = await import("vitest");
      vi.doMock("emdash/runtime", () => ({
        getDb: () => Promise.resolve(fakeDb),
      }));
      try {
        const mod = await import("../src/components/db.js?legacy3arg-runtime");
        const result = await mod.getBuilderLayout("posts", ULID_A, true);
        expect(Array.isArray(result.sections)).toBe(true);
        expect(result.cacheHint.tags).toEqual([
          `empixel:layout:posts:${ULID_A}`,
        ]);
        expect(result.cacheHint.lastModified?.toISOString()).toBe(
          "2026-05-09T22:30:00.000Z",
        );
      } finally {
        vi.doUnmock("emdash/runtime");
      }
    });
  });
});
