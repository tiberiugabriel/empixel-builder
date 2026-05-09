import { describe, it, expect } from "vitest";
import {
  BLOCK_DEFINITIONS,
  getBlockDef,
  type BlockDef,
  type StyleSection,
  type SectionRenderProps,
  type BackgroundMode,
  type TypographyProp,
} from "../src/admin/blockDefinitions.js";

describe("BLOCK_DEFINITIONS", () => {
  it("contains the 9 known block types", () => {
    const types = BLOCK_DEFINITIONS.map((d) => d.type).sort();
    expect(types).toEqual(
      [
        "button",
        "container",
        "divider-spacer",
        "html",
        "icon",
        "image",
        "text",
        "text-editor",
        "video",
      ].sort(),
    );
  });

  it("every entry exposes fields, label, icon, defaultConfig, category", () => {
    for (const def of BLOCK_DEFINITIONS) {
      expect(typeof def.label).toBe("string");
      expect(typeof def.icon).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(["core", "general"]).toContain(def.category);
      expect(typeof def.defaultConfig).toBe("object");
      expect(Array.isArray(def.fields)).toBe(true);
    }
  });
});

describe("getBlockDef", () => {
  it("returns the registered def for a known type", () => {
    const def = getBlockDef("text");
    expect(def?.type).toBe("text");
    expect(def?.label).toBe("Text");
  });

  it("returns undefined for an unknown type", () => {
    // @ts-expect-error — passing an unknown block type on purpose
    expect(getBlockDef("not-a-real-block")).toBeUndefined();
  });

  it("exposes fieldsTab on every block (F3.5.2 — every entry now declares it directly)", () => {
    // F3.5.1 set up an alias from `fields` when an entry didn't declare
    // `fieldsTab`. F3.5.2 makes the declaration explicit on each of the
    // 9 entries — `def.fieldsTab` and `def.fields` MUST point at the
    // same array (alias contract preserved for `getBlockDef` / reducer
    // / RightPanel callers reading either property).
    for (const type of [
      "container",
      "text",
      "image",
      "text-editor",
      "video",
      "button",
      "icon",
      "html",
      "divider-spacer",
    ] as const) {
      const def = getBlockDef(type);
      expect(def).toBeDefined();
      expect(def!.fieldsTab).toBeDefined();
      expect(def!.fieldsTab).toBe(def!.fields);
    }
  });

  it("declares styleTab on every block except `html` (F3.5.2)", () => {
    // F3.5.2 — each block migrates its imperative Style-tab branch into
    // a declarative `styleTab: StyleSection[]`. The `html` block
    // legitimately has NO Style tab (RightPanel.tsx hides it via
    // `hideStyleTab = block.type === "html"`); expressed as the
    // absence of `styleTab`.
    for (const def of BLOCK_DEFINITIONS) {
      const enriched = getBlockDef(def.type)!;
      if (def.type === "html") {
        expect(enriched.styleTab).toBeUndefined();
      } else {
        expect(enriched.styleTab).toBeDefined();
        expect(Array.isArray(enriched.styleTab)).toBe(true);
        expect(enriched.styleTab!.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─── F3.5.2 + F3.5.6 — migrated instance shape ───────────────────────────────

describe("F3.5.2 + F3.5.6 — migrated BlockDef instances", () => {
  // Block-by-block coverage. The exact `styleTab` length is asserted so
  // accidental regressions surface (e.g. someone removing the
  // `borderRadius` entry from `image`).
  //
  // F3.5.6 added `kind: "custom"` Fields-tab entries to every block
  // whose Fields tab carried bespoke widgets (text, image, text-editor,
  // video, button, icon, container, divider-spacer). The fieldsTab
  // counts below include both standard FieldDefs and custom entries.
  const EXPECTED: Record<string, { fieldsTab: number; styleTab: number | "absent" }> = {
    text:             { fieldsTab: 2, styleTab: 5 }, // content + custom(extras)
    image:            { fieldsTab: 2, styleTab: 6 }, // caption + custom(image fields)
    "text-editor":    { fieldsTab: 2, styleTab: 4 }, // content + custom(extras)
    video:            { fieldsTab: 1, styleTab: 1 }, // custom(video fields)
    button:           { fieldsTab: 3, styleTab: 6 }, // text + icon + custom(link)
    icon:             { fieldsTab: 2, styleTab: 2 }, // icon + custom(link)
    html:             { fieldsTab: 1, styleTab: "absent" },
    "divider-spacer": { fieldsTab: 1, styleTab: 1 }, // space (divider line moved to styleTab)
    container:        { fieldsTab: 1, styleTab: 5 }, // custom(layout)
  };

  for (const [type, expected] of Object.entries(EXPECTED)) {
    it(`block "${type}" has fieldsTab=${expected.fieldsTab} items, styleTab=${
      expected.styleTab === "absent" ? "absent" : `${expected.styleTab} items`
    }`, () => {
      const def = getBlockDef(type as Parameters<typeof getBlockDef>[0])!;
      expect(def.fieldsTab).toBeDefined();
      expect(def.fieldsTab!.length).toBe(expected.fieldsTab);

      if (expected.styleTab === "absent") {
        expect(def.styleTab).toBeUndefined();
      } else {
        expect(def.styleTab).toBeDefined();
        expect(def.styleTab!.length).toBe(expected.styleTab);
      }
    });
  }

  it("text-editor styleTab includes a custom render entry for paragraph spacing + drop cap", () => {
    const def = getBlockDef("text-editor")!;
    const customs = def.styleTab!.filter((s) => s.kind === "custom");
    expect(customs).toHaveLength(1);
  });

  it("video styleTab is a single custom render entry (aspect ratio + filter)", () => {
    const def = getBlockDef("video")!;
    expect(def.styleTab).toEqual([{ kind: "custom", render: expect.any(Function) }]);
  });

  it("divider-spacer styleTab is a single custom render entry (divider line)", () => {
    const def = getBlockDef("divider-spacer")!;
    expect(def.styleTab).toEqual([{ kind: "custom", render: expect.any(Function) }]);
  });

  it("icon styleTab pairs alignment with a custom color/size/rotate entry", () => {
    const def = getBlockDef("icon")!;
    const kinds = def.styleTab!.map((s) => s.kind);
    expect(kinds).toEqual(["alignment", "custom"]);
  });
});

// ─── Compile-time type checks (F3.5.1 schema sanity) ─────────────────────────

describe("BlockDef schema (compile-time)", () => {
  it("accepts a BlockDef with the new fieldsTab + styleTab properties", () => {
    const themeOnly: StyleSection = { kind: "theme" };
    const spacingPaddingOnly: StyleSection = { kind: "spacing", targets: ["padding"] };
    const backgroundColorOnly: StyleSection = {
      kind: "background",
      modes: ["color", "gradient"],
    };
    const typographyFontOnly: StyleSection = {
      kind: "typography",
      props: ["fontFamily", "fontSize", "fontWeight"],
    };

    const def: BlockDef = {
      type: "text",
      label: "Sample",
      icon: "📝",
      description: "Sample for type-shape coverage",
      category: "general",
      defaultConfig: {},
      fields: [],
      fieldsTab: [],
      styleTab: [
        themeOnly,
        spacingPaddingOnly,
        backgroundColorOnly,
        typographyFontOnly,
        { kind: "border" },
        { kind: "borderRadius" },
        { kind: "boxShadow" },
        { kind: "textStroke" },
        { kind: "textShadow" },
        { kind: "alignment" },
        { kind: "blendMode" },
        { kind: "filter" },
        { kind: "overflow" },
        { kind: "opacity" },
        { kind: "imgVisual" },
        { kind: "videoSource" },
        { kind: "iconGroup" },
        { kind: "dividerLine" },
        {
          kind: "custom",
          render: ({ block, onChange, activeBreakpoint }: SectionRenderProps) => {
            // Renderer signature smoke-test — compile-time only.
            void block;
            void onChange;
            void activeBreakpoint;
            return null;
          },
        },
      ],
    };

    expect(def.styleTab).toHaveLength(19);
    expect(def.fieldsTab).toEqual([]);
  });

  it("BackgroundMode and TypographyProp aliases are usable as filter sets", () => {
    const modes: BackgroundMode[] = ["color", "gradient", "image", "video", "slideshow"];
    const typoProps: TypographyProp[] = [
      "fontFamily",
      "color",
      "colorAlpha",
      "fontSize",
      "fontWeight",
      "textTransform",
      "fontStyle",
      "textDecoration",
      "lineHeight",
      "letterSpacing",
      "wordSpacing",
      "linkColor",
      "linkColorAlpha",
    ];
    expect(modes).toHaveLength(5);
    expect(typoProps.length).toBeGreaterThan(0);
  });
});
