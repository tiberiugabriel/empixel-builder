import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TabRenderer, getVisibleTabs, type Tab } from "../src/admin/right-panel/TabRenderer.js";
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

// All 9 known block types — kept in the same order as
// BLOCK_DEFINITIONS for sanity.
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

// ─── getVisibleTabs ───────────────────────────────────────────────────────────

describe("getVisibleTabs", () => {
  it("returns ['fields', 'advanced'] for an html block (Style hidden)", () => {
    const block = makeBlock("html", { code: "" });
    expect(getVisibleTabs(block)).toEqual(["fields", "advanced"]);
  });

  it("returns ['fields', 'style', 'advanced'] for text/image/container blocks (Style declared)", () => {
    for (const type of ["text", "image", "container"] as const) {
      const block = makeBlock(type);
      expect(getVisibleTabs(block)).toEqual(["fields", "style", "advanced"]);
    }
  });

  it("matches the F3.5.2 styleTab declaration matrix for all 9 blocks", () => {
    // Every block except `html` declares a non-empty styleTab → Style
    // tab visible. `html` omits styleTab → Style hidden.
    const expected: Record<BlockType, Tab[]> = {
      text:             ["fields", "style", "advanced"],
      image:            ["fields", "style", "advanced"],
      "text-editor":    ["fields", "style", "advanced"],
      video:            ["fields", "style", "advanced"],
      button:           ["fields", "style", "advanced"],
      icon:             ["fields", "style", "advanced"],
      html:             ["fields", "advanced"],
      "divider-spacer": ["fields", "style", "advanced"],
      container:        ["fields", "style", "advanced"],
    };
    for (const type of ALL_BLOCK_TYPES) {
      const block = makeBlock(type);
      expect(getVisibleTabs(block)).toEqual(expected[type]);
    }
  });

  it("returns ['fields', 'advanced'] for an unknown block type (no def found)", () => {
    // Unknown type — keep Fields tab visible so the host can render a
    // BlockErrorBoundary-style placeholder, plus the universal
    // Advanced tab. Style is omitted because there's no def to drive
    // it.
    const block: SectionBlock = {
      id: "test-block",
      // @ts-expect-error — passing an unknown block type on purpose
      type: "not-a-real-block",
      config: {},
    };
    expect(getVisibleTabs(block)).toEqual(["fields", "advanced"]);
  });

  it("Advanced is always present and always last", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const block = makeBlock(type);
      const visible = getVisibleTabs(block);
      expect(visible).toContain("advanced");
      expect(visible[visible.length - 1]).toBe("advanced");
    }
  });

  it("Fields comes before Style (when both visible)", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const block = makeBlock(type);
      const visible = getVisibleTabs(block);
      const fi = visible.indexOf("fields");
      const si = visible.indexOf("style");
      if (si !== -1) {
        expect(fi).toBeLessThan(si);
      }
    }
  });
});

// ─── TabRenderer smoke render ─────────────────────────────────────────────────

describe("TabRenderer", () => {
  it("renders a non-empty body for every block type x active tab", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const block = makeBlock(type);
      const visible = getVisibleTabs(block);
      for (const tab of visible) {
        const html = renderToStaticMarkup(
          createElement(TabRenderer, {
            block,
            activeTab: tab,
            onTabChange: () => {},
            onChange: () => {},
            activeBreakpoint: "desktop",
          }),
        );
        expect(typeof html).toBe("string");
        // Every render at minimum emits the tab header buttons.
        expect(html).toContain("epx-right-panel__tabs");
        expect(html).toContain("epx-right-panel__tab");
      }
    }
  });

  it("Advanced tab renders the universal AdvancedTab component (F3.5.5)", () => {
    // F3.5.5 replaced the F3.5.4 placeholder with `<AdvancedTab />`.
    // The body should expose the universal Advanced controls (Custom CSS
    // header is the easiest sentinel — it's always rendered regardless
    // of position state).
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(TabRenderer, {
        block,
        activeTab: "advanced",
        onTabChange: () => {},
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).not.toContain('data-testid="advanced-placeholder"');
    expect(html).toContain("Custom CSS");
    expect(html).toContain("CSS ID");
    expect(html).toContain("CSS Classes");
    expect(html).toContain("Z-Index");
  });

  it("Style tab is omitted from header for html block", () => {
    const block = makeBlock("html", { code: "<p>hi</p>" });
    const html = renderToStaticMarkup(
      createElement(TabRenderer, {
        block,
        activeTab: "fields",
        onTabChange: () => {},
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    // Only Fields + Advanced buttons should appear.
    const tabBtnCount = (html.match(/<button[^>]*class="epx-right-panel__tab[^s]/g) ?? []).length;
    expect(tabBtnCount).toBe(2);
    expect(html).toContain('title="Fields"');
    expect(html).toContain('title="Advanced"');
    expect(html).not.toContain('title="Style"');
  });

  it("Style tab is present in the header for non-html blocks", () => {
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(TabRenderer, {
        block,
        activeTab: "fields",
        onTabChange: () => {},
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    const tabBtnCount = (html.match(/<button[^>]*class="epx-right-panel__tab[^s]/g) ?? []).length;
    expect(tabBtnCount).toBe(3);
    expect(html).toContain('title="Style"');
  });

  it("active tab gets the is-active class", () => {
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(TabRenderer, {
        block,
        activeTab: "style",
        onTabChange: () => {},
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toMatch(/epx-right-panel__tab is-active[^"]*"\s+title="Style"/);
  });

  it("Style body renders SectionRenderer output for each declared section", () => {
    // text block declares 5 styleTab entries (alignment / typography /
    // textStroke / textShadow / blendMode). The body must produce
    // non-empty HTML — at minimum the wrapper div.
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(TabRenderer, {
        block,
        activeTab: "style",
        onTabChange: () => {},
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toContain("epx-right-panel__style");
  });
});
