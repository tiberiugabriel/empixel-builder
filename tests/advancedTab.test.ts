import { describe, it, expect } from "vitest";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvancedTab } from "../src/admin/right-panel/AdvancedTab.js";
import type { BlockType, SectionBlock } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBlock(type: BlockType, extraConfig: Record<string, unknown> = {}): SectionBlock {
  return {
    id: "test-block",
    type,
    config: {
      theme: "light",
      style: {},
      ...extraConfig,
    },
  };
}

/**
 * Walk a React element tree and yield every element whose props match a
 * predicate. Avoids needing jsdom — purely synchronous tree walk.
 */
function findAll(
  node: ReactNode,
  predicate: (el: ReactElement) => boolean,
): ReactElement[] {
  const out: ReactElement[] = [];
  function visit(n: ReactNode): void {
    if (n === null || n === undefined || typeof n === "boolean") return;
    if (Array.isArray(n)) {
      for (const child of n) visit(child);
      return;
    }
    if (!isValidElement(n)) return;
    const el = n as ReactElement;
    if (predicate(el)) out.push(el);
    const props = el.props as { children?: ReactNode } | null;
    if (props?.children !== undefined) visit(props.children);
  }
  visit(node);
  return out;
}

function findByLabel(node: ReactNode, label: string): ReactElement | undefined {
  return findAll(node, (el) => {
    const p = el.props as { label?: unknown };
    return typeof p.label === "string" && p.label === label;
  })[0];
}

function findByDisplayName(node: ReactNode, name: string): ReactElement | undefined {
  return findAll(node, (el) => {
    if (typeof el.type === "string") return false;
    const t = el.type as { displayName?: string; name?: string };
    return t.displayName === name || t.name === name;
  })[0];
}

function renderTree(block: SectionBlock, onChange: (next: Record<string, unknown>) => void): ReactNode {
  return AdvancedTab({ block, onChange, activeBreakpoint: "desktop" });
}

// ─── Smoke ────────────────────────────────────────────────────────────────────

describe("AdvancedTab — smoke", () => {
  it("renders a non-empty static markup for every block type", () => {
    const types: BlockType[] = [
      "text", "image", "text-editor", "video", "button",
      "icon", "html", "divider-spacer", "container",
    ];
    for (const type of types) {
      const html = renderToStaticMarkup(
        createElement(AdvancedTab, {
          block: makeBlock(type),
          onChange: () => {},
          activeBreakpoint: "desktop",
        }),
      );
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
      // Every block must show the universal trio in the body.
      expect(html).toContain("CSS ID");
      expect(html).toContain("CSS Classes");
      expect(html).toContain("Custom CSS");
      expect(html).toContain("Z-Index");
    }
  });

  it("uses the block.id to compose the Custom-CSS selector header", () => {
    const block = makeBlock("text");
    block.id = "abc-123";
    const html = renderToStaticMarkup(
      createElement(AdvancedTab, {
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    // ` " ` is HTML-escaped as `&quot;` in the static markup output.
    expect(html).toContain("[data-epx-block=&quot;abc-123&quot;]");
  });
});

// ─── Dispatch — advanced.* fields ─────────────────────────────────────────────

describe("AdvancedTab — advanced.* dispatch", () => {
  it("typing in CSS ID dispatches onChange with `{ advanced: { cssId } }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const cssIdRow = findByLabel(tree, "CSS ID");
    expect(cssIdRow).toBeDefined();
    const onChange = (cssIdRow!.props as { onChange: (v: string) => void }).onChange;
    onChange("hero");
    expect(captured).toEqual({ advanced: { cssId: "hero" } });
  });

  it("typing in CSS Classes dispatches onChange with `{ advanced: { cssClasses } }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const row = findByLabel(tree, "CSS Classes");
    expect(row).toBeDefined();
    const onChange = (row!.props as { onChange: (v: string) => void }).onChange;
    onChange("foo bar");
    expect(captured).toEqual({ advanced: { cssClasses: "foo bar" } });
  });

  it("Custom CSS edits dispatch onChange with `{ advanced: { customCss } }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    // CodeEditor is referenced by component identity, not label.
    const codeEditor = findByDisplayName(tree, "CodeEditor");
    expect(codeEditor).toBeDefined();
    const onChange = (codeEditor!.props as { onChange: (v: string) => void }).onChange;
    onChange("color: red");
    expect(captured).toEqual({ advanced: { customCss: "color: red" } });
  });

  it("Position select dispatches onChange with `{ advanced: { position } }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const row = findByLabel(tree, "Position");
    expect(row).toBeDefined();
    const onChange = (row!.props as { onChange: (v: string) => void }).onChange;
    onChange("absolute");
    expect(captured).toEqual({ advanced: { position: "absolute" } });
  });

  it("Z-Index dispatches onChange with `{ advanced: { zIndex } }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const row = findByLabel(tree, "Z-Index");
    expect(row).toBeDefined();
    const onChange = (row!.props as { onChange: (v: number | undefined) => void }).onChange;
    onChange(5);
    expect(captured).toEqual({ advanced: { zIndex: 5 } });
  });

  it("preserves existing advanced.* keys when patching one field", () => {
    // The component reads existing `block.config.advanced` and merges
    // patches via spread — ensure unrelated keys survive the dispatch.
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text", {
      advanced: { cssId: "kept", cssClasses: "also-kept" },
    });
    const tree = renderTree(block, (next) => { captured = next; });
    const row = findByLabel(tree, "Position");
    const onChange = (row!.props as { onChange: (v: string) => void }).onChange;
    onChange("fixed");
    expect(captured).toEqual({
      advanced: { cssId: "kept", cssClasses: "also-kept", position: "fixed" },
    });
  });
});

// ─── Conditional Offset reveal ─────────────────────────────────────────────────

describe("AdvancedTab — Offset visibility follows position", () => {
  it("Offset is hidden when position is empty/default", () => {
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(AdvancedTab, {
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    // Position is always rendered, Offset only when position is set.
    expect(html).toContain("Position");
    expect(html).not.toMatch(/>Offset</);
  });

  it("Offset appears when advanced.position is set", () => {
    const block = makeBlock("text", {
      advanced: { position: "absolute" },
    });
    const html = renderToStaticMarkup(
      createElement(AdvancedTab, {
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toContain("Offset");
  });
});

// ─── Dispatch — style.* fields (Width / Height / Padding / Margin) ────────────

describe("AdvancedTab — style.* dispatch", () => {
  it("Padding dispatches onChange writing CSS keys onto `{ style: ... }`", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text", {
      style: { color: "red" }, // pre-existing key must survive
    });
    const tree = renderTree(block, (next) => { captured = next; });
    // SpacingControl is identified by its `label` prop ("Padding").
    const padding = findByLabel(tree, "Padding");
    expect(padding).toBeDefined();
    const onChange = (padding!.props as {
      onChange: (v: Record<string, { num: number; unit: string }>) => void;
    }).onChange;
    onChange({ top: { num: 12, unit: "px" } });
    // Patch must merge with the existing style object.
    const next = captured as { style?: Record<string, unknown> };
    expect(next?.style?.color).toBe("red");
    expect(next?.style?.paddingTop).toBe("12px");
  });

  it("Margin dispatches via `{ style: ... }` and uses the Margin* CSS key prefix", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const margin = findByLabel(tree, "Margin");
    expect(margin).toBeDefined();
    const onChange = (margin!.props as {
      onChange: (v: Record<string, { num: number; unit: string }>) => void;
    }).onChange;
    onChange({ left: { num: 8, unit: "rem" } });
    const next = captured as { style?: Record<string, unknown> };
    expect(next?.style?.marginLeft).toBe("8rem");
  });

  it("Width dispatches `{ style: { width } }` via DimensionControl", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const width = findByLabel(tree, "Width");
    expect(width).toBeDefined();
    const onChange = (width!.props as {
      onChange: (key: "fix" | "min" | "max", v: { num: number; unit: string }) => void;
    }).onChange;
    onChange("fix", { num: 100, unit: "%" });
    const next = captured as { style?: Record<string, unknown> };
    expect(next?.style?.width).toBe("100%");
  });

  it("Height dispatches min/max keys via DimensionControl", () => {
    let captured: Record<string, unknown> | null = null;
    const block = makeBlock("text");
    const tree = renderTree(block, (next) => { captured = next; });
    const height = findByLabel(tree, "Height");
    const onChange = (height!.props as {
      onChange: (key: "fix" | "min" | "max", v: { num: number; unit: string }) => void;
    }).onChange;
    onChange("min", { num: 10, unit: "vh" });
    const next = captured as { style?: Record<string, unknown> };
    expect(next?.style?.minHeight).toBe("10vh");
  });
});

// ─── No block-specific Advanced behavior ─────────────────────────────────────

describe("AdvancedTab — universal across block types", () => {
  it("renders the same set of controls for every block (no per-type branches)", () => {
    const types: BlockType[] = [
      "text", "image", "text-editor", "video", "button",
      "icon", "html", "divider-spacer", "container",
    ];
    const labelSets = types.map((type) => {
      const tree = renderTree(makeBlock(type), () => {});
      return findAll(tree, (el) => {
        const p = el.props as { label?: unknown };
        return typeof p.label === "string";
      })
        .map((el) => (el.props as { label: string }).label)
        .sort();
    });
    // All labels must match across the 9 block types.
    const first = JSON.stringify(labelSets[0]);
    for (const set of labelSets) {
      expect(JSON.stringify(set)).toBe(first);
    }
  });
});
