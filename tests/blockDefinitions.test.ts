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

  it("aliases fieldsTab to fields when fieldsTab is not set on the entry (F3.5.1 transition)", () => {
    // F3.5.2 will populate fieldsTab directly on each entry. Until then,
    // getBlockDef must expose `fieldsTab` so new declarative consumers
    // (TabRenderer in F3.5.4) can read a single field.
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
      expect(def!.fieldsTab).toBe(def!.fields);
    }
  });

  it("does not invent a styleTab when none is declared (F3.5.1 leaves it undefined)", () => {
    // F3.5.6 will require every BlockDef to set styleTab. Until F3.5.2
    // populates it, getBlockDef must NOT fabricate a default — the
    // imperative branches in RightPanel still own the Style tab.
    for (const def of BLOCK_DEFINITIONS) {
      const enriched = getBlockDef(def.type)!;
      expect(enriched.styleTab).toBeUndefined();
    }
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
