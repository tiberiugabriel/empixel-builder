import { describe, it, expect } from "vitest";
import type { SectionBlock } from "../src/types.js";
import {
  isKnownBlockType,
  stripUnknownBlocks,
  BLOCK_TYPES,
} from "../src/types.js";

// Cast helper — variant B fixtures intentionally include block types that
// were removed from the BlockType union, so the test data has to escape
// the static type system.
function any(b: unknown): SectionBlock {
  return b as SectionBlock;
}

describe("BLOCK_TYPES", () => {
  it("contains exactly the 9 currently-supported block types", () => {
    expect(BLOCK_TYPES.size).toBe(9);
    expect(BLOCK_TYPES.has("container")).toBe(true);
    expect(BLOCK_TYPES.has("text")).toBe(true);
    expect(BLOCK_TYPES.has("image")).toBe(true);
    expect(BLOCK_TYPES.has("text-editor")).toBe(true);
    expect(BLOCK_TYPES.has("video")).toBe(true);
    expect(BLOCK_TYPES.has("button")).toBe(true);
    expect(BLOCK_TYPES.has("icon")).toBe(true);
    expect(BLOCK_TYPES.has("html")).toBe(true);
    expect(BLOCK_TYPES.has("divider-spacer")).toBe(true);
  });

  it("does not contain removed legacy block types", () => {
    expect(BLOCK_TYPES.has("testimonials")).toBe(false);
    expect(BLOCK_TYPES.has("faq")).toBe(false);
    expect(BLOCK_TYPES.has("pricing")).toBe(false);
    expect(BLOCK_TYPES.has("spacer")).toBe(false);
  });
});

describe("isKnownBlockType", () => {
  it("returns true for current types and false for removed ones", () => {
    expect(isKnownBlockType("text")).toBe(true);
    expect(isKnownBlockType("testimonials")).toBe(false);
    expect(isKnownBlockType("faq")).toBe(false);
    expect(isKnownBlockType("pricing")).toBe(false);
    expect(isKnownBlockType("ghost")).toBe(false);
  });
});

describe("stripUnknownBlocks", () => {
  it("drops top-level orphan nodes", () => {
    const tree = [
      any({ id: "a", type: "text", config: {} }),
      any({ id: "b", type: "testimonials", config: {} }),
      any({ id: "c", type: "image", config: {} }),
    ];
    const out = stripUnknownBlocks(tree);
    expect(out.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("drops orphan nodes nested inside container.children", () => {
    const tree = [
      any({
        id: "c1",
        type: "container",
        config: {},
        children: [
          any({ id: "a", type: "text", config: {} }),
          any({ id: "b", type: "faq", config: {} }),
          any({ id: "c", type: "button", config: {} }),
        ],
      }),
    ];
    const out = stripUnknownBlocks(tree);
    expect(out[0].children?.map((n) => n.id)).toEqual(["a", "c"]);
  });

  it("drops orphan nodes nested inside slots", () => {
    const tree = [
      any({
        id: "c1",
        type: "container",
        config: {},
        slots: [
          [any({ id: "s0a", type: "pricing", config: {} }), any({ id: "s0b", type: "text", config: {} })],
          [any({ id: "s1a", type: "icon", config: {} })],
        ],
      }),
    ];
    const out = stripUnknownBlocks(tree);
    expect(out[0].slots?.[0].map((n) => n.id)).toEqual(["s0b"]);
    expect(out[0].slots?.[1].map((n) => n.id)).toEqual(["s1a"]);
  });

  it("is idempotent", () => {
    const tree = [
      any({ id: "a", type: "text", config: {} }),
      any({ id: "b", type: "testimonials", config: {} }),
    ];
    const once = stripUnknownBlocks(tree);
    const twice = stripUnknownBlocks(once);
    expect(twice).toEqual(once);
  });

  it("does not mutate input", () => {
    const tree = [
      any({ id: "a", type: "text", config: {} }),
      any({ id: "b", type: "testimonials", config: {} }),
    ];
    const snapshot = JSON.stringify(tree);
    stripUnknownBlocks(tree);
    expect(JSON.stringify(tree)).toBe(snapshot);
  });
});
