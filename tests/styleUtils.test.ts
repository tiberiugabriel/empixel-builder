import { describe, it, expect } from "vitest";
import {
  buildBlockCss,
  buildHoverCss,
  buildBreakpointCss,
  buildBlockChromeCss,
  getCustomCss,
  getBlockId,
  getBlockClass,
} from "../src/components/styleUtils.js";

describe("buildBlockCss", () => {
  it("returns empty string when no blockId", () => {
    expect(buildBlockCss({ style: { paddingTop: "8px" } }, "")).toBe("");
  });

  it("emits a single rule under the block selector", () => {
    const css = buildBlockCss({ style: { paddingTop: "8px", paddingBottom: "12px" } }, "B1");
    expect(css.startsWith('[data-epx-block="B1"]{')).toBe(true);
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("padding-bottom:12px");
  });

  it("emits BOTH light and dark variants — dark scoped via [data-theme]", () => {
    const css = buildBlockCss(
      { style: { color: "#000000" }, styleDark: { color: "#ffffff" } },
      "B1",
    );
    // Light rule on the bare attribute selector.
    expect(css).toContain('[data-epx-block="B1"]{');
    expect(css).toContain("color:#000000");
    // Dark rule on the compound selector — matches when the host or the
    // block itself carries data-theme="dark".
    expect(css).toContain('[data-theme="dark"] [data-epx-block="B1"]');
    expect(css).toContain('[data-epx-block="B1"][data-theme="dark"]');
    expect(css).toContain("color:#ffffff");
  });

  it("does not emit a dark rule when styleDark is empty", () => {
    const css = buildBlockCss({ style: { color: "#000000" } }, "B1");
    expect(css).toContain("color:#000000");
    expect(css).not.toContain('[data-theme="dark"]');
  });
});

describe("buildHoverCss", () => {
  it("emits a :hover rule with !important", () => {
    const css = buildHoverCss({ styleHover: { borderTopWidth: "2px" } }, "B1");
    expect(css).toContain('[data-epx-block="B1"]:hover{');
    expect(css).toContain("border-top-width:2px !important");
  });

  it("returns empty string when nothing to emit", () => {
    expect(buildHoverCss({}, "B1")).toBe("");
  });
});

describe("buildBreakpointCss", () => {
  it("emits per-breakpoint @media rules sorted from largest to smallest px", () => {
    const css = buildBreakpointCss(
      {
        styleBreakpoints: {
          "tablet-portrait":  { _px: 992, fontSize: "16px" },
          "mobile-portrait":  { _px: 575, fontSize: "14px" },
        },
      },
      "B1",
    );
    const tabletIdx = css.indexOf("@media(max-width:992px)");
    const mobileIdx = css.indexOf("@media(max-width:575px)");
    expect(tabletIdx).toBeGreaterThanOrEqual(0);
    expect(mobileIdx).toBeGreaterThanOrEqual(0);
    expect(tabletIdx).toBeLessThan(mobileIdx);
    expect(css).toContain("font-size:16px");
    expect(css).toContain("font-size:14px");
  });

  it("skips breakpoints without _px", () => {
    const css = buildBreakpointCss(
      { styleBreakpoints: { foo: { fontSize: "20px" } } },
      "B1",
    );
    expect(css).toBe("");
  });
});

describe("getCustomCss", () => {
  it("substitutes the `selector` keyword and emits user CSS as-is when it has braces", () => {
    const css = getCustomCss({ advanced: { customCss: "selector h1 { color: red; }" } }, "B1");
    expect(css).toBe('[data-epx-block="B1"] h1 { color: red; }');
  });

  it("wraps bare declarations in a selector block", () => {
    const css = getCustomCss({ advanced: { customCss: "color: red; padding: 8px;" } }, "B1");
    expect(css).toBe('[data-epx-block="B1"]{color: red; padding: 8px;}');
  });

  it("returns empty string when no customCss", () => {
    expect(getCustomCss({ advanced: {} }, "B1")).toBe("");
  });
});

describe("getBlockId / getBlockClass", () => {
  it("reads advanced.cssId / advanced.cssClasses", () => {
    expect(getBlockId({ advanced: { cssId: "hero" } })).toBe("hero");
    expect(getBlockClass({ advanced: { cssClasses: "promo dark" } })).toBe("promo dark");
  });

  it("returns null / empty string when missing", () => {
    expect(getBlockId({ advanced: {} })).toBeNull();
    expect(getBlockClass({})).toBe("");
  });
});

describe("buildBlockChromeCss", () => {
  it("composes block + hover + breakpoint + custom into one string", () => {
    const css = buildBlockChromeCss(
      {
        style: { paddingTop: "8px" },
        styleHover: { borderTopWidth: "2px" },
        styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "14px" } },
        advanced: { customCss: "color: red;" },
      },
      "B1",
    );
    expect(css).toContain("padding-top:8px");
    expect(css).toContain("border-top-width:2px !important");
    expect(css).toContain("@media(max-width:575px)");
    expect(css).toContain("color: red");
  });

  it("returns empty string when no blockId", () => {
    expect(buildBlockChromeCss({ style: { paddingTop: "8px" } }, undefined)).toBe("");
  });
});
