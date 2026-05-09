import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Canvas, buildCanvasBlockCss, isInnerInlineDisplay } from "../src/admin/Canvas.js";
import { buildBlockChromeCss } from "../src/components/styleUtils.js";
import type { BlockType, SectionBlock } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBlock(
  type: BlockType,
  config: Record<string, unknown>,
  id = "B1",
): SectionBlock {
  return {
    id,
    type,
    config: { theme: "light", ...config },
  };
}

// F3.6.3 — Canvas's per-block CSS path is the same path the frontend Astro
// components use, plus an active-breakpoint preview overlay layered on top.
//
// Drift is the bug: a config with hover + breakpoint + dark variants used to
// render one way on Canvas (only `buildBlockCss + buildHoverCss + getCustomCss`)
// and another way on the host site (`buildBlockChromeCss` — full chain).
// These tests pin the unification.

describe("buildCanvasBlockCss — frontend parity", () => {
  it("on desktop, output equals the frontend's buildBlockChromeCss output", () => {
    const block = makeBlock("text", {
      style: { paddingTop: "8px", color: "#111111" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
      advanced: { customCss: "color: red;" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    expect(canvasCss).toBe(frontendCss);
  });

  it("emits the FULL frontend bundle — block + hover + breakpoint + breakpoint-hover + custom", () => {
    const block = makeBlock("text", {
      style: { paddingTop: "8px" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
      advanced: { customCss: "color: red;" },
    });

    const css = buildCanvasBlockCss(block, "desktop");

    // Block + hover (from buildBlockCss + buildHoverCss).
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("border-top-width:2px !important");
    // Breakpoint @media (from buildBreakpointCss).
    expect(css).toContain("@media(max-width:575px)");
    expect(css).toContain("font-size:14px");
    // Breakpoint hover @media (from buildBreakpointHoverCss).
    expect(css).toContain("border-top-width:4px !important");
    // Custom CSS (from getCustomCss).
    expect(css).toContain("color: red");
  });

  it("emits dark variants identical to the frontend (drift fix)", () => {
    const block = makeBlock("text", {
      style: { color: "#111111" },
      styleDark: { color: "#eeeeee" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");

    expect(canvasCss).toContain("color:#111111");
    expect(canvasCss).toContain("color:#eeeeee");
    expect(canvasCss).toContain(":is(html.dark");
  });

  it("respects imgScoped: true for image blocks (mirrors Image.astro)", () => {
    const block = makeBlock("image", {
      style: { borderTopWidth: "2px", borderStyle: "solid", borderColor: "#000" },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id, { imgScoped: true });

    expect(canvasCss).toBe(frontendCss);
    // Image visual props target the inner <img>, not the root.
    expect(canvasCss).toContain('[data-epx-block="B1"] img{');
    expect(canvasCss).toContain("border-top-width:2px");
  });

  it("returns empty string when block has no styling at all", () => {
    const block = makeBlock("text", {});
    expect(buildCanvasBlockCss(block, "desktop")).toBe("");
  });
});

describe("buildCanvasBlockCss — active-breakpoint preview overlay", () => {
  it("on non-desktop, layers a non-@media overlay on top of the frontend bundle", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // Frontend bundle still emitted — drift dies.
    expect(canvasCss.startsWith(frontendCss)).toBe(true);

    // Frontend's @media rule fires only at <=575px viewport.
    expect(frontendCss).toContain("@media(max-width:575px)");
    expect(frontendCss).toContain("font-size:14px");

    // Canvas adds an overlay AFTER the bundle that wins in cascade order.
    // The overlay declares `font-size:14px` directly on the block selector
    // with no @media gate.
    const overlay = canvasCss.slice(frontendCss.length);
    expect(overlay).toContain('[data-epx-block="B1"]{');
    expect(overlay).toContain("font-size:14px");
    expect(overlay).not.toContain("@media");
  });

  it("overlays the active bp's hover declarations when styleHoverBreakpoints is set", () => {
    const block = makeBlock("text", {
      styleHover: { borderTopWidth: "1px" },
      styleHoverBreakpoints: { "mobile-portrait": { _px: 575, borderTopWidth: "4px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);
    const overlay = canvasCss.slice(frontendCss.length);

    // Overlay :hover rule with no @media gate.
    expect(overlay).toContain('[data-epx-block="B1"]:hover{');
    expect(overlay).toContain("border-top-width:4px !important");
    expect(overlay).not.toContain("@media");
  });

  it("emits no overlay when the active bp has no override on this block", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "16px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // No overlay because mobile-portrait has nothing in styleBreakpoints —
    // the frontend bundle is the entire output.
    expect(canvasCss).toBe(frontendCss);
  });

  it("overlay routes image blocks through imgScoped (mirrors Image.astro)", () => {
    const block = makeBlock("image", {
      style: { borderTopWidth: "1px", borderStyle: "solid", borderColor: "#000" },
      styleBreakpoints: {
        "mobile-portrait": { _px: 575, borderTopWidth: "4px" },
      },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");
    const frontendCss = buildBlockChromeCss(block.config, block.id, { imgScoped: true });
    const overlay = canvasCss.slice(frontendCss.length);

    // Frontend bundle emits the @media rule on the root.
    expect(frontendCss).toContain("@media(max-width:575px)");
    // Overlay re-emits the visual override on `<img>` (imgScoped).
    expect(overlay).toContain('[data-epx-block="B1"] img{');
    expect(overlay).toContain("border-top-width:4px");
  });

  it("desktop overlay is empty regardless of breakpoint data", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "desktop");
    const frontendCss = buildBlockChromeCss(block.config, block.id);

    // Desktop = no overlay; canvas == frontend exactly.
    expect(canvasCss).toBe(frontendCss);
  });

  it("active-bp overlay wins in cascade order over the frontend bundle", () => {
    const block = makeBlock("text", {
      style: { fontSize: "20px" },
      styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
    });

    const canvasCss = buildCanvasBlockCss(block, "mobile-portrait");

    // Two `font-size` declarations exist: 20px (desktop, in the frontend
    // bundle's base rule) and 14px (overlay). The overlay must come AFTER
    // the 20px declaration so cascade order picks 14px when both selectors
    // match (selector specificity is equal; later rule wins).
    const idx20 = canvasCss.indexOf("font-size:20px");
    const idxOverlay14 = canvasCss.lastIndexOf("font-size:14px");
    expect(idx20).toBeGreaterThanOrEqual(0);
    expect(idxOverlay14).toBeGreaterThan(idx20);
  });
});

// ─── F3.6.5 — root host wrapper ──────────────────────────────────────────────
//
// Each root-level block on Canvas sits inside `<div class="epx-canvas-block-host">`
// that forces width: 100%. Solves the "leaf block at canvas root collapses to
// content width" issue (button / icon / divider-spacer promoted to root via
// `isRootAllowedType` were folding to intrinsic width because
// `.epx-canvas__list` was `display: flex; flex-direction: column`). Children
// inside containers stay unwrapped — the container's `epx-container-block__children`
// flex/grid IS the block-context for its children, exactly like
// `SectionContainer.astro` on the frontend (parity with `BlockRenderer.astro`).
//
// Inline-display exception — when the inner block's `config.style.display ∈
// { inline-flex, inline-block, inline-grid, inline }`, the host still spans
// the canvas but adds `--inline-inner` so `text-align: start` anchors the
// inline child at the left.

describe("isInnerInlineDisplay", () => {
  it("returns false when block.config.style.display is unset", () => {
    const block: SectionBlock = { id: "B1", type: "text", config: { theme: "light" } };
    expect(isInnerInlineDisplay(block, "desktop")).toBe(false);
  });

  it("returns false for block-level display values (block, flex, grid, …)", () => {
    for (const display of ["block", "flex", "grid", "table", "list-item"]) {
      const block: SectionBlock = {
        id: "B1",
        type: "text",
        config: { theme: "light", style: { display } },
      };
      expect(isInnerInlineDisplay(block, "desktop")).toBe(false);
    }
  });

  it("returns true for every inline-* display value", () => {
    for (const display of ["inline", "inline-block", "inline-flex", "inline-grid"]) {
      const block: SectionBlock = {
        id: "B1",
        type: "button",
        config: { theme: "light", style: { display } },
      };
      expect(isInnerInlineDisplay(block, "desktop")).toBe(true);
    }
  });

  it("respects active-bp override on styleBreakpoints[bp].display", () => {
    const block: SectionBlock = {
      id: "B1",
      type: "button",
      config: {
        theme: "light",
        style: { display: "block" },
        styleBreakpoints: { "mobile-portrait": { _px: 575, display: "inline-flex" } },
      },
    };
    // Desktop reads from base style → block-level
    expect(isInnerInlineDisplay(block, "desktop")).toBe(false);
    // Mobile reads the bp override → inline-flex
    expect(isInnerInlineDisplay(block, "mobile-portrait")).toBe(true);
    // Other bp without override falls back to base style → block-level
    expect(isInnerInlineDisplay(block, "tablet-portrait")).toBe(false);
  });
});

describe("Canvas — root host wrapper (F3.6.5)", () => {
  // Render a static-markup snapshot of <Canvas> with a representative root
  // tree: container with a child + leaf at root + inline-display leaf at
  // root. Asserts wrapper presence on root blocks, absence on container
  // children, and the inline-inner modifier on the inline-display root.
  //
  // Canvas reads `useEffect` for the global stylesheet — that effect doesn't
  // fire under SSR, but the JSX structure we're testing renders synchronously.
  // dnd-kit's `useSortable` / `useDroppable` hooks gracefully no-op without a
  // `DndContext` (they return inert defaults), so SSR is safe.
  const noop = () => {};

  function renderCanvas(sections: SectionBlock[]): string {
    return renderToStaticMarkup(
      createElement(Canvas, {
        sections,
        selectedId: null,
        onSelect: noop,
        onRemove: noop,
        onAddToContainer: noop,
        dropIndicatorId: null,
        onAddAfter: noop,
        activeBreakpoint: "desktop",
      }),
    );
  }

  it("wraps each root-level block in `.epx-canvas-block-host`", () => {
    // Two root blocks: a container and a leaf — both are wrapped.
    const sections: SectionBlock[] = [
      { id: "C1", type: "container", config: { theme: "light" }, children: [] },
      { id: "T1", type: "text", config: { theme: "light" } },
    ];
    const html = renderCanvas(sections);

    // Two host wrappers, one per root block.
    const hostMatches = html.match(/class="epx-canvas-block-host(?:\s|")/g) ?? [];
    expect(hostMatches.length).toBe(2);

    // Each carries a `data-epx-block-host` pointing at the block id.
    expect(html).toContain('data-epx-block-host="C1"');
    expect(html).toContain('data-epx-block-host="T1"');
  });

  it("wrapper is full-width via the .epx-canvas-block-host class (CSS rule lives in builder.css)", () => {
    // The wrapper selector itself is the contract — CSS is inspected by the
    // builder.css test below. Here we just confirm the class lands on the
    // wrapper element (not on the inner block).
    const sections: SectionBlock[] = [
      { id: "T1", type: "text", config: { theme: "light" } },
    ];
    const html = renderCanvas(sections);

    // Wrapper class on the outer div, BEFORE the SortableBlock's
    // `epx-block-preview` div.
    const hostIdx = html.indexOf("epx-canvas-block-host");
    const previewIdx = html.indexOf("epx-block-preview");
    expect(hostIdx).toBeGreaterThanOrEqual(0);
    expect(previewIdx).toBeGreaterThan(hostIdx);
  });

  it("does NOT wrap children inside containers", () => {
    // Container with one leaf child: the container is wrapped, the child
    // (rendered inside `epx-container-block__children`) is not.
    const sections: SectionBlock[] = [
      {
        id: "C1",
        type: "container",
        config: { theme: "light" },
        children: [{ id: "T1", type: "text", config: { theme: "light" } }],
      },
    ];
    const html = renderCanvas(sections);

    // Exactly one wrapper — the container at root, not the child inside.
    const hostMatches = html.match(/class="epx-canvas-block-host(?:\s|")/g) ?? [];
    expect(hostMatches.length).toBe(1);
    expect(html).toContain('data-epx-block-host="C1"');
    expect(html).not.toContain('data-epx-block-host="T1"');
  });

  it("adds `--inline-inner` modifier when block.config.style.display is inline-*", () => {
    // Two root blocks: one with `display: inline-flex` (button), one without.
    const sections: SectionBlock[] = [
      {
        id: "BTN",
        type: "button",
        config: { theme: "light", style: { display: "inline-flex" } },
      },
      { id: "T1", type: "text", config: { theme: "light" } },
    ];
    const html = renderCanvas(sections);

    // Inline-flex button gets the modifier.
    expect(html).toMatch(
      /class="epx-canvas-block-host epx-canvas-block-host--inline-inner"[^>]*data-epx-block-host="BTN"/,
    );
    // Plain text root host does NOT get the modifier.
    expect(html).toMatch(
      /class="epx-canvas-block-host"[^>]*data-epx-block-host="T1"/,
    );
  });

  it("emits no host wrapper for an empty canvas (empty-state placeholder is rendered instead)", () => {
    const html = renderCanvas([]);
    expect(html).not.toContain("epx-canvas-block-host");
    // The empty state placeholder still renders.
    expect(html).toContain("Start building your page");
  });
});
