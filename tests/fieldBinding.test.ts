/**
 * F4.4 — `field-binding` block type.
 *
 * Coverage:
 *  - `getBlockDef("field-binding")` returns a populated BlockDef with
 *    `field` + `as` Fields, the canonical Style stack (alignment +
 *    typography + textStroke + textShadow + blendMode), and the full
 *    `defaultConfig` shape (matches every other block).
 *  - `FieldBindingPreview` renders a `<bound: …>` badge when
 *    `config.field` is set, an `<unbound>` badge otherwise.
 *  - `LeftPanel` renders a "Bound to this entry" palette section when
 *    `entryFields` is non-empty + `onAddFieldBinding` is provided. The
 *    section disappears when either prop is missing/empty.
 *  - `BlockRenderer.astro` dispatches the new type — asserted by
 *    grepping the file content for the new branch (Astro components
 *    don't run under vitest natively, same approach the rest of the
 *    suite uses for cross-file dispatch parity).
 *  - `defaultAsForField` mapping: `title` → `h1`, `excerpt` → `p`,
 *    everything else → `p`.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getBlockDef, BLOCK_DEFINITIONS } from "../src/admin/blockDefinitions.js";
import { FieldBindingPreview } from "../src/admin/previews/FieldBindingPreview.js";
import { PREVIEW_COMPONENTS } from "../src/admin/previews/index.js";
import { LeftPanel, defaultAsForField } from "../src/admin/LeftPanel.js";
import { DEFAULT_BREAKPOINTS_CONFIG } from "../src/types.js";
import { DndContext } from "@dnd-kit/core";

// ─── BlockDef ─────────────────────────────────────────────────────────────────

describe("F4.4 — `field-binding` BlockDef", () => {
  it("`getBlockDef('field-binding')` returns a populated BlockDef", () => {
    const def = getBlockDef("field-binding");
    expect(def).toBeDefined();
    expect(def!.type).toBe("field-binding");
    expect(def!.label).toBe("Bound field");
    expect(def!.category).toBe("core");
    expect(typeof def!.icon).toBe("string");
    expect(typeof def!.description).toBe("string");
  });

  it("declares two Fields-tab entries: `field` (text) + `as` (select)", () => {
    const def = getBlockDef("field-binding")!;
    expect(def.fieldsTab).toBeDefined();
    expect(def.fieldsTab!.length).toBe(2);
    const field = def.fieldsTab![0] as { kind?: string; key: string; type: string };
    const as = def.fieldsTab![1] as {
      kind?: string;
      key: string;
      type: string;
      options?: Array<{ value: string; label: string }>;
    };
    expect(field.key).toBe("field");
    expect(field.type).toBe("text");
    expect(as.key).toBe("as");
    expect(as.type).toBe("select");
    expect(Array.isArray(as.options)).toBe(true);
    // `p` is the canonical default tag — present in the option list.
    expect(as.options!.some((o) => o.value === "p")).toBe(true);
  });

  it("declares the `text`-style Style-tab stack (5 sections)", () => {
    // Spec: alignment + typography + textStroke + textShadow + blendMode.
    const def = getBlockDef("field-binding")!;
    expect(def.styleTab).toBeDefined();
    expect(def.styleTab!.length).toBe(5);
    const kinds = def.styleTab!.map((s) => s.kind).sort();
    expect(kinds).toEqual(
      ["alignment", "blendMode", "textShadow", "textStroke", "typography"].sort(),
    );
  });

  it("`defaultConfig` carries `field: \"\"`, `as: \"p\"`, and the canonical structural shape", () => {
    const def = getBlockDef("field-binding")!;
    const cfg = def.defaultConfig;
    expect(cfg.field).toBe("");
    expect(cfg.as).toBe("p");
    expect(cfg.theme).toBe("light");
    expect(cfg).toHaveProperty("style");
    expect(cfg).toHaveProperty("styleHover");
    expect(cfg).toHaveProperty("styleDark");
    expect(cfg).toHaveProperty("styleHoverDark");
    expect(cfg).toHaveProperty("styleBreakpoints");
    expect(cfg).toHaveProperty("styleHoverBreakpoints");
    expect(cfg).toHaveProperty("styleBreakpointsHoverDark");
    expect(cfg).toHaveProperty("advanced");
  });

  it("`field-binding` is registered in BLOCK_DEFINITIONS exactly once", () => {
    const matches = BLOCK_DEFINITIONS.filter((d) => d.type === "field-binding");
    expect(matches).toHaveLength(1);
  });

  it("PREVIEW_COMPONENTS map binds `field-binding` to the real preview (no stub)", () => {
    expect(PREVIEW_COMPONENTS["field-binding"]).toBe(FieldBindingPreview);
  });
});

// ─── Preview ─────────────────────────────────────────────────────────────────

describe("F4.4 — FieldBindingPreview", () => {
  it("renders `<bound: title>` when `config.field` is set", () => {
    const html = renderToStaticMarkup(
      createElement(FieldBindingPreview, { config: { field: "title" } }),
    );
    expect(html).toContain("&lt;bound: title&gt;");
  });

  it("renders `<unbound>` when `config.field` is empty", () => {
    const html = renderToStaticMarkup(
      createElement(FieldBindingPreview, { config: { field: "" } }),
    );
    expect(html).toContain("&lt;unbound&gt;");
  });

  it("renders `<unbound>` when `config.field` is missing", () => {
    const html = renderToStaticMarkup(
      createElement(FieldBindingPreview, { config: {} }),
    );
    expect(html).toContain("&lt;unbound&gt;");
  });

  it("trims whitespace-only field names to `<unbound>`", () => {
    const html = renderToStaticMarkup(
      createElement(FieldBindingPreview, { config: { field: "   " } }),
    );
    expect(html).toContain("&lt;unbound&gt;");
  });

  it("zeros browser-default margin so spacing comes from the wrapping data-epx-block div", () => {
    const html = renderToStaticMarkup(
      createElement(FieldBindingPreview, { config: { field: "title" } }),
    );
    expect(html).toContain("margin:0");
  });
});

// ─── defaultAsForField ──────────────────────────────────────────────────────

describe("F4.4 — defaultAsForField mapping", () => {
  it("maps `title` to `h1`", () => {
    expect(defaultAsForField("title")).toBe("h1");
  });
  it("maps `excerpt` to `p`", () => {
    expect(defaultAsForField("excerpt")).toBe("p");
  });
  it("falls through to `p` for unknown field names", () => {
    expect(defaultAsForField("body")).toBe("p");
    expect(defaultAsForField("image")).toBe("p");
    expect(defaultAsForField("slug")).toBe("p");
    expect(defaultAsForField("")).toBe("p");
  });
});

// ─── LeftPanel — "Bound to this entry" palette section ──────────────────────

describe("F4.4 — LeftPanel `Bound to this entry` palette", () => {
  function renderPanel(props: Partial<Parameters<typeof LeftPanel>[0]> = {}): string {
    // `useDraggable` requires a DndContext. The test panel just needs
    // SSR markup — no drag interactions exercised here.
    return renderToStaticMarkup(
      createElement(
        DndContext,
        null,
        createElement(LeftPanel, {
          onAddBlock: () => {},
          breakpointsConfig: DEFAULT_BREAKPOINTS_CONFIG,
          onBreakpointsChange: () => {},
          ...props,
        }),
      ),
    );
  }

  it("renders the section header + a card per field when `entryFields` is non-empty", () => {
    const html = renderPanel({
      entryFields: ["title", "slug", "id"],
      onAddFieldBinding: () => {},
    });
    expect(html).toContain("Bound to this entry");
    expect(html).toContain(">title<");
    expect(html).toContain(">slug<");
    expect(html).toContain(">id<");
  });

  it("hides the section when `entryFields` is missing", () => {
    const html = renderPanel({ onAddFieldBinding: () => {} });
    expect(html).not.toContain("Bound to this entry");
  });

  it("hides the section when `entryFields` is an empty array", () => {
    const html = renderPanel({
      entryFields: [],
      onAddFieldBinding: () => {},
    });
    expect(html).not.toContain("Bound to this entry");
  });

  it("hides the section when `onAddFieldBinding` is missing", () => {
    const html = renderPanel({ entryFields: ["title"] });
    expect(html).not.toContain("Bound to this entry");
  });

  it("filters the generic `field-binding` card out of the Core section", () => {
    // The standard Core section enumerates every BlockDef whose
    // category is "core". `field-binding` is filtered out so it
    // doesn't double-render alongside the bound-fields palette.
    const html = renderPanel({
      entryFields: ["title"],
      onAddFieldBinding: () => {},
    });
    // The Core header is present because container/html/divider-spacer
    // still live there.
    expect(html).toContain(">Core<");
    // The generic "Bound field" card label is absent.
    expect(html).not.toContain(">Bound field<");
  });
});

// ─── BlockRenderer.astro dispatch — file-content probe ──────────────────────

describe("F4.4 — BlockRenderer.astro dispatches `field-binding`", () => {
  it("contains the `block.type === \"field-binding\"` branch + `<FieldBinding ... />` invocation", () => {
    // Astro components don't run under vitest natively, so we probe
    // the source file directly. Mirrors the F3.6.7 parity strategy
    // (snapshot-style assertions on file content). If the dispatch
    // ever drifts (renamed type literal, removed branch), this fires.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/BlockRenderer.astro"),
      "utf8",
    );
    expect(src).toContain('block.type === "field-binding"');
    expect(src).toContain("<FieldBinding");
    // The `entry` prop is plumbed through so the matching `.astro`
    // component can read `entry.data[config.field]` +
    // `entry.edit?.[config.field]`.
    expect(src).toContain("entry={entry}");
  });

  it("`components/index.ts` exposes FieldBinding via blockComponents", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/index.ts"),
      "utf8",
    );
    expect(src).toContain('"field-binding": FieldBinding');
    expect(src).toContain('import FieldBinding from "./FieldBinding.astro"');
  });

  it("`FieldBinding.astro` reads `entry.data[config.field]` + spreads `entry.edit?[config.field]`", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/FieldBinding.astro"),
      "utf8",
    );
    expect(src).toContain("entry.data[fieldKey]");
    expect(src).toContain("entry.edit");
    // Tag whitelist guards against `<script>` etc.
    expect(src).toContain("ALLOWED_TAGS");
    // 1.0.0 P0 fix — F4.1 was reverted: each block component emits
    // its own inline `<style is:global>` again. The previous F4.1
    // collect-then-IIFE-drain pattern via `Astro.locals.empixelLayoutCss`
    // didn't reliably see child-side pushes, so the bundled style came
    // out empty and frontend pages rendered with zero plugin CSS.
    expect(src).toContain("buildBlockChromeCss");
    expect(src).toContain("<style set:html={allCss} is:global />");
    // The reverted-from F4.1 push pattern must NOT come back without a
    // redo with a reliable mechanism — guard against accidental
    // re-adoption.
    expect(src).not.toContain("empixelLayoutCss");
  });
});

// ─── F4.4 follow-up: entry plumb-through (B → BuilderWrapper → LayoutRenderer → BlockRenderer) ──

describe("F4.4 follow-up — entry plumb-through", () => {
  // Astro components don't run under vitest natively, so we probe the
  // source files directly. Same approach as the F4.4 dispatch probes
  // above (which assert the BlockRenderer side); these probes lock the
  // upstream plumbing so a regression on any of the three components
  // breaks loudly.

  it("`BuilderWrapper.astro` accepts an optional `entry` prop and forwards it to LayoutRenderer", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/BuilderWrapper.astro"),
      "utf8",
    );
    // Prop declared on the wrapper.
    expect(src).toContain("entry?: BuilderEntryRef");
    // Destructured from Astro.props.
    expect(src).toMatch(/const\s*{[^}]*entry[^}]*}\s*=\s*Astro\.props/);
    // Forwarded to the LayoutRenderer.
    expect(src).toContain("<LayoutRenderer");
    expect(src).toContain("entry={entry}");
  });

  it("`LayoutRenderer.astro` accepts an optional `entry` prop and forwards it to BlockRenderer", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/LayoutRenderer.astro"),
      "utf8",
    );
    expect(src).toContain("entry?: BuilderEntryRef");
    expect(src).toMatch(/const\s*{[^}]*entry[^}]*}\s*=\s*Astro\.props/);
    // Forwarded to BlockRenderer for every leaf — the dispatch on the
    // BlockRenderer side picks which branch (today: `field-binding`
    // only) actually consumes it.
    expect(src).toContain("<BlockRenderer block={block} entry={entry}");
  });

  it("`BlockRenderer.astro` types `entry` via the shared `BuilderEntryRef` shape", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      resolve(here, "../src/components/BlockRenderer.astro"),
      "utf8",
    );
    expect(src).toContain("interface BuilderEntryRef");
    expect(src).toContain("entry?: BuilderEntryRef");
    // The `field-binding` dispatch is still the sole consumer.
    expect(src).toContain('block.type === "field-binding"');
    expect(src).toContain("entry={entry}");
  });

  it("`BuilderEntryRef` shape is consistent across all four files (KISS — inline duplication, four sites)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      "../src/components/BuilderWrapper.astro",
      "../src/components/LayoutRenderer.astro",
      "../src/components/BlockRenderer.astro",
      "../src/components/FieldBinding.astro",
    ];
    for (const rel of files) {
      const src = readFileSync(resolve(here, rel), "utf8");
      // Each file declares the same inline interface. If we add a 5th
      // consumer, lift to a shared module — until then, four
      // inline copies is cheaper than the import overhead.
      expect(src).toContain("interface BuilderEntryRef");
      expect(src).toContain("data?: Record<string, unknown>");
      expect(src).toContain("edit?: Record<string, unknown>");
    }
  });
});
