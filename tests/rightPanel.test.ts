import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RightPanel } from "../src/admin/RightPanel.js";
import { getVisibleTabs, type Tab } from "../src/admin/right-panel/TabRenderer.js";
import { getBlockDef } from "../src/admin/blockDefinitions.js";
import type { BlockType, SectionBlock } from "../src/types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBlock(type: BlockType, extra: Record<string, unknown> = {}): SectionBlock {
  return {
    id: `test-${type}`,
    type,
    config: {
      theme: "light",
      style: {},
      ...extra,
    },
  };
}

const ALL_BLOCK_TYPES: BlockType[] = [
  "text",
  "image",
  "text-editor",
  "video",
  "button",
  "icon",
  "html",
  "divider-spacer",
  "container",
];

function renderPanel(block: SectionBlock | null): string {
  return renderToStaticMarkup(
    createElement(RightPanel, {
      block,
      onChange: () => {},
      activeBreakpoint: "desktop",
      breakpointsConfig: { overrides: [] },
    }),
  );
}

// ─── F3.5.6 — declarative-pipeline dispatch ──────────────────────────────────

describe("F3.5.6 — RightPanel renders through the declarative pipeline", () => {
  it("renders the empty placeholder when no block is selected", () => {
    const html = renderPanel(null);
    expect(html).toContain("epx-right-panel--empty");
    expect(html).toContain("Select a block on the canvas");
  });

  it("renders the unknown-block panel for an unregistered block type", () => {
    const block: SectionBlock = {
      id: "orphan",
      // @ts-expect-error — unknown block type on purpose
      type: "not-a-real-block",
      config: { advanced: { cssId: "my-id", cssClasses: "foo bar" } },
    };
    const html = renderPanel(block);
    expect(html).toContain("Unknown block");
    expect(html).toContain("my-id");
    expect(html).toContain("foo bar");
    // No tab shell for orphan blocks.
    expect(html).not.toContain("epx-right-panel__tabs");
  });

  it("renders the block-def header (icon + label + description) for every known block", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const def = getBlockDef(type)!;
      const html = renderPanel(makeBlock(type));
      expect(html).toContain(def.label);
      expect(html).toContain(def.description);
    }
  });

  it("emits exactly the tab buttons returned by getVisibleTabs(block)", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const block = makeBlock(type);
      const visible = getVisibleTabs(block);
      const html = renderPanel(block);
      // Tab buttons include each visible title.
      for (const tab of visible) {
        const title = tab === "fields" ? "Fields" : tab === "style" ? "Style" : "Advanced";
        expect(html).toContain(`title="${title}"`);
      }
      // And only those.
      const otherTab: Tab | undefined = (["fields", "style", "advanced"] as Tab[]).find(
        (t) => !visible.includes(t),
      );
      if (otherTab) {
        const title = otherTab === "fields" ? "Fields" : otherTab === "style" ? "Style" : "Advanced";
        expect(html).not.toContain(`title="${title}"`);
      }
    }
  });

  it("html block omits the Style tab (replaces hideStyleTab gate)", () => {
    const html = renderPanel(makeBlock("html", { code: "<p>hi</p>" }));
    expect(html).toContain('title="Fields"');
    expect(html).toContain('title="Advanced"');
    expect(html).not.toContain('title="Style"');
  });

  it("starts on Fields when the block declares one", () => {
    const html = renderPanel(makeBlock("text"));
    // The Fields tab button gets the is-active class.
    expect(html).toMatch(/epx-right-panel__tab is-active[^"]*"\s+title="Fields"/);
  });

  it("Fields body smoke-renders for every block (no crash, non-empty)", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const html = renderPanel(makeBlock(type));
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
      expect(html).toContain("epx-right-panel__fields");
    }
  });
});

// ─── Per-block Fields-tab dispatch sentinels ─────────────────────────────────
//
// One spot-check per block confirms the right declarative entry runs.
// These are NOT visual-parity tests (F3.5.7 owns that) — they catch
// "the dispatch silently dropped this block's content" regressions.

describe("F3.5.6 — Fields-tab dispatch sentinels", () => {
  it("text block renders the HTML Tag select (TextFieldsExtras)", () => {
    const html = renderPanel(makeBlock("text"));
    expect(html).toContain("HTML Tag");
  });

  it("image block renders the ImagePreviewCard + Resolution + LinkControl (ImageFieldsSection)", () => {
    const html = renderPanel(makeBlock("image"));
    expect(html).toContain("Resolution");
  });

  it("text-editor block renders the Drop Cap toggle + Columns selector (TextEditorFieldsSection)", () => {
    const html = renderPanel(makeBlock("text-editor"));
    expect(html).toContain("Drop Cap");
    expect(html).toContain("Columns");
  });

  it("video block renders the VideoSourceControl + Image Overlay (VideoFieldsSection)", () => {
    const html = renderPanel(makeBlock("video"));
    expect(html).toContain("Image Overlay");
  });

  it("button block renders the LinkControl (LinkFieldsSection)", () => {
    const html = renderPanel(makeBlock("button"));
    // LinkControl renders an `Add link` button when collapsed.
    expect(html.toLowerCase()).toContain("link");
  });

  it("icon block renders the LinkControl (LinkFieldsSection)", () => {
    const html = renderPanel(makeBlock("icon"));
    expect(html.toLowerCase()).toContain("link");
  });

  it("container block renders the LayoutControl + GapControl (ContainerLayoutPicker)", () => {
    const html = renderPanel(makeBlock("container"));
    expect(html).toContain("HTML Tag");
  });

  it("divider-spacer block renders the Space field; divider-line picker is now in Style", () => {
    const html = renderPanel(makeBlock("divider-spacer"));
    expect(html).toContain("Space");
  });

  it("html block renders the code editor field", () => {
    const html = renderPanel(makeBlock("html", { code: "" }));
    // CodeEditor textarea + selector header sentinel.
    expect(html).toContain("HTML");
  });
});

// ─── Style-tab dispatch sentinels ────────────────────────────────────────────

describe("F3.5.6 — Style-tab dispatch sentinels", () => {
  // Use the panel directly with the activeTab pre-snapped via the
  // visible-tab fall-through. We render via TabRenderer through the
  // panel — first tab change happens server-side on the smoke render,
  // so to inspect the Style body we need to pass the block in a state
  // where Fields is empty. KISS: import TabRenderer and invoke it with
  // activeTab="style".
  it.each(ALL_BLOCK_TYPES.filter((t) => t !== "html"))(
    "%s block has a non-empty Style body",
    async (type) => {
      const { TabRenderer } = await import("../src/admin/right-panel/TabRenderer.js");
      const block = makeBlock(type);
      const html = renderToStaticMarkup(
        createElement(TabRenderer, {
          block,
          activeTab: "style",
          onTabChange: () => {},
          onChange: () => {},
          activeBreakpoint: "desktop",
        }),
      );
      // Every non-html block has a styleTab — body wrapper must render.
      expect(html).toContain("epx-right-panel__style");
      expect(html.length).toBeGreaterThan(200);
    },
  );
});

// ─── Advanced-tab dispatch ───────────────────────────────────────────────────

describe("F3.5.6 — Advanced-tab dispatch", () => {
  it("Advanced body smoke-renders for every block via TabRenderer", async () => {
    const { TabRenderer } = await import("../src/admin/right-panel/TabRenderer.js");
    for (const type of ALL_BLOCK_TYPES) {
      const html = renderToStaticMarkup(
        createElement(TabRenderer, {
          block: makeBlock(type),
          activeTab: "advanced",
          onTabChange: () => {},
          onChange: () => {},
          activeBreakpoint: "desktop",
        }),
      );
      expect(html).toContain("Custom CSS");
      expect(html).toContain("CSS ID");
      expect(html).toContain("Z-Index");
    }
  });
});

// ─── Branch-elimination guards ───────────────────────────────────────────────
//
// Strict regressions: if F3.5.6's edits ever drift back, these tests
// surface the break before the next phase boundary.

describe("F3.5.6 — branch-elimination guards", () => {
  it("RightPanel module exports a single component + PanelDivider re-export", async () => {
    const mod = await import("../src/admin/RightPanel.js");
    expect(typeof mod.RightPanel).toBe("function");
    expect(typeof mod.PanelDivider).toBe("function");
  });

  it("Every block-def's fieldsTab + styleTab is internally consistent", () => {
    // Sanity — a block that declares a non-`custom` Style entry must
    // have the matching SectionRenderer support today.
    const validKinds = new Set([
      "theme",
      "spacing",
      "background",
      "border",
      "borderRadius",
      "boxShadow",
      "typography",
      "textStroke",
      "textShadow",
      "alignment",
      "blendMode",
      "filter",
      "overflow",
      "opacity",
      "imgVisual",
      "videoSource",
      "iconGroup",
      "dividerLine",
      "custom",
    ]);
    for (const type of ALL_BLOCK_TYPES) {
      const def = getBlockDef(type)!;
      for (const section of def.styleTab ?? []) {
        expect(validKinds.has(section.kind)).toBe(true);
      }
      for (const field of def.fieldsTab ?? def.fields ?? []) {
        if (field.kind === "custom") {
          expect(typeof field.render).toBe("function");
        } else {
          expect(typeof field.label).toBe("string");
          expect(typeof field.type).toBe("string");
        }
      }
    }
  });
});
