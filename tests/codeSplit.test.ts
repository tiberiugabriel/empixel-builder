import { describe, it, expect } from "vitest";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdvancedTab } from "../src/admin/right-panel/AdvancedTab.js";
import { SectionRenderer } from "../src/admin/right-panel/SectionRenderer.js";
import { FieldRenderer } from "../src/admin/fields/FieldRenderer.js";
import type { BlockType, SectionBlock } from "../src/types.js";

/**
 * F4.3 — code-split smoke tests.
 *
 * `RightPanel`, `BackgroundControl`, and `CodeEditor` are now wrapped
 * in `React.lazy(...)`. SSR via `react-dom/server` cannot resolve the
 * dynamic `import()` synchronously, so the Suspense fallback renders
 * instead of the lazy body. These tests pin two contracts:
 *
 * 1. The lazy boundary doesn't crash when SSR'd (no missing-default
 *    errors, no thrown promises bubbling out of the renderer).
 * 2. Each fallback emits the documented `epx-*--loading` placeholder
 *    class so the host bundle CSS can dimension-match the slot and
 *    avoid layout shift while the chunk fetches.
 *
 * The boundaries themselves are owned by:
 * - `Builder.tsx` for `RightPanel` (already covered by the existing
 *   `rightPanel.test.ts` SSR check; Builder isn't SSR'd in tests).
 * - `BackgroundSection.tsx` for `BackgroundControl`.
 * - `AdvancedTab.tsx` and `fields/FieldRenderer.tsx` for `CodeEditor`.
 */

function makeBlock(type: BlockType, extra: Record<string, unknown> = {}): SectionBlock {
  return {
    id: `cs-${type}`,
    type,
    config: { theme: "light", style: {}, ...extra },
  };
}

/**
 * Walk a React element tree and find an element matching a predicate.
 * The Suspense fallback may sit several levels deep depending on the
 * section wrapper; this lets the assertion stay structural rather than
 * tied to a specific HTML emission.
 */
function findFirst(
  node: ReactNode,
  predicate: (el: ReactElement) => boolean,
): ReactElement | undefined {
  let found: ReactElement | undefined;
  function visit(n: ReactNode): void {
    if (found) return;
    if (n === null || n === undefined || typeof n === "boolean") return;
    if (Array.isArray(n)) {
      for (const child of n) visit(child);
      return;
    }
    if (!isValidElement(n)) return;
    if (predicate(n)) {
      found = n;
      return;
    }
    const props = n.props as { children?: ReactNode } | null;
    if (props?.children !== undefined) visit(props.children);
  }
  visit(node);
  return found;
}

// ─── CodeEditor lazy boundary — Advanced tab ─────────────────────────────────

describe("F4.3 — CodeEditor lazy boundary in AdvancedTab", () => {
  it("SSR renders the loading fallback without throwing", () => {
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(AdvancedTab, {
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toContain("epx-code-editor--loading");
    expect(html).toContain('aria-busy="true"');
  });

  it("emits the `Custom CSS` label even though the editor body is deferred", () => {
    const block = makeBlock("text");
    const html = renderToStaticMarkup(
      createElement(AdvancedTab, {
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toContain("Custom CSS");
  });
});

// ─── CodeEditor lazy boundary — Fields tab `code` renderer ───────────────────

describe("F4.3 — CodeEditor lazy boundary in FieldRenderer (code field)", () => {
  it("SSR renders the loading fallback without throwing", () => {
    // The `html` block declares a `code`-type Fields entry (Custom HTML).
    const html = renderToStaticMarkup(
      createElement(FieldRenderer, {
        field: {
          key: "html",
          type: "code",
          label: "Custom HTML",
          language: "html",
        },
        value: "<p>hi</p>",
        onChange: () => {},
      }),
    );
    expect(html).toContain("epx-code-editor--loading");
    expect(html).toContain("Custom HTML");
  });
});

// ─── BackgroundSection lazy boundary — SectionRenderer dispatch ──────────────

describe("F4.3 — BackgroundSection lazy boundary in SectionRenderer", () => {
  it("SSR renders the loading fallback when SectionRenderer dispatches `kind: \"background\"`", () => {
    // The boundary lives at the SectionRenderer level — the entire
    // BackgroundSection chunk (which transitively pulls in
    // BackgroundControl + parseBackground/serializeBackground +
    // ColorPicker + MediaPicker) defers until the user opens a
    // Style-tab `background` section. SSR can't resolve the lazy
    // import, so the fallback markup is what should land in the
    // initial paint.
    const block = makeBlock("container", { style: {} });
    const html = renderToStaticMarkup(
      createElement(SectionRenderer, {
        section: { kind: "background" },
        block,
        onChange: () => {},
        activeBreakpoint: "desktop",
      }),
    );
    expect(html).toContain("epx-bg-ctrl--loading");
    expect(html).toContain('aria-busy="true"');
  });
});

// ─── Tree-walk reachability ──────────────────────────────────────────────────

describe("F4.3 — lazy elements are reachable as React elements", () => {
  it("AdvancedTab tree contains a lazy CodeEditor element with `language: \"css\"`", () => {
    const tree = AdvancedTab({
      block: makeBlock("text"),
      onChange: () => {},
      activeBreakpoint: "desktop",
    });
    const lazyEditor = findFirst(tree, (el) => {
      const p = el.props as { language?: unknown; selectorHeader?: unknown };
      return p.language === "css" && typeof p.selectorHeader === "string";
    });
    expect(lazyEditor).toBeDefined();
  });
});
