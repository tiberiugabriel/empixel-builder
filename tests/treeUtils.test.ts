import { describe, it, expect } from "vitest";
import type { SectionBlock } from "../src/types.js";
import {
  findPath,
  findBlockById,
  removeFromTree,
  updateBlockInTree,
  insertAtPath,
  reorderInContainer,
  addToContainer,
  isDescendant,
  deepCloneBlock,
} from "../src/admin/treeUtils.js";

// Minimal fixture builder — keeps tests readable without polluting the
// production type model with explicit constructors.
function leaf(id: string, type = "text"): SectionBlock {
  return { id, type: type as SectionBlock["type"], config: {} };
}
function container(id: string, children: SectionBlock[] = [], slots?: SectionBlock[][]): SectionBlock {
  return { id, type: "container", config: {}, children, slots };
}

describe("findPath", () => {
  const tree: SectionBlock[] = [
    container("c1", [leaf("a"), leaf("b")]),
    container("c2", [], [[leaf("s0a"), leaf("s0b")], [leaf("s1a")]]),
  ];

  it("returns top-level path for root blocks", () => {
    expect(findPath("c1", tree)).toEqual({ level: "top", index: 0 });
    expect(findPath("c2", tree)).toEqual({ level: "top", index: 1 });
  });

  it("returns container path for children", () => {
    expect(findPath("a", tree)).toEqual({ level: "container", containerId: "c1", slotIndex: null, index: 0 });
    expect(findPath("b", tree)).toEqual({ level: "container", containerId: "c1", slotIndex: null, index: 1 });
  });

  it("returns container path with slotIndex for slotted children", () => {
    expect(findPath("s0a", tree)).toEqual({ level: "container", containerId: "c2", slotIndex: 0, index: 0 });
    expect(findPath("s1a", tree)).toEqual({ level: "container", containerId: "c2", slotIndex: 1, index: 0 });
  });

  it("returns null for missing id", () => {
    expect(findPath("ghost", tree)).toBeNull();
  });
});

describe("findBlockById", () => {
  const tree: SectionBlock[] = [container("c1", [leaf("a"), container("c2", [leaf("nested")])])];

  it("finds top-level + nested blocks", () => {
    expect(findBlockById("c1", tree)?.id).toBe("c1");
    expect(findBlockById("a", tree)?.id).toBe("a");
    expect(findBlockById("c2", tree)?.id).toBe("c2");
    expect(findBlockById("nested", tree)?.id).toBe("nested");
  });

  it("returns null for missing", () => {
    expect(findBlockById("ghost", tree)).toBeNull();
  });
});

describe("removeFromTree", () => {
  it("removes a top-level block immutably", () => {
    const tree: SectionBlock[] = [leaf("a"), leaf("b")];
    const next = removeFromTree("a", tree);
    expect(next.map((n) => n.id)).toEqual(["b"]);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("removes a nested child", () => {
    const tree: SectionBlock[] = [container("c1", [leaf("a"), leaf("b")])];
    const next = removeFromTree("a", tree);
    expect(next[0].children?.map((n) => n.id)).toEqual(["b"]);
  });

  it("removes from a slot", () => {
    const tree: SectionBlock[] = [container("c1", [], [[leaf("s0a"), leaf("s0b")]])];
    const next = removeFromTree("s0a", tree);
    expect(next[0].slots?.[0].map((n) => n.id)).toEqual(["s0b"]);
  });
});

describe("updateBlockInTree", () => {
  it("merges config patch into target block", () => {
    const tree: SectionBlock[] = [
      { id: "a", type: "text", config: { content: "hi", theme: "light" } },
    ];
    const next = updateBlockInTree("a", { content: "bye" }, tree);
    expect(next[0].config).toEqual({ content: "bye", theme: "light" });
  });

  it("does not mutate the original tree", () => {
    const tree: SectionBlock[] = [{ id: "a", type: "text", config: { content: "hi" } }];
    updateBlockInTree("a", { content: "bye" }, tree);
    expect(tree[0].config.content).toBe("hi");
  });

  it("recurses into containers", () => {
    const tree: SectionBlock[] = [container("c1", [{ id: "a", type: "text", config: {} }])];
    const next = updateBlockInTree("a", { content: "x" }, tree);
    expect(next[0].children?.[0].config).toEqual({ content: "x" });
  });
});

describe("insertAtPath", () => {
  it("inserts at top-level index", () => {
    const tree: SectionBlock[] = [leaf("a"), leaf("c")];
    const next = insertAtPath(leaf("b"), { level: "top", index: 1 }, tree);
    expect(next.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("inserts into container.children at given index", () => {
    const tree: SectionBlock[] = [container("c1", [leaf("a"), leaf("c")])];
    const next = insertAtPath(leaf("b"), { level: "container", containerId: "c1", slotIndex: null, index: 1 }, tree);
    expect(next[0].children?.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("inserts into a specific slot", () => {
    const tree: SectionBlock[] = [container("c1", [], [[leaf("s0a")], [leaf("s1a")]])];
    const next = insertAtPath(leaf("s1b"), { level: "container", containerId: "c1", slotIndex: 1, index: 1 }, tree);
    expect(next[0].slots?.[1].map((n) => n.id)).toEqual(["s1a", "s1b"]);
  });
});

describe("reorderInContainer", () => {
  it("replaces children order", () => {
    const tree: SectionBlock[] = [container("c1", [leaf("a"), leaf("b"), leaf("c")])];
    const next = reorderInContainer("c1", null, [leaf("c"), leaf("a"), leaf("b")], tree);
    expect(next[0].children?.map((n) => n.id)).toEqual(["c", "a", "b"]);
  });

  it("replaces slot order", () => {
    const tree: SectionBlock[] = [container("c1", [], [[leaf("s0a"), leaf("s0b")]])];
    const next = reorderInContainer("c1", 0, [leaf("s0b"), leaf("s0a")], tree);
    expect(next[0].slots?.[0].map((n) => n.id)).toEqual(["s0b", "s0a"]);
  });
});

describe("addToContainer", () => {
  it("appends to children", () => {
    const tree: SectionBlock[] = [container("c1", [leaf("a")])];
    const next = addToContainer("c1", null, leaf("b"), tree);
    expect(next[0].children?.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("appends to a slot", () => {
    const tree: SectionBlock[] = [container("c1", [], [[leaf("s0a")]])];
    const next = addToContainer("c1", 0, leaf("s0b"), tree);
    expect(next[0].slots?.[0].map((n) => n.id)).toEqual(["s0a", "s0b"]);
  });
});

describe("isDescendant", () => {
  const tree: SectionBlock[] = [container("c1", [container("c2", [leaf("deep")])])];

  it("true when target sits under ancestor", () => {
    expect(isDescendant("c1", "deep", tree)).toBe(true);
    expect(isDescendant("c1", "c2", tree)).toBe(true);
    expect(isDescendant("c2", "deep", tree)).toBe(true);
  });

  it("false when target is unrelated", () => {
    expect(isDescendant("c2", "c1", tree)).toBe(false);
    expect(isDescendant("ghost", "deep", tree)).toBe(false);
  });
});

describe("deepCloneBlock", () => {
  it("clones with fresh ids at every level", () => {
    const orig = container("c1", [leaf("a")], [[leaf("s0a")]]);
    const clone = deepCloneBlock(orig);
    expect(clone.id).not.toBe("c1");
    expect(clone.children?.[0].id).not.toBe("a");
    expect(clone.slots?.[0][0].id).not.toBe("s0a");
  });

  it("deep-clones the config object (not a reference share)", () => {
    const orig: SectionBlock = {
      id: "x",
      type: "text",
      config: { content: "hi", style: { paddingTop: "8px" } },
    };
    const clone = deepCloneBlock(orig);
    expect(clone.type).toBe("text");
    expect(clone.config).toEqual({ content: "hi", style: { paddingTop: "8px" } });
    // structuredClone — different object reference at every level.
    expect(clone.config).not.toBe(orig.config);
    expect(clone.config.style).not.toBe(orig.config.style);
    // Mutating the clone must not affect the original.
    (clone.config as Record<string, unknown>).content = "bye";
    expect(orig.config.content).toBe("hi");
  });
});
