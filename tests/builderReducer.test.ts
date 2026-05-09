import { describe, it, expect } from "vitest";
import type { SectionBlock } from "../src/types.js";
import {
  reducer,
  initialState,
  historyReducer,
  initialHistoryState,
  type State,
  type HistoryState,
} from "../src/admin/builder/builderReducer.js";

function leaf(id: string, type = "text"): SectionBlock {
  return { id, type: type as SectionBlock["type"], config: {} };
}
function container(id: string, children: SectionBlock[] = []): SectionBlock {
  return { id, type: "container", config: {}, children };
}

function withSections(s: SectionBlock[], over: Partial<State> = {}): State {
  return { ...initialState, isLoading: false, sections: s, ...over };
}

describe("LOAD_*", () => {
  it("LOAD_START sets isLoading true and clears error", () => {
    const next = reducer({ ...initialState, error: "old" }, { type: "LOAD_START" });
    expect(next.isLoading).toBe(true);
    expect(next.error).toBeNull();
  });

  it("LOAD_SUCCESS replaces sections and clears dirty", () => {
    const next = reducer(initialState, { type: "LOAD_SUCCESS", sections: [leaf("a")] });
    expect(next.isLoading).toBe(false);
    expect(next.sections.map((b) => b.id)).toEqual(["a"]);
    expect(next.isDirty).toBe(false);
  });

  it("LOAD_ERROR stores error and stops loading", () => {
    const next = reducer(initialState, { type: "LOAD_ERROR", error: "boom" });
    expect(next.error).toBe("boom");
    expect(next.isLoading).toBe(false);
  });
});

describe("ADD_BLOCK", () => {
  it("appends to top-level, selects the new block, marks dirty", () => {
    const next = reducer(withSections([leaf("a")]), { type: "ADD_BLOCK", block: leaf("b") });
    expect(next.sections.map((b) => b.id)).toEqual(["a", "b"]);
    expect(next.selectedId).toBe("b");
    expect(next.isDirty).toBe(true);
  });
});

// ─── F3.6.2 — ADD_BLOCK fills defaults; LOAD_SUCCESS backfills ──────────────

describe("F3.6.2 — full-shape config fill", () => {
  // STYLE_PROPS keys mirror the F3.6.1 contract — replicated locally so
  // this test file doesn't reach into blockDefinitions for the array.
  const STYLE_PROPS_SNAPSHOT = [
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop",  "marginRight",  "marginBottom",  "marginLeft",
    "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight",
    "borderTopLeftRadius", "borderTopRightRadius",
    "borderBottomRightRadius", "borderBottomLeftRadius",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "overflowX", "overflowY",
    "textAlign",
    "fontFamily", "fontSize", "fontWeight",
    "textTransform", "fontStyle", "textDecoration",
    "lineHeight", "letterSpacing", "wordSpacing",
    "mixBlendMode",
    "aspectRatio",
    "filter",
  ] as const;

  const TYPES = [
    "text",
    "image",
    "text-editor",
    "video",
    "button",
    "icon",
    "html",
    "divider-spacer",
    "container",
  ] as const;

  it("ADD_BLOCK fills STYLE_PROPS keys for each of the 9 block types", () => {
    for (const type of TYPES) {
      const block: SectionBlock = { id: `b-${type}`, type, config: {} };
      const next = reducer(withSections([]), { type: "ADD_BLOCK", block });
      expect(next.sections).toHaveLength(1);
      const placed = next.sections[0];
      const style = (placed.config.style ?? {}) as Record<string, unknown>;
      for (const key of STYLE_PROPS_SNAPSHOT) {
        expect(
          style,
          `block "${type}" placed via ADD_BLOCK missing STYLE_PROPS key "${key}"`,
        ).toHaveProperty(key);
      }
      // Top-level shape — every block now carries the full structure.
      expect(placed.config).toHaveProperty("styleHover");
      expect(placed.config).toHaveProperty("styleDark");
      expect(placed.config).toHaveProperty("styleBreakpoints");
      expect(placed.config).toHaveProperty("styleHoverBreakpoints");
      expect(placed.config).toHaveProperty("advanced");
      expect(placed.config).toHaveProperty("theme", "light");
    }
  });

  it("ADD_BLOCK preserves caller-supplied config values (action wins on overlap)", () => {
    const block: SectionBlock = {
      id: "t1",
      type: "text",
      config: { content: "hello", style: { fontSize: "20px" } },
    };
    const next = reducer(withSections([]), { type: "ADD_BLOCK", block });
    const placed = next.sections[0];
    // Action's explicit values survive
    expect(placed.config.content).toBe("hello");
    expect((placed.config.style as Record<string, string>).fontSize).toBe("20px");
    // Defaults backfill the unset STYLE_PROPS keys
    expect((placed.config.style as Record<string, string>).paddingTop).toBe("");
    // Top-level keys backfilled from defaults
    expect(placed.config).toHaveProperty("styleHover");
    expect(placed.config).toHaveProperty("advanced");
  });

  it("ADD_BLOCK preserves pre-existing design defaults (container padding)", () => {
    const block: SectionBlock = { id: "c1", type: "container", config: {} };
    const next = reducer(withSections([]), { type: "ADD_BLOCK", block });
    const placed = next.sections[0];
    const style = placed.config.style as Record<string, string>;
    expect(style.paddingTop).toBe("12px");
    expect(style.paddingRight).toBe("12px");
    expect(style.paddingBottom).toBe("12px");
    expect(style.paddingLeft).toBe("12px");
    expect(style.fontSize).toBe(""); // backfilled empty
  });

  it("LOAD_SUCCESS backfills missing keys on a sparse layout (root level)", () => {
    const sparse: SectionBlock = {
      id: "t1",
      type: "text",
      config: { content: "x" },
    };
    const next = reducer(initialState, { type: "LOAD_SUCCESS", sections: [sparse] });
    const filled = next.sections[0];
    // Sparse value preserved
    expect(filled.config.content).toBe("x");
    // Backfilled top-level shape
    expect(filled.config).toHaveProperty("style");
    expect(filled.config).toHaveProperty("advanced");
    // Backfilled STYLE_PROPS
    const style = filled.config.style as Record<string, unknown>;
    for (const key of STYLE_PROPS_SNAPSHOT) {
      expect(style).toHaveProperty(key);
    }
  });

  it("LOAD_SUCCESS recurses into children + slots", () => {
    const sparseLeaf: SectionBlock = {
      id: "leaf",
      type: "text",
      config: { content: "child" },
    };
    const sparseSlotLeaf: SectionBlock = {
      id: "slot-leaf",
      type: "image",
      config: {},
    };
    const sparseContainer: SectionBlock = {
      id: "c1",
      type: "container",
      config: {},
      children: [sparseLeaf],
      slots: [[sparseSlotLeaf]],
    };
    const next = reducer(initialState, {
      type: "LOAD_SUCCESS",
      sections: [sparseContainer],
    });
    const c = next.sections[0];
    expect(c.config).toHaveProperty("style");
    // Child filled
    const child = c.children![0];
    expect(child.config).toHaveProperty("style");
    expect(child.config).toHaveProperty("advanced");
    expect(child.config.content).toBe("child"); // preserved
    // Slot leaf filled
    const slotLeaf = c.slots![0][0];
    expect(slotLeaf.config).toHaveProperty("style");
    expect(slotLeaf.config).toHaveProperty("advanced");
  });

  it("LOAD_SUCCESS preserves existing nested values (sparse style.fontSize survives)", () => {
    const sparse: SectionBlock = {
      id: "t1",
      type: "text",
      config: { style: { fontSize: "18px" } },
    };
    const next = reducer(initialState, { type: "LOAD_SUCCESS", sections: [sparse] });
    const filled = next.sections[0];
    const style = filled.config.style as Record<string, string>;
    expect(style.fontSize).toBe("18px"); // preserved
    expect(style.paddingTop).toBe(""); // backfilled
    expect(style.borderTopWidth).toBe(""); // backfilled
  });

  it("LOAD_SUCCESS preserves container's pre-existing design defaults when sparse", () => {
    // A legacy container saved with no `style` at all should still
    // carry the design defaults (paddingTop="12px") after backfill.
    const legacyContainer: SectionBlock = {
      id: "c1",
      type: "container",
      config: {},
    };
    const next = reducer(initialState, {
      type: "LOAD_SUCCESS",
      sections: [legacyContainer],
    });
    const filled = next.sections[0];
    const style = filled.config.style as Record<string, string>;
    expect(style.paddingTop).toBe("12px");
    expect(style.fontSize).toBe(""); // STYLE_PROPS empty key
  });

  it("ADD_TO_CONTAINER + INSERT_AFTER also fill defaults (consistent with ADD_BLOCK)", () => {
    // Pre-fill state with a container so ADD_TO_CONTAINER has somewhere
    // to land. The container's existing config also needs to be a
    // BlockDef shape; we use plain `container("c1")` because the test
    // uses unmodified `state.sections` (no state.sections fill).
    const start = withSections([container("c1")]);
    const sparse: SectionBlock = { id: "x", type: "text", config: { content: "x" } };
    const a = reducer(start, { type: "ADD_TO_CONTAINER", containerId: "c1", block: sparse });
    const placed = a.sections[0].children![0];
    expect(placed.config).toHaveProperty("style");
    expect(placed.config.content).toBe("x");

    // INSERT_AFTER on the just-placed leaf
    const sparse2: SectionBlock = { id: "y", type: "image", config: {} };
    const b = reducer(a, { type: "INSERT_AFTER", afterId: placed.id, block: sparse2 });
    const inserted = b.sections[0].children![1];
    expect(inserted.config).toHaveProperty("style");
    expect(inserted.config).toHaveProperty("advanced");
  });
});

describe("UPDATE_BLOCK", () => {
  it("merges config patch and marks dirty", () => {
    const start = withSections([{ id: "a", type: "text", config: { content: "hi" } }]);
    const next = reducer(start, { type: "UPDATE_BLOCK", id: "a", config: { content: "bye" } });
    expect(next.sections[0].config).toEqual({ content: "bye" });
    expect(next.isDirty).toBe(true);
  });
});

describe("REMOVE_BLOCK", () => {
  it("removes block, clears selectedId if it pointed there", () => {
    const start = withSections([leaf("a"), leaf("b")], { selectedId: "a" });
    const next = reducer(start, { type: "REMOVE_BLOCK", id: "a" });
    expect(next.sections.map((b) => b.id)).toEqual(["b"]);
    expect(next.selectedId).toBeNull();
    expect(next.isDirty).toBe(true);
  });

  it("preserves selectedId when removing a different block", () => {
    const start = withSections([leaf("a"), leaf("b")], { selectedId: "a" });
    const next = reducer(start, { type: "REMOVE_BLOCK", id: "b" });
    expect(next.selectedId).toBe("a");
  });
});

describe("REORDER + REORDER_IN_CONTAINER", () => {
  it("REORDER replaces top-level array verbatim", () => {
    const a = leaf("a"), b = leaf("b");
    const next = reducer(withSections([a, b]), { type: "REORDER", sections: [b, a] });
    expect(next.sections.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("REORDER_IN_CONTAINER replaces children of the named container", () => {
    const start = withSections([container("c1", [leaf("a"), leaf("b"), leaf("c")])]);
    const next = reducer(start, {
      type: "REORDER_IN_CONTAINER",
      containerId: "c1",
      slotIndex: null,
      newOrder: [leaf("c"), leaf("a"), leaf("b")],
    });
    expect(next.sections[0].children?.map((b) => b.id)).toEqual(["c", "a", "b"]);
  });
});

describe("SELECT", () => {
  it("sets selectedId without flipping isDirty", () => {
    const start = withSections([leaf("a")]);
    const next = reducer(start, { type: "SELECT", id: "a" });
    expect(next.selectedId).toBe("a");
    expect(next.isDirty).toBe(false);
  });
});

describe("SAVE_*", () => {
  it("SAVE_START flips isSaving on, SAVE_SUCCESS clears dirty", () => {
    const start = withSections([leaf("a")], { isDirty: true });
    const a = reducer(start, { type: "SAVE_START" });
    expect(a.isSaving).toBe(true);
    const b = reducer(a, { type: "SAVE_SUCCESS" });
    expect(b.isSaving).toBe(false);
    expect(b.isDirty).toBe(false);
  });

  it("SAVE_ERROR stores message and stops saving", () => {
    const next = reducer({ ...initialState, isSaving: true }, { type: "SAVE_ERROR", error: "nope" });
    expect(next.saveError).toBe("nope");
    expect(next.isSaving).toBe(false);
  });
});

describe("ADD_TO_CONTAINER", () => {
  it("appends to container.children and selects + marks dirty", () => {
    const start = withSections([container("c1", [leaf("a")])]);
    const next = reducer(start, {
      type: "ADD_TO_CONTAINER",
      containerId: "c1",
      block: leaf("b"),
    });
    expect(next.sections[0].children?.map((b) => b.id)).toEqual(["a", "b"]);
    expect(next.selectedId).toBe("b");
    expect(next.isDirty).toBe(true);
  });
});

describe("MOVE_BLOCK", () => {
  it("moves a top-level block into a container", () => {
    const start = withSections([leaf("a"), container("c1")]);
    const next = reducer(start, {
      type: "MOVE_BLOCK",
      sourceId: "a",
      targetContainerId: "c1",
      targetSlotIndex: null,
      targetIndex: 0,
    });
    expect(next.sections.map((s) => s.id)).toEqual(["c1"]);
    expect(next.sections[0].children?.map((s) => s.id)).toEqual(["a"]);
  });

  it("returns state unchanged when sourceId is missing", () => {
    const start = withSections([leaf("a")]);
    const next = reducer(start, {
      type: "MOVE_BLOCK",
      sourceId: "ghost",
      targetContainerId: null,
      targetSlotIndex: null,
      targetIndex: 0,
    });
    expect(next).toBe(start);
  });
});

describe("INSERT_AFTER", () => {
  it("inserts after a top-level block and selects the new block", () => {
    const start = withSections([leaf("a"), leaf("c")]);
    const next = reducer(start, { type: "INSERT_AFTER", afterId: "a", block: leaf("b") });
    expect(next.sections.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(next.selectedId).toBe("b");
  });

  it("falls back to top-level append when afterId is unknown", () => {
    const start = withSections([leaf("a")]);
    const next = reducer(start, { type: "INSERT_AFTER", afterId: "ghost", block: leaf("b") });
    expect(next.sections.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("DUPLICATE_BLOCK", () => {
  it("inserts a clone with a fresh id right after the original", () => {
    const start = withSections([leaf("a"), leaf("c")]);
    const next = reducer(start, { type: "DUPLICATE_BLOCK", id: "a" });
    expect(next.sections.length).toBe(3);
    expect(next.sections[0].id).toBe("a");
    expect(next.sections[1].id).not.toBe("a");
    expect(next.sections[2].id).toBe("c");
    expect(next.selectedId).toBe(next.sections[1].id);
  });
});

describe("PASTE_SETTINGS", () => {
  it("merges config without changing block id or children", () => {
    const start = withSections([{ id: "a", type: "text", config: { content: "hi" } }]);
    const next = reducer(start, { type: "PASTE_SETTINGS", id: "a", config: { content: "patched" } });
    expect(next.sections[0].config).toEqual({ content: "patched" });
  });
});

// ─── History meta-reducer (undo / redo) ──────────────────────────────────────

function freshHistory(over: Partial<State> = {}): HistoryState {
  return { past: [], present: { ...initialState, isLoading: false, ...over }, future: [] };
}

describe("historyReducer — basic flow", () => {
  it("LOAD_SUCCESS clears past and future", () => {
    const dirty: HistoryState = {
      past: [[leaf("a")], [leaf("a"), leaf("b")]],
      present: { ...initialState, isLoading: false, sections: [leaf("c")] },
      future: [[leaf("d")]],
    };
    const next = historyReducer(dirty, { type: "LOAD_SUCCESS", sections: [leaf("x")] });
    expect(next.past).toEqual([]);
    expect(next.future).toEqual([]);
    expect(next.present.sections.map((b) => b.id)).toEqual(["x"]);
  });

  it("snapshots past on every mutating action; clears future", () => {
    let h = freshHistory();
    h = { ...h, future: [[leaf("future")]] };
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("a") });
    expect(h.past.length).toBe(1);
    expect(h.future).toEqual([]);
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("b") });
    expect(h.past.length).toBe(2);
    expect(h.present.sections.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("non-historic actions update present without snapshotting", () => {
    let h = freshHistory();
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("a") });
    const beforePast = h.past;
    h = historyReducer(h, { type: "SELECT", id: "a" });
    expect(h.past).toBe(beforePast);
    expect(h.present.selectedId).toBe("a");
  });
});

describe("historyReducer — UNDO", () => {
  it("returns the same state when past is empty", () => {
    const h = freshHistory();
    const next = historyReducer(h, { type: "UNDO" });
    expect(next).toBe(h);
  });

  it("rewinds to the previous sections snapshot and stacks future", () => {
    let h = freshHistory();
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("a") });   // past=[[]]
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("b") });   // past=[[],[a]]
    h = historyReducer(h, { type: "UNDO" });
    expect(h.present.sections.map((s) => s.id)).toEqual(["a"]);
    expect(h.future.length).toBe(1);
    expect(h.future[0].map((s) => s.id)).toEqual(["a", "b"]);
    h = historyReducer(h, { type: "UNDO" });
    expect(h.present.sections).toEqual([]);
    expect(h.future.length).toBe(2);
  });
});

describe("historyReducer — REDO", () => {
  it("returns the same state when future is empty", () => {
    const h = freshHistory();
    const next = historyReducer(h, { type: "REDO" });
    expect(next).toBe(h);
  });

  it("re-applies the most recent undo and refills past", () => {
    let h = freshHistory();
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("a") });
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("b") });
    h = historyReducer(h, { type: "UNDO" });
    h = historyReducer(h, { type: "REDO" });
    expect(h.present.sections.map((s) => s.id)).toEqual(["a", "b"]);
    expect(h.future.length).toBe(0);
    expect(h.past.length).toBe(2);
  });

  it("a new mutating action after UNDO clears future", () => {
    let h = freshHistory();
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("a") });
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("b") });
    h = historyReducer(h, { type: "UNDO" });
    expect(h.future.length).toBe(1);
    h = historyReducer(h, { type: "ADD_BLOCK", block: leaf("c") });
    expect(h.future.length).toBe(0);
    expect(h.present.sections.map((s) => s.id)).toEqual(["a", "c"]);
  });
});
