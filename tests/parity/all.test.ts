/**
 * F3.6.7 — Parity snapshot suite for the 9 block types.
 *
 * Goal: lock the CSS output of `buildBlockChromeCss(config, blockId, opts)`
 * for every block in the system. Future edits to `styleUtils.ts` that drift
 * Canvas / frontend rendering surface as snapshot diffs — reviewing the
 * diff IS the verification that the change was intentional.
 *
 * Strategy
 * --------
 * Each fixture starts from `getDefaultBlockConfig(<type>)` so every
 * structural key (style / styleHover / styleDark / styleBreakpoints /
 * styleHoverBreakpoints / advanced + the F3.6.1 STYLE_PROPS placeholders)
 * is present. Aesthetic values are then layered on top to exercise the
 * CSS code paths that matter for that block. The `container` block carries
 * the EXHAUSTIVE "every key non-empty" config — it covers every
 * STYLE_PROPS entry plus hover, dark, breakpoint, breakpoint-hover, and
 * advanced. The other 8 fixtures cover representative subsets.
 *
 * One fixture (`text`) also drives a canvas-vs-frontend equality
 * assertion: `buildCanvasBlockCss(block, "desktop")` must emit exactly
 * the same string as `buildBlockChromeCss(block.config, block.id)`. This
 * extends the F3.6.3 unification — locks Canvas's per-block CSS path
 * against the frontend chrome helper at the snapshot level (not just at
 * "contains substring" level).
 *
 * Snapshot format: inline (`toMatchInlineSnapshot`). Keeps the assertion
 * + expected output co-located in this file so reviewers can see the diff
 * inline without bouncing to a separate `.snap` file.
 *
 * When a developer changes `styleUtils.ts`:
 *   - Run `npm test` once. Vitest will report the snapshot diff.
 *   - Inspect each diff. If the change was intended, run
 *     `vitest -u tests/parity/all.test.ts` (or `vitest -u`) to regenerate.
 *     Commit the regenerated snapshots in the SAME PR as the styleUtils
 *     change so the CI history records what shifted.
 *   - If a diff appears that you did NOT intend, that's parity drift —
 *     either Canvas/frontend just stopped agreeing, or a refactor leaked
 *     a behavior change. Fix the code, do NOT regenerate the snapshot.
 */

import { describe, it, expect } from "vitest";
import type { SectionBlock } from "../../src/types.js";
import { getDefaultBlockConfig } from "../../src/admin/blockDefinitions.js";
import { buildBlockChromeCss } from "../../src/components/styleUtils.js";
import { buildCanvasBlockCss } from "../../src/admin/Canvas.js";

// ─── Fixture builder ─────────────────────────────────────────────────────────

/**
 * Build a fixture by deep-merging `overlay` onto `getDefaultBlockConfig(type)`.
 * Nested `style` / `styleHover` / `styleDark` / `styleBreakpoints` /
 * `styleHoverBreakpoints` / `advanced` shallow-merge so callers can express
 * "set these specific keys, leave the rest alone".
 */
function fixtureConfig(
  type: SectionBlock["type"],
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const base = getDefaultBlockConfig(type);
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(overlay)) {
    const baseV = (base as Record<string, unknown>)[k];
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      baseV !== null &&
      typeof baseV === "object" &&
      !Array.isArray(baseV)
    ) {
      out[k] = { ...(baseV as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function makeBlock(
  type: SectionBlock["type"],
  overlay: Record<string, unknown>,
  id: string,
): SectionBlock {
  return { id, type, config: fixtureConfig(type, overlay) };
}

// ─── Per-block snapshots ─────────────────────────────────────────────────────

describe("parity snapshots — container (exhaustive every-key fixture)", () => {
  // Container carries the EXHAUSTIVE "every key non-empty" config. Every
  // STYLE_PROPS entry has a real value; hover, dark, breakpoint, and
  // breakpoint-hover all carry meaningful overrides; advanced has every
  // key non-empty (position + offsets + zIndex + customCss + cssId +
  // cssClasses). Mobile breakpoint exercises the visual + layout split,
  // tablet breakpoint exercises sort order (largest px first).
  it("emits the full CSS bundle covering every code path", () => {
    const block = makeBlock(
      "container",
      {
        style: {
          // Background (color mode)
          backgroundType: "color",
          backgroundColor: "#fafafa",
          backgroundColorAlpha: 0.9,
          // Padding (overrides the F3.6.1 12px design defaults)
          paddingTop: "16px", paddingRight: "20px", paddingBottom: "16px", paddingLeft: "20px",
          // Margin
          marginTop: "8px", marginRight: "0px", marginBottom: "8px", marginLeft: "0px",
          // Sizing
          width: "100%", minWidth: "240px", maxWidth: "1200px",
          height: "auto", minHeight: "120px", maxHeight: "800px",
          // Border radius
          borderTopLeftRadius: "8px", borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px", borderBottomLeftRadius: "8px",
          // Border width + style + color (drives auto overflow:hidden)
          borderTopWidth: "2px", borderRightWidth: "2px",
          borderBottomWidth: "2px", borderLeftWidth: "2px",
          borderStyle: "solid", borderColor: "#333333", borderAlpha: 1,
          // Overflow (explicit — disables auto overflow:hidden)
          overflowX: "hidden", overflowY: "auto",
          // Typography
          textAlign: "left",
          fontFamily: "Inter, sans-serif", fontSize: "16px", fontWeight: "500",
          textTransform: "none", fontStyle: "normal", textDecoration: "none",
          lineHeight: "1.5", letterSpacing: "0.01em", wordSpacing: "0.05em",
          color: "#111111", colorAlpha: 1,
          // Misc
          mixBlendMode: "normal",
          aspectRatio: "16/9",
          filter: "saturate(1.05)",
          // Shadow
          shadowX: "0px", shadowY: "4px", shadowBlur: "12px", shadowSpread: "0px",
          shadowColor: "#000000", shadowAlpha: 0.15, shadowType: "outset",
          // Text stroke
          textStrokeWidth: "1px", textStrokeColor: "#000000", textStrokeAlpha: 1,
          // Text shadow
          textShadowX: "0px", textShadowY: "1px", textShadowBlur: "2px",
          textShadowColor: "#000000", textShadowAlpha: 0.5,
          // Opacity
          opacity: 1,
        },
        styleHover: {
          backgroundType: "color",
          backgroundColor: "#f0f0f0",
          backgroundColorAlpha: 1,
          borderTopWidth: "3px", borderRightWidth: "3px",
          borderBottomWidth: "3px", borderLeftWidth: "3px",
          borderStyle: "solid", borderColor: "#000000", borderAlpha: 1,
          borderTopLeftRadius: "12px", borderTopRightRadius: "12px",
          borderBottomRightRadius: "12px", borderBottomLeftRadius: "12px",
          shadowX: "0px", shadowY: "8px", shadowBlur: "20px", shadowSpread: "0px",
          shadowColor: "#000000", shadowAlpha: 0.25, shadowType: "outset",
          opacity: 0.95,
        },
        styleDark: {
          backgroundType: "color",
          backgroundColor: "#1a1a1a",
          backgroundColorAlpha: 1,
          color: "#eeeeee", colorAlpha: 1,
          borderColor: "#444444", borderAlpha: 1,
          borderStyle: "solid",
        },
        styleBreakpoints: {
          "tablet-portrait": {
            _px: 992,
            fontSize: "15px",
            paddingTop: "12px", paddingRight: "16px", paddingBottom: "12px", paddingLeft: "16px",
            columnGap: "8px", rowGap: "8px",
            flexDirection: "row", flexWrap: "wrap",
            justifyContent: "flex-start", flexAlignItems: "stretch",
          },
          "mobile-portrait": {
            _px: 575,
            fontSize: "14px",
            paddingTop: "8px", paddingRight: "12px", paddingBottom: "8px", paddingLeft: "12px",
            color: "#222222", colorAlpha: 1,
            borderStyle: "solid", borderColor: "#cccccc", borderAlpha: 1,
            borderTopLeftRadius: "4px", borderTopRightRadius: "4px",
            borderBottomRightRadius: "4px", borderBottomLeftRadius: "4px",
            shadowX: "0px", shadowY: "2px", shadowBlur: "6px", shadowSpread: "0px",
            shadowColor: "#000000", shadowAlpha: 0.1, shadowType: "outset",
            textStrokeWidth: "0.5px", textStrokeColor: "#000000", textStrokeAlpha: 1,
            textShadowX: "0px", textShadowY: "1px", textShadowBlur: "2px",
            textShadowColor: "#000000", textShadowAlpha: 0.4,
            columnGap: "4px", rowGap: "4px",
            flexDirection: "column", flexWrap: "nowrap",
            justifyContent: "flex-start", flexAlignItems: "stretch",
          },
        },
        styleHoverBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            borderTopWidth: "4px", borderRightWidth: "4px",
            borderBottomWidth: "4px", borderLeftWidth: "4px",
            borderStyle: "solid", borderColor: "#000000", borderAlpha: 1,
            borderTopLeftRadius: "6px", borderTopRightRadius: "6px",
            borderBottomRightRadius: "6px", borderBottomLeftRadius: "6px",
            shadowX: "0px", shadowY: "4px", shadowBlur: "10px", shadowSpread: "0px",
            shadowColor: "#000000", shadowAlpha: 0.2, shadowType: "outset",
          },
        },
        advanced: {
          cssId: "hero-container",
          cssClasses: "hero hero--lg",
          customCss: "selector{transition:all 200ms ease}selector:hover{transform:translateY(-2px)}",
          position: "relative",
          top: "0px", right: "0px", bottom: "auto", left: "0px",
          zIndex: "10",
        },
      },
      "C1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="C1"]{background:rgba(250,250,250,0.9);border-style:solid;border-color:rgba(51,51,51,1);color:#111111;padding-top:16px;padding-right:20px;padding-bottom:16px;padding-left:20px;margin-top:8px;margin-right:0px;margin-bottom:8px;margin-left:0px;width:100%;min-width:240px;max-width:1200px;height:auto;min-height:120px;max-height:800px;border-top-left-radius:8px;border-top-right-radius:8px;border-bottom-right-radius:8px;border-bottom-left-radius:8px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px;overflow-x:hidden;overflow-y:auto;text-align:left;font-family:Inter, sans-serif;font-size:16px;font-weight:500;text-transform:none;font-style:normal;text-decoration:none;line-height:1.5;letter-spacing:0.01em;word-spacing:0.05em;mix-blend-mode:normal;aspect-ratio:16/9;filter:saturate(1.05);box-shadow:0px 4px 12px 0px rgba(0,0,0,0.15);-webkit-text-stroke-width:1px;-webkit-text-stroke-color:#000000;text-shadow:0px 1px 2px rgba(0,0,0,0.5);position:relative;top:0px;right:0px;bottom:auto;left:0px;z-index:10;opacity:1}:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="C1"],[data-epx-block="C1"][data-theme="dark"]{background:rgba(26,26,26,1);border-style:solid;border-color:rgba(68,68,68,1);color:#eeeeee}[data-epx-block="C1"]:hover{background:rgba(240,240,240,1) !important;border-style:solid !important;border-color:rgba(0,0,0,1) !important;box-shadow:0px 8px 20px 0px rgba(0,0,0,0.25) !important;border-top-left-radius:12px !important;border-top-right-radius:12px !important;border-bottom-right-radius:12px !important;border-bottom-left-radius:12px !important;border-top-width:3px !important;border-right-width:3px !important;border-bottom-width:3px !important;border-left-width:3px !important;opacity:0.95 !important}@media(max-width:992px){[data-epx-block="C1"]{font-size:15px;column-gap:8px;row-gap:8px;flex-direction:row;flex-wrap:wrap;justify-content:flex-start;align-items:stretch}}@media(max-width:575px){[data-epx-block="C1"]{border-style:solid;border-color:rgba(204,204,204,1);color:#222222;border-top-left-radius:4px;border-top-right-radius:4px;border-bottom-right-radius:4px;border-bottom-left-radius:4px;font-size:14px;box-shadow:0px 2px 6px 0px rgba(0,0,0,0.1);-webkit-text-stroke-width:0.5px;-webkit-text-stroke-color:#000000;text-shadow:0px 1px 2px rgba(0,0,0,0.4);column-gap:4px;row-gap:4px;flex-direction:column;flex-wrap:nowrap;justify-content:flex-start;align-items:stretch}}@media(max-width:575px){[data-epx-block="C1"]:hover{border-style:solid !important;border-color:rgba(0,0,0,1) !important;border-top-left-radius:6px !important;border-top-right-radius:6px !important;border-bottom-right-radius:6px !important;border-bottom-left-radius:6px !important;border-top-width:4px !important;border-right-width:4px !important;border-bottom-width:4px !important;border-left-width:4px !important;box-shadow:0px 4px 10px 0px rgba(0,0,0,0.2) !important}}[data-epx-block="C1"]{transition:all 200ms ease}[data-epx-block="C1"]:hover{transform:translateY(-2px)}"`);
  });
});

describe("parity snapshots — text", () => {
  it("emits typography + alignment + hover + dark + breakpoints", () => {
    const block = makeBlock(
      "text",
      {
        style: {
          textAlign: "center",
          fontFamily: "Georgia, serif",
          fontSize: "20px",
          fontWeight: "600",
          lineHeight: "1.4",
          letterSpacing: "0.02em",
          color: "#222222", colorAlpha: 1,
          textShadowX: "0px", textShadowY: "1px", textShadowBlur: "3px",
          textShadowColor: "#000000", textShadowAlpha: 0.3,
          textStrokeWidth: "0.5px", textStrokeColor: "#000000", textStrokeAlpha: 1,
          mixBlendMode: "normal",
        },
        styleHover: {
          color: "#000000", colorAlpha: 1,
        },
        styleDark: {
          color: "#f5f5f5", colorAlpha: 1,
        },
        styleBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            fontSize: "16px",
            textAlign: "left",
          },
        },
        advanced: {
          customCss: "selector{transition:color 150ms ease}",
        },
      },
      "T1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="T1"]{color:#222222;text-align:center;font-family:Georgia, serif;font-size:20px;font-weight:600;line-height:1.4;letter-spacing:0.02em;mix-blend-mode:normal;-webkit-text-stroke-width:0.5px;-webkit-text-stroke-color:#000000;text-shadow:0px 1px 3px rgba(0,0,0,0.3)}:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="T1"],[data-epx-block="T1"][data-theme="dark"]{color:#f5f5f5}@media(max-width:575px){[data-epx-block="T1"]{text-align:left;font-size:16px}}[data-epx-block="T1"]{transition:color 150ms ease}"`);
  });

  // Canvas-vs-frontend equality — locks `buildCanvasBlockCss(block, "desktop")`
  // against `buildBlockChromeCss(block.config, block.id)` at the chrome-CSS
  // level. Extends F3.6.3's "both call the same helper" by snapshotting the
  // full output, so a future helper that splits the path silently surfaces
  // here as well.
  it("buildCanvasBlockCss on desktop equals buildBlockChromeCss exactly", () => {
    const block = makeBlock(
      "text",
      {
        style: {
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          color: "#111111", colorAlpha: 1,
          textAlign: "left",
        },
        styleHover: { borderTopWidth: "1px" },
        styleDark: { color: "#eeeeee", colorAlpha: 1 },
        styleBreakpoints: {
          "mobile-portrait": { _px: 575, fontSize: "15px" },
        },
        styleHoverBreakpoints: {
          "mobile-portrait": { _px: 575, borderTopWidth: "2px" },
        },
        advanced: { customCss: "selector{cursor:default}" },
      },
      "TXT",
    );

    const canvas = buildCanvasBlockCss(block, "desktop");
    const frontend = buildBlockChromeCss(block.config, block.id);
    expect(canvas).toBe(frontend);
  });
});

describe("parity snapshots — image", () => {
  it("emits img-scoped chrome (border + radius on inner <img>) plus hover + bp", () => {
    const block = makeBlock(
      "image",
      {
        style: {
          // Image visual props target the inner <img> via imgScoped:true.
          // Border + radius travel with the <img>; the host root keeps
          // alignment + opacity only.
          borderTopLeftRadius: "8px", borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px", borderBottomLeftRadius: "8px",
          borderTopWidth: "2px", borderRightWidth: "2px",
          borderBottomWidth: "2px", borderLeftWidth: "2px",
          borderStyle: "solid", borderColor: "#333333", borderAlpha: 1,
          textAlign: "center",
          opacity: 0.95,
          aspectRatio: "16/9",
        },
        styleHover: {
          borderTopWidth: "3px", borderRightWidth: "3px",
          borderBottomWidth: "3px", borderLeftWidth: "3px",
          opacity: 1,
        },
        styleDark: {
          borderColor: "#888888", borderAlpha: 1,
        },
        styleBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            borderTopLeftRadius: "4px", borderTopRightRadius: "4px",
            borderBottomRightRadius: "4px", borderBottomLeftRadius: "4px",
          },
        },
      },
      "IMG1",
    );

    // imgScoped: true mirrors Image.astro's call.
    expect(
      buildBlockChromeCss(block.config, block.id, { imgScoped: true }),
    ).toMatchInlineSnapshot(`"[data-epx-block="IMG1"]{text-align:center;aspect-ratio:16/9;opacity:0.95}[data-epx-block="IMG1"]:hover{opacity:1 !important}@media(max-width:575px){[data-epx-block="IMG1"]{border-top-left-radius:4px;border-top-right-radius:4px;border-bottom-right-radius:4px;border-bottom-left-radius:4px}}[data-epx-block="IMG1"] img{border-style:solid;border-color:rgba(51,51,51,1);border-top-left-radius:8px;border-top-right-radius:8px;border-bottom-right-radius:8px;border-bottom-left-radius:8px;border-top-width:2px;border-right-width:2px;border-bottom-width:2px;border-left-width:2px}[data-epx-block="IMG1"]:hover img{border-top-width:3px !important;border-right-width:3px !important;border-bottom-width:3px !important;border-left-width:3px !important}"`);
  });
});

describe("parity snapshots — text-editor", () => {
  it("emits typography + paragraph spacing + hover + bp", () => {
    const block = makeBlock(
      "text-editor",
      {
        style: {
          textAlign: "left",
          fontFamily: "Lora, Georgia, serif",
          fontSize: "17px",
          lineHeight: "1.7",
          letterSpacing: "0.005em",
          color: "#1a1a1a", colorAlpha: 1,
          textShadowX: "0px", textShadowY: "1px", textShadowBlur: "2px",
          textShadowColor: "#000000", textShadowAlpha: 0.25,
        },
        styleHover: {},
        styleDark: { color: "#eaeaea", colorAlpha: 1 },
        styleBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            fontSize: "15px", lineHeight: "1.6",
          },
        },
      },
      "TE1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="TE1"]{color:#1a1a1a;text-align:left;font-family:Lora, Georgia, serif;font-size:17px;line-height:1.7;letter-spacing:0.005em;text-shadow:0px 1px 2px rgba(0,0,0,0.25)}:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="TE1"],[data-epx-block="TE1"][data-theme="dark"]{color:#eaeaea}@media(max-width:575px){[data-epx-block="TE1"]{font-size:15px;line-height:1.6}}"`);
  });
});

describe("parity snapshots — video", () => {
  it("emits aspect-ratio + filter + sizing chrome", () => {
    const block = makeBlock(
      "video",
      {
        style: {
          aspectRatio: "16/9",
          filter: "brightness(1.05) saturate(1.1)",
          borderTopLeftRadius: "8px", borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px", borderBottomLeftRadius: "8px",
          width: "100%", maxWidth: "960px",
        },
        styleHover: {
          borderTopWidth: "1px", borderRightWidth: "1px",
          borderBottomWidth: "1px", borderLeftWidth: "1px",
        },
        styleBreakpoints: {
          "mobile-portrait": { _px: 575, aspectRatio: "4/3" },
        },
      },
      "V1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="V1"]{width:100%;max-width:960px;border-top-left-radius:8px;border-top-right-radius:8px;border-bottom-right-radius:8px;border-bottom-left-radius:8px;aspect-ratio:16/9;filter:brightness(1.05) saturate(1.1)}[data-epx-block="V1"]:hover{border-top-width:1px !important;border-right-width:1px !important;border-bottom-width:1px !important;border-left-width:1px !important}@media(max-width:575px){[data-epx-block="V1"]{aspect-ratio:4/3}}"`);
  });
});

describe("parity snapshots — button", () => {
  it("emits typography + background + border-radius + border + box-shadow + hover", () => {
    const block = makeBlock(
      "button",
      {
        style: {
          backgroundType: "color",
          backgroundColor: "#3366ff", backgroundColorAlpha: 1,
          color: "#ffffff", colorAlpha: 1,
          fontFamily: "Inter, sans-serif",
          fontSize: "15px", fontWeight: "600",
          textAlign: "center", textTransform: "uppercase",
          letterSpacing: "0.05em",
          paddingTop: "10px", paddingRight: "20px",
          paddingBottom: "10px", paddingLeft: "20px",
          borderTopLeftRadius: "6px", borderTopRightRadius: "6px",
          borderBottomRightRadius: "6px", borderBottomLeftRadius: "6px",
          borderTopWidth: "1px", borderRightWidth: "1px",
          borderBottomWidth: "1px", borderLeftWidth: "1px",
          borderStyle: "solid", borderColor: "#3366ff", borderAlpha: 1,
          shadowX: "0px", shadowY: "2px", shadowBlur: "4px", shadowSpread: "0px",
          shadowColor: "#000000", shadowAlpha: 0.1, shadowType: "outset",
        },
        styleHover: {
          backgroundType: "color",
          backgroundColor: "#2856e6", backgroundColorAlpha: 1,
          borderColor: "#2856e6", borderAlpha: 1,
          shadowX: "0px", shadowY: "4px", shadowBlur: "8px", shadowSpread: "0px",
          shadowColor: "#000000", shadowAlpha: 0.15, shadowType: "outset",
        },
        styleDark: {
          backgroundType: "color",
          backgroundColor: "#5588ff", backgroundColorAlpha: 1,
        },
        styleBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            fontSize: "14px",
          },
        },
      },
      "BTN1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="BTN1"]{background:rgba(51,102,255,1);border-style:solid;border-color:rgba(51,102,255,1);color:#ffffff;padding-top:10px;padding-right:20px;padding-bottom:10px;padding-left:20px;border-top-left-radius:6px;border-top-right-radius:6px;border-bottom-right-radius:6px;border-bottom-left-radius:6px;border-top-width:1px;border-right-width:1px;border-bottom-width:1px;border-left-width:1px;text-align:center;font-family:Inter, sans-serif;font-size:15px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;box-shadow:0px 2px 4px 0px rgba(0,0,0,0.1);overflow:hidden}:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="BTN1"],[data-epx-block="BTN1"][data-theme="dark"]{background:rgba(85,136,255,1)}[data-epx-block="BTN1"]:hover{background:rgba(40,86,230,1) !important;box-shadow:0px 4px 8px 0px rgba(0,0,0,0.15) !important}@media(max-width:575px){[data-epx-block="BTN1"]{font-size:14px}}"`);
  });
});

describe("parity snapshots — icon", () => {
  it("emits alignment + sizing + opacity chrome", () => {
    const block = makeBlock(
      "icon",
      {
        style: {
          textAlign: "center",
          width: "32px", height: "32px",
          opacity: 0.85,
          filter: "saturate(0.9)",
        },
        styleHover: {
          opacity: 1,
        },
        styleDark: {},
        styleBreakpoints: {
          "mobile-portrait": { _px: 575, fontSize: "14px" },
        },
      },
      "ICN1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="ICN1"]{width:32px;height:32px;text-align:center;filter:saturate(0.9);opacity:0.85}[data-epx-block="ICN1"]:hover{opacity:1 !important}@media(max-width:575px){[data-epx-block="ICN1"]{font-size:14px}}"`);
  });
});

describe("parity snapshots — html", () => {
  it("emits sizing + position + advanced (cssId / cssClasses / customCss)", () => {
    const block = makeBlock(
      "html",
      {
        style: {
          width: "100%", minHeight: "200px",
          paddingTop: "16px", paddingRight: "16px",
          paddingBottom: "16px", paddingLeft: "16px",
        },
        advanced: {
          cssId: "embed-frame",
          cssClasses: "embed embed--full",
          customCss: "selector iframe{display:block;width:100%}",
          position: "relative",
          zIndex: "1",
        },
      },
      "HTM1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="HTM1"]{padding-top:16px;padding-right:16px;padding-bottom:16px;padding-left:16px;width:100%;min-height:200px;position:relative;z-index:1}[data-epx-block="HTM1"] iframe{display:block;width:100%}"`);
  });
});

describe("parity snapshots — divider-spacer", () => {
  it("emits height + alignment + bp height override", () => {
    const block = makeBlock(
      "divider-spacer",
      {
        style: {
          height: "48px",
          marginTop: "12px", marginBottom: "12px",
          textAlign: "center",
        },
        styleBreakpoints: {
          "mobile-portrait": {
            _px: 575,
            fontSize: "14px",
          },
        },
      },
      "DS1",
    );

    expect(buildBlockChromeCss(block.config, block.id)).toMatchInlineSnapshot(`"[data-epx-block="DS1"]{margin-top:12px;margin-bottom:12px;height:48px;text-align:center}@media(max-width:575px){[data-epx-block="DS1"]{font-size:14px}}"`);
  });
});
