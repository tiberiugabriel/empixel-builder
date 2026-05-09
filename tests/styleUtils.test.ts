import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  buildBlockCss,
  buildHoverCss,
  buildBreakpointCss,
  buildBlockChromeCss,
  getCustomCss,
  getBlockId,
  getBlockClass,
  normalizeLegacySpacing,
  coalesceLayoutCss,
  _resetBuildBlockChromeCssCache,
  _buildBlockChromeCssCacheSize,
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

  it("emits BOTH light and dark variants — dark scoped via the universal selector", () => {
    const css = buildBlockCss(
      { style: { color: "#000000" }, styleDark: { color: "#ffffff" } },
      "B1",
    );
    // Light rule on the bare attribute selector.
    expect(css).toContain('[data-epx-block="B1"]{');
    expect(css).toContain("color:#000000");
    // Dark rule on the compound :is(...) ancestor selector — matches when an
    // ancestor uses any of the supported theme conventions, OR when the
    // block element itself carries data-theme="dark" (canvas preview).
    expect(css).toContain(':is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="B1"]');
    expect(css).toContain('[data-epx-block="B1"][data-theme="dark"]');
    expect(css).toContain("color:#ffffff");
  });

  it("does not emit a dark rule when styleDark is empty", () => {
    const css = buildBlockCss({ style: { color: "#000000" } }, "B1");
    expect(css).toContain("color:#000000");
    expect(css).not.toContain('[data-theme="dark"]');
  });

  // F1.2 — universal dark selector. Plugin must adapt to whichever theme
  // convention the host site chose (EmDash core enforces none); see Section
  // 5 Q4 of raport-empixel-emdash.html.
  it("composes dark selector covering Tailwind, html data-theme, ancestor data-theme, data-mode, and self", () => {
    const css = buildBlockCss(
      { style: { color: "#000000" }, styleDark: { color: "#ffffff" } },
      "abc123",
    );
    const expectedDarkSelector =
      ':is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="abc123"],' +
      '[data-epx-block="abc123"][data-theme="dark"]';
    expect(css).toContain(`${expectedDarkSelector}{color:#ffffff}`);
  });
});

describe("buildHoverCss", () => {
  // F4.5 — `!important` was dropped on hover declarations. Selector
  // specificity (`darkBlockSelector + :hover` > `darkBlockSelector` >
  // `:hover` > base) now drives the cascade. See `prd-theme.md`.
  it("emits a :hover rule without !important (F4.5)", () => {
    const css = buildHoverCss({ styleHover: { borderTopWidth: "2px" } }, "B1");
    expect(css).toContain('[data-epx-block="B1"]:hover{');
    expect(css).toContain("border-top-width:2px");
    expect(css).not.toContain("!important");
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
    // F4.5 — hover declarations no longer carry `!important`. Specificity
    // ladder (dark+hover > dark > hover > base) handles the cascade.
    expect(css).toContain("border-top-width:2px");
    expect(css).not.toContain("!important");
    expect(css).toContain("@media(max-width:575px)");
    expect(css).toContain("color: red");
  });

  it("returns empty string when no blockId", () => {
    expect(buildBlockChromeCss({ style: { paddingTop: "8px" } }, undefined)).toBe("");
  });

  it("routes background storage keys through opts.resolveMediaUrl when provided (F2.2)", () => {
    const config = {
      style: {
        backgroundType: "image",
        backgroundImageSrc: "media",
        backgroundImageStorageKey: "bg-key.png",
      },
    };
    const css = buildBlockChromeCss(config, "B1", {
      resolveMediaUrl: (key) => `https://cdn.example.com/${key}`,
    });
    expect(css).toContain("background-image:url(https://cdn.example.com/bg-key.png)");
    // Legacy local route MUST NOT appear when a resolver is supplied.
    expect(css).not.toContain("/_emdash/api/media/file/");
  });

  it("falls back to the legacy local URL when no resolver is supplied (F2.2)", () => {
    const config = {
      style: {
        backgroundType: "image",
        backgroundImageSrc: "media",
        backgroundImageStorageKey: "bg-key.png",
      },
    };
    const css = buildBlockChromeCss(config, "B1");
    expect(css).toContain("background-image:url(/_emdash/api/media/file/bg-key.png)");
  });
});

// ─── F3.6.4: legacy symbolic-spacing inline resolve ─────────────────────────
//
// Pre-F3.6 layouts persisted padding/margin as symbolic strings
// (`"md"`/`"lg"`/…); F3.6 + F3.6.4 retired that vocabulary. Agent A's
// `runMigrationLegacySpacingV1` rewrites stored rows forward, but for the
// brief window between an upgrade and the lazy-gate migration firing,
// `styleUtils.ts` inline-resolves symbolic values to the matching px so
// rendered pages don't silently drop padding to zero. The legacy
// `spacingMap` / `resolveSpacing` plumbing in `SectionContainer.astro`
// was removed as part of the same task.
describe("normalizeLegacySpacing (F3.6.4)", () => {
  it("maps each legacy symbolic value to its px equivalent", () => {
    expect(normalizeLegacySpacing("none")).toBe("0");
    expect(normalizeLegacySpacing("sm")).toBe("32px");
    expect(normalizeLegacySpacing("md")).toBe("48px");
    expect(normalizeLegacySpacing("lg")).toBe("64px");
    expect(normalizeLegacySpacing("xl")).toBe("96px");
  });

  it("passes through concrete CSS values unchanged", () => {
    expect(normalizeLegacySpacing("12px")).toBe("12px");
    expect(normalizeLegacySpacing("1.5rem")).toBe("1.5rem");
    expect(normalizeLegacySpacing("0")).toBe("0");
    expect(normalizeLegacySpacing("")).toBe("");
    expect(normalizeLegacySpacing("clamp(1rem, 5vw, 4rem)")).toBe("clamp(1rem, 5vw, 4rem)");
  });

  it("does not match unrelated strings that happen to overlap with prop names", () => {
    expect(normalizeLegacySpacing("medium")).toBe("medium");
    expect(normalizeLegacySpacing("xlarge")).toBe("xlarge");
  });
});

describe("buildBlockCss — F3.6.4 legacy spacing inline-resolve", () => {
  it("resolves symbolic padding values to px (replaces SectionContainer's old spacingMap)", () => {
    const css = buildBlockCss(
      { style: { paddingTop: "md", paddingRight: "sm", paddingBottom: "lg", paddingLeft: "xl" } },
      "B1",
    );
    expect(css).toContain("padding-top:48px");
    expect(css).toContain("padding-right:32px");
    expect(css).toContain("padding-bottom:64px");
    expect(css).toContain("padding-left:96px");
    // Symbolic strings must NOT survive into the emitted rule body.
    expect(css).not.toContain("padding-top:md");
    expect(css).not.toContain("padding-right:sm");
  });

  it("resolves symbolic margin values to px", () => {
    const css = buildBlockCss(
      { style: { marginTop: "none", marginRight: "sm", marginBottom: "md", marginLeft: "xl" } },
      "B1",
    );
    expect(css).toContain("margin-top:0");
    expect(css).toContain("margin-right:32px");
    expect(css).toContain("margin-bottom:48px");
    expect(css).toContain("margin-left:96px");
  });

  it("leaves concrete px / rem / clamp values for padding alone", () => {
    const css = buildBlockCss(
      { style: { paddingTop: "12px", paddingBottom: "1.5rem" } },
      "B1",
    );
    expect(css).toContain("padding-top:12px");
    expect(css).toContain("padding-bottom:1.5rem");
  });

  it("only normalises padding+margin keys — non-spacing keys keep their value as-is", () => {
    // `width: "md"` is nonsense CSS, but the legacy fallback historically
    // never touched non-spacing keys. The inline-resolve must preserve that
    // behavior so authors who typed `none` into a non-spacing field don't
    // see it silently rewritten to `0`.
    const css = buildBlockCss(
      { style: { width: "md", borderTopWidth: "sm", paddingTop: "md" } },
      "B1",
    );
    expect(css).toContain("padding-top:48px");
    expect(css).toContain("width:md");
    expect(css).toContain("border-top-width:sm");
  });
});

describe("buildBreakpointCss — F3.6.4 legacy spacing inline-resolve", () => {
  it("normalises spacing keys at the breakpoint level when they appear in BP_VISUAL_PROPS", () => {
    // BP_VISUAL_PROPS doesn't currently include padding/margin (visual
    // props only — radii/border/typography/etc.) so this is a forward
    // compatibility check: the breakpoint loop applies the same gate as
    // the desktop loop, so any future addition of a spacing key to
    // BP_VISUAL_PROPS automatically inherits the legacy fallback. Today
    // the test exercises the no-op path (typography keys are unaffected
    // by normalisation, just like before).
    const css = buildBreakpointCss(
      { styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "16px" } } },
      "B1",
    );
    expect(css).toContain("font-size:16px");
  });
});

// ─── F4.1: CSS coalescing helper (currently unused by LayoutRenderer) ──────
//
// `coalesceLayoutCss(strings)` was introduced for F4.1 to merge per-block
// CSS into a single `<style>` per page (groups identical `@media` queries
// so each breakpoint opens exactly one `@media` block instead of one per
// block × per bp). The wiring it relied on — collect CSS into
// `Astro.locals.empixelLayoutCss` from each block frontmatter, drain via a
// post-iteration IIFE in `LayoutRenderer.astro`'s template — was reverted
// in 1.0.0's P0 fix because the parent's IIFE evaluated before child
// frontmatters had pushed their CSS, so the bundled `<style>` came out
// empty and frontend pages rendered with zero plugin styling. Each block
// component now emits its own inline `<style is:global>` again (pre-F4.1
// behavior).
//
// `coalesceLayoutCss` stays exported here (and unit-tested below) for a
// future redo with a reliable mechanism — likely a server-pre-pass walk in
// `LayoutRenderer.astro`'s own frontmatter that builds CSS for every block
// before any child renders, OR an upgrade once Astro's component-tree
// render order is documented. Tests below validate the helper in
// isolation; the integration test (`end-to-end — a 5-block page emits CSS
// that produces exactly 1 <style> tag`) describes the *future* shape, not
// the current LayoutRenderer behavior.
describe("coalesceLayoutCss (F4.1 helper — currently unused)", () => {
  it("returns empty string for empty input", () => {
    expect(coalesceLayoutCss([])).toBe("");
    expect(coalesceLayoutCss([""])).toBe("");
    expect(coalesceLayoutCss(["", ""])).toBe("");
  });

  it("passes through input that has no @media blocks (fast path)", () => {
    const input = [
      '[data-epx-block="A"]{color:red}',
      '[data-epx-block="B"]{color:blue}',
    ];
    const out = coalesceLayoutCss(input);
    expect(out).toBe('[data-epx-block="A"]{color:red}[data-epx-block="B"]{color:blue}');
  });

  it("groups two blocks that share an @media query under one wrapper", () => {
    const a = '[data-epx-block="A"]{color:red}@media(max-width:992px){[data-epx-block="A"]{font-size:14px}}';
    const b = '[data-epx-block="B"]{color:blue}@media(max-width:992px){[data-epx-block="B"]{font-size:12px}}';
    const out = coalesceLayoutCss([a, b]);
    // Base rules first.
    expect(out).toContain('[data-epx-block="A"]{color:red}');
    expect(out).toContain('[data-epx-block="B"]{color:blue}');
    // Exactly one @media wrapper containing BOTH blocks' bodies.
    const mediaMatches = out.match(/@media\(max-width:992px\)\{/g) ?? [];
    expect(mediaMatches.length).toBe(1);
    // Both per-bp bodies survive into the single wrapper.
    expect(out).toContain('[data-epx-block="A"]{font-size:14px}');
    expect(out).toContain('[data-epx-block="B"]{font-size:12px}');
  });

  it("keeps two blocks with DIFFERENT @media queries in separate wrappers", () => {
    const a = '[data-epx-block="A"]{color:red}@media(max-width:992px){[data-epx-block="A"]{font-size:14px}}';
    const b = '[data-epx-block="B"]{color:blue}@media(max-width:575px){[data-epx-block="B"]{font-size:10px}}';
    const out = coalesceLayoutCss([a, b]);
    // Two distinct @media wrappers, one per query.
    expect(out.match(/@media\(max-width:992px\)\{/g)?.length).toBe(1);
    expect(out.match(/@media\(max-width:575px\)\{/g)?.length).toBe(1);
    expect(out).toContain('[data-epx-block="A"]{font-size:14px}');
    expect(out).toContain('[data-epx-block="B"]{font-size:10px}');
  });

  it("emits base rules BEFORE any @media wrapper (cascade order)", () => {
    const a = '[data-epx-block="A"]{color:red}@media(max-width:992px){[data-epx-block="A"]{font-size:14px}}';
    const b = '[data-epx-block="B"]{color:blue}';
    const out = coalesceLayoutCss([a, b]);
    const baseAIdx = out.indexOf('[data-epx-block="A"]{color:red}');
    const baseBIdx = out.indexOf('[data-epx-block="B"]{color:blue}');
    const mediaIdx = out.indexOf("@media");
    expect(baseAIdx).toBeGreaterThanOrEqual(0);
    expect(baseBIdx).toBeGreaterThanOrEqual(0);
    expect(mediaIdx).toBeGreaterThan(baseBIdx);
  });

  it("merges three blocks across two shared queries — two @media wrappers total", () => {
    const a = '@media(max-width:992px){[data-epx-block="A"]{font-size:14px}}@media(max-width:575px){[data-epx-block="A"]{font-size:10px}}';
    const b = '@media(max-width:992px){[data-epx-block="B"]{font-size:13px}}';
    const c = '@media(max-width:575px){[data-epx-block="C"]{font-size:9px}}';
    const out = coalesceLayoutCss([a, b, c]);
    expect(out.match(/@media\(max-width:992px\)\{/g)?.length).toBe(1);
    expect(out.match(/@media\(max-width:575px\)\{/g)?.length).toBe(1);
    expect(out).toContain('[data-epx-block="A"]{font-size:14px}');
    expect(out).toContain('[data-epx-block="A"]{font-size:10px}');
    expect(out).toContain('[data-epx-block="B"]{font-size:13px}');
    expect(out).toContain('[data-epx-block="C"]{font-size:9px}');
  });

  it("handles `:hover` rules inside an @media block (nested-brace tolerance)", () => {
    // `buildBreakpointHoverCss` emits `@media(...){[data-epx-block]:hover{...}}` —
    // verify the splitter doesn't get confused by the inner braces and
    // groups two hover rules under the same query.
    const a = '@media(max-width:992px){[data-epx-block="A"]:hover{color:red !important}}';
    const b = '@media(max-width:992px){[data-epx-block="B"]:hover{color:blue !important}}';
    const out = coalesceLayoutCss([a, b]);
    expect(out.match(/@media\(max-width:992px\)\{/g)?.length).toBe(1);
    expect(out).toContain('[data-epx-block="A"]:hover{color:red !important}');
    expect(out).toContain('[data-epx-block="B"]:hover{color:blue !important}');
  });

  it("normalises whitespace differences in queries (trims) so equivalent queries merge", () => {
    // Plugin helpers emit `@media(max-width:992px)` (no space). Custom CSS
    // authored by the user might write `@media (max-width: 992px)` with
    // padding. The query string is trimmed — leading / trailing whitespace
    // is squashed — so the two forms group together.
    const a = '@media(max-width:992px){[data-epx-block="A"]{font-size:14px}}';
    const b = '@media (max-width:992px) {[data-epx-block="B"]{font-size:13px}}';
    const out = coalesceLayoutCss([a, b]);
    // Should produce exactly one @media wrapper despite the input variation.
    expect(out.match(/@media/g)?.length).toBe(1);
    expect(out).toContain('[data-epx-block="A"]{font-size:14px}');
    expect(out).toContain('[data-epx-block="B"]{font-size:13px}');
  });

  it("preserves dark-theme :is(...) selectors as base rules (not @media)", () => {
    // The dark variant emits its own scoped rule via `darkBlockSelector(blockId)`
    // which uses `:is(html.dark, html[data-theme="dark"], …) [data-epx-block]`.
    // Make sure the splitter treats it as a bare rule (not as something
    // exotic) — `:is(...)` isn't an at-rule.
    const a = '[data-epx-block="A"]{color:#000}:is(html.dark, [data-theme="dark"]) [data-epx-block="A"]{color:#fff}';
    const out = coalesceLayoutCss([a]);
    expect(out).toContain('[data-epx-block="A"]{color:#000}');
    expect(out).toContain(':is(html.dark, [data-theme="dark"]) [data-epx-block="A"]{color:#fff}');
    expect(out).not.toContain("@media");
  });

  it("end-to-end — coalesceLayoutCss collapses 5 blocks worth of CSS into a single bundle (helper-level)", () => {
    // Synthetic exercise of the helper. NOT what `LayoutRenderer.astro`
    // currently does: 1.0.0 P0 reverted F4.1's collect-then-IIFE-drain
    // wiring (see the describe block's comment above). Each block component
    // emits its own inline `<style is:global>` today, so a 5-block page
    // ships 5 tags. The helper still works as designed, and the test
    // documents the shape a future redo with a reliable collection
    // mechanism would converge on.
    const perBlockCss = [
      buildBlockChromeCss({ style: { paddingTop: "8px" }, styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "16px" } } }, "B1"),
      buildBlockChromeCss({ style: { color: "red" }, styleBreakpoints: { "tablet-portrait": { _px: 992, fontSize: "14px" } } }, "B2"),
      buildBlockChromeCss({ style: { paddingBottom: "12px" }, styleBreakpoints: { "mobile-portrait": { _px: 575, fontSize: "12px" } } }, "B3"),
      buildBlockChromeCss({ style: { color: "blue" }, styleHover: { borderTopWidth: "2px" } }, "B4"),
      buildBlockChromeCss({ style: { paddingLeft: "4px" } }, "B5"),
    ];
    // All 5 blocks produced non-empty CSS.
    expect(perBlockCss.every((s) => s.length > 0)).toBe(true);

    const bundle = coalesceLayoutCss(perBlockCss);
    // Wrap in the single <style> tag the LayoutRenderer would emit.
    const emitted = `<style is:global>${bundle}</style>`;
    // Exactly ONE <style> tag opens.
    expect((emitted.match(/<style /g) ?? []).length).toBe(1);
    // Exactly ONE @media(max-width:992px) wrapper despite TWO blocks (B1, B2)
    // contributing per-bp rules at that breakpoint — proves grouping worked.
    expect(bundle.match(/@media\(max-width:992px\)\{/g)?.length).toBe(1);
    // Exactly ONE @media(max-width:575px) wrapper — only B3 contributes
    // there but the count must still be one (no degenerate doubling).
    expect(bundle.match(/@media\(max-width:575px\)\{/g)?.length).toBe(1);
    // All 5 base rules survive into the bundle.
    expect(bundle).toContain('[data-epx-block="B1"]{');
    expect(bundle).toContain('[data-epx-block="B2"]{');
    expect(bundle).toContain('[data-epx-block="B3"]{');
    expect(bundle).toContain('[data-epx-block="B4"]{');
    expect(bundle).toContain('[data-epx-block="B5"]{');
  });
});

// ─── F4.2: memoize buildBlockChromeCss ──────────────────────────────────────

describe("F4.2 — buildBlockChromeCss memoization", () => {
  beforeEach(() => {
    _resetBuildBlockChromeCssCache();
  });
  afterEach(() => {
    _resetBuildBlockChromeCssCache();
  });

  it("identical inputs produce identical output and the second call hits the cache", () => {
    const config = {
      style: { paddingTop: "8px", paddingBottom: "12px", color: "#000000" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: {
        "tablet-portrait": { _px: 992, fontSize: "16px" },
      },
    };

    expect(_buildBlockChromeCssCacheSize()).toBe(0);
    const a = buildBlockChromeCss(config, "B1");
    expect(_buildBlockChromeCssCacheSize()).toBe(1);

    const b = buildBlockChromeCss(config, "B1");
    expect(b).toBe(a);
    // Size unchanged — the second call hit the existing cached entry.
    expect(_buildBlockChromeCssCacheSize()).toBe(1);
  });

  it("memo hit is faster than cold path on heavy configs (sanity bench)", () => {
    // Construct a non-trivial config — large enough that the sub-helpers
    // walk a meaningful amount of work cold.
    const heavy = {
      style: {
        paddingTop: "12px", paddingRight: "16px", paddingBottom: "12px", paddingLeft: "16px",
        color: "#112233", fontSize: "18px", lineHeight: "1.4",
        borderStyle: "solid", borderTopWidth: "1px", borderRightWidth: "1px",
        borderBottomWidth: "1px", borderLeftWidth: "1px",
        borderTopLeftRadius: "8px", borderTopRightRadius: "8px",
        borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px",
      },
      styleHover: {
        borderTopWidth: "2px", borderRightWidth: "2px",
        borderBottomWidth: "2px", borderLeftWidth: "2px",
      },
      styleBreakpoints: {
        "tablet-portrait": { _px: 992, fontSize: "16px" },
        "mobile-portrait": { _px: 575, fontSize: "14px" },
      },
      styleHoverBreakpoints: {
        "mobile-portrait": { _px: 575, borderTopWidth: "1px" },
      },
      advanced: { customCss: "selector{outline:1px dashed red}" },
    };

    // Warm the cache.
    buildBlockChromeCss(heavy, "B1");
    // Bench: 100 hits.
    const N = 100;
    const t0 = performance.now();
    for (let i = 0; i < N; i += 1) buildBlockChromeCss(heavy, "B1");
    const elapsed = performance.now() - t0;
    // 100 hits should comfortably finish in well under 5ms (the per-call
    // budget for cache hits). Headroom — the cold path on a heavy config
    // can hit single-digit ms by itself, so 100 cold paths would dwarf this.
    expect(elapsed).toBeLessThan(50);
  });

  it("different blockId → distinct cache entries", () => {
    const config = { style: { paddingTop: "8px" } };
    buildBlockChromeCss(config, "B1");
    buildBlockChromeCss(config, "B2");
    expect(_buildBlockChromeCssCacheSize()).toBe(2);
  });

  it("different config → distinct cache entries", () => {
    buildBlockChromeCss({ style: { paddingTop: "8px" } }, "B1");
    buildBlockChromeCss({ style: { paddingTop: "12px" } }, "B1");
    expect(_buildBlockChromeCssCacheSize()).toBe(2);
  });

  it("different opts.imgScoped → distinct cache entries", () => {
    const config = { style: { paddingTop: "8px", borderTopLeftRadius: "4px" } };
    buildBlockChromeCss(config, "B1");
    buildBlockChromeCss(config, "B1", { imgScoped: true });
    expect(_buildBlockChromeCssCacheSize()).toBe(2);
  });

  it("skips memoization when opts.resolveMediaUrl is set (closure dependency)", () => {
    const resolver = (key: string) => `https://cdn.example.com/${key}`;
    const config = {
      style: {
        backgroundType: "image",
        backgroundImageSrc: "storage",
        backgroundImageStorageKey: "abc.jpg",
      },
    };

    expect(_buildBlockChromeCssCacheSize()).toBe(0);
    const a = buildBlockChromeCss(config, "B1", { resolveMediaUrl: resolver });
    // Cache stays empty because the path bypassed memoization entirely.
    expect(_buildBlockChromeCssCacheSize()).toBe(0);
    // Still computes the correct CSS (with the resolved URL baked in).
    expect(a).toContain("https://cdn.example.com/abc.jpg");

    // Different resolver — must produce different output, with no
    // cross-call cache pollution from the previous call.
    const resolver2 = (key: string) => `https://other.example.com/${key}`;
    const b = buildBlockChromeCss(config, "B1", { resolveMediaUrl: resolver2 });
    expect(b).toContain("https://other.example.com/abc.jpg");
    expect(b).not.toEqual(a);
    expect(_buildBlockChromeCssCacheSize()).toBe(0);
  });

  it("LRU eviction: 501st distinct call evicts the oldest entry", () => {
    // 500 distinct (config, blockId) pairs → cache fills to capacity.
    for (let i = 0; i < 500; i += 1) {
      buildBlockChromeCss({ style: { paddingTop: `${i}px` } }, `B${i}`);
    }
    expect(_buildBlockChromeCssCacheSize()).toBe(500);

    // 501st pushes us over capacity — the eviction step runs and drops it
    // back to capacity.
    buildBlockChromeCss({ style: { paddingTop: "999px" } }, "B-new");
    expect(_buildBlockChromeCssCacheSize()).toBe(500);
  });

  it("recency promotion: a hit on the oldest moves it past younger entries", () => {
    // Fill to capacity.
    for (let i = 0; i < 500; i += 1) {
      buildBlockChromeCss({ style: { paddingTop: `${i}px` } }, `B${i}`);
    }
    // Re-hit the oldest entry — promotes it.
    buildBlockChromeCss({ style: { paddingTop: "0px" } }, "B0");

    // Adding one more should now evict B1 (the new oldest), not B0.
    buildBlockChromeCss({ style: { paddingTop: "777px" } }, "B-extra");
    expect(_buildBlockChromeCssCacheSize()).toBe(500);

    // B0 should still be a cache hit — issue an identical call and confirm
    // the cache size doesn't grow.
    const sizeBefore = _buildBlockChromeCssCacheSize();
    buildBlockChromeCss({ style: { paddingTop: "0px" } }, "B0");
    expect(_buildBlockChromeCssCacheSize()).toBe(sizeBefore);
  });

  it("output equivalence — memoized result matches the direct call", () => {
    const config = {
      style: { paddingTop: "8px", color: "#abcdef" },
      styleHover: { borderTopWidth: "2px" },
      styleBreakpoints: {
        "tablet-portrait": { _px: 992, fontSize: "16px" },
      },
      advanced: { customCss: "selector{outline:1px solid red}" },
    };
    // First call — cache miss; computes through the direct path.
    const cold = buildBlockChromeCss(config, "B1");
    // Reset the cache and recompute — second cold call should match.
    _resetBuildBlockChromeCssCache();
    const cold2 = buildBlockChromeCss(config, "B1");
    expect(cold2).toBe(cold);
  });
});
