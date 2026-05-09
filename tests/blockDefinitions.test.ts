import { describe, it, expect } from "vitest";
import {
  BLOCK_DEFINITIONS,
  EMPTY_ADVANCED_DEFAULTS,
  EMPTY_STYLE_DEFAULTS,
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
  // F3.5.6 followup — container/button styleTab dropped the redundant
  // leading `{ kind: "theme" }` entry (theme already lives inside the
  // Background section). Counts shifted: container 5 → 4, button 6 → 5.
  const EXPECTED: Record<string, { fieldsTab: number; styleTab: number | "absent" }> = {
    text:             { fieldsTab: 2, styleTab: 5 }, // content + custom(extras)
    image:            { fieldsTab: 2, styleTab: 6 }, // caption + custom(image fields)
    "text-editor":    { fieldsTab: 2, styleTab: 4 }, // content + custom(extras)
    video:            { fieldsTab: 1, styleTab: 1 }, // custom(video fields)
    button:           { fieldsTab: 3, styleTab: 5 }, // text + icon + custom(link); theme dropped
    icon:             { fieldsTab: 2, styleTab: 2 }, // icon + custom(link)
    html:             { fieldsTab: 1, styleTab: "absent" },
    "divider-spacer": { fieldsTab: 1, styleTab: 1 }, // space (divider line moved to styleTab)
    container:        { fieldsTab: 1, styleTab: 4 }, // custom(layout); theme dropped
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

  // F3.5.6 followup (Bug 2) — no styleTab entry may carry `kind: "theme"`
  // immediately followed by `kind: "background"` because
  // `BackgroundSection` already includes `<ThemeStyleToggle />` inline
  // (sections/BackgroundSection.tsx L57). This regression test guards
  // any future BlockDef migration from re-introducing the duplicate.
  it("no block declares a redundant `theme` entry adjacent to `background`", () => {
    for (const def of BLOCK_DEFINITIONS) {
      const enriched = getBlockDef(def.type)!;
      if (!enriched.styleTab) continue;
      for (let i = 0; i < enriched.styleTab.length - 1; i++) {
        const cur = enriched.styleTab[i];
        const nxt = enriched.styleTab[i + 1];
        if (cur.kind === "theme" && nxt.kind === "background") {
          throw new Error(
            `Block "${def.type}" styleTab[${i}..${i + 1}] declares a redundant ` +
            `theme→background pair. BackgroundSection already renders the ` +
            `theme toggle inline; drop the leading { kind: "theme" } entry.`,
          );
        }
      }
    }
  });

  it("container styleTab no longer leads with kind: \"theme\" (F3.5.6 followup)", () => {
    const def = getBlockDef("container")!;
    expect(def.styleTab![0].kind).not.toBe("theme");
    expect(def.styleTab![0].kind).toBe("background");
  });

  it("button styleTab does not duplicate the theme toggle (F3.5.6 followup)", () => {
    const def = getBlockDef("button")!;
    const themeCount = def.styleTab!.filter((s) => s.kind === "theme").length;
    expect(themeCount).toBe(0);
  });
});

// ─── F3.6.1 — full defaultConfig structural shape ────────────────────────────

describe("F3.6.1 — defaultConfig structural shape", () => {
  // Source-of-truth replication. `STYLE_PROPS` lives in
  // `src/components/styleUtils.ts` (Agent B's column) as a non-exported
  // local `const`. Replicating the array verbatim here is the cheapest
  // way to enforce the contract without forking the styleUtils file
  // for an export. If `STYLE_PROPS` ever gains a new entry, mirror it
  // BOTH here and in `EMPTY_STYLE_DEFAULTS` (in blockDefinitions.ts) —
  // this test will fail loudly until they agree.
  const STYLE_PROPS_SNAPSHOT = [
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop",  "marginRight",  "marginBottom",  "marginLeft",
    "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight",
    "borderTopLeftRadius", "borderTopRightRadius",
    "borderBottomRightRadius", "borderBottomLeftRadius",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "overflowX", "overflowY",
    "textAlign",
    "fontFamily", "fontSize", "fontWeight",
    "textTransform", "fontStyle", "textDecoration",
    "lineHeight", "letterSpacing", "wordSpacing",
    "mixBlendMode",
    "aspectRatio",
    "filter",
  ] as const;

  // Sanity — EMPTY_STYLE_DEFAULTS itself carries every STYLE_PROPS key.
  // If this fails, blockDefinitions.ts has drifted from styleUtils.ts.
  it("EMPTY_STYLE_DEFAULTS includes every STYLE_PROPS key", () => {
    for (const key of STYLE_PROPS_SNAPSHOT) {
      expect(EMPTY_STYLE_DEFAULTS).toHaveProperty(key);
      // Empty string per the F3.6.1 contract — no design values invented.
      expect(EMPTY_STYLE_DEFAULTS[key]).toBe("");
    }
  });

  // Per-block: every BlockDef.defaultConfig.style must contain every
  // STYLE_PROPS key. Block-specific overrides (e.g. container's
  // paddingTop="12px") are allowed to differ from "" — only presence
  // is asserted. Container also carries layout-only keys
  // (columnGap, rowGap) that are NOT in STYLE_PROPS; those are
  // intentionally extra and not asserted here.
  it("every block's defaultConfig.style has every STYLE_PROPS key", () => {
    for (const def of BLOCK_DEFINITIONS) {
      const styleDefault = (def.defaultConfig.style ?? {}) as Record<string, unknown>;
      for (const key of STYLE_PROPS_SNAPSHOT) {
        expect(
          styleDefault,
          `block "${def.type}" defaultConfig.style is missing STYLE_PROPS key "${key}"`,
        ).toHaveProperty(key);
      }
    }
  });

  // Every block's defaultConfig must declare the full shape:
  // style / styleHover / styleDark / styleBreakpoints /
  // styleHoverBreakpoints / advanced. Empty-object defaults are fine —
  // F3.6.2 fills missing keys at load time. F3.6.1 only asserts the
  // top-level shape is consistent across the 9 blocks.
  it("every block's defaultConfig declares the full top-level shape", () => {
    for (const def of BLOCK_DEFINITIONS) {
      const cfg = def.defaultConfig;
      expect(cfg, `block "${def.type}" missing style`).toHaveProperty("style");
      expect(cfg, `block "${def.type}" missing styleHover`).toHaveProperty("styleHover");
      expect(cfg, `block "${def.type}" missing styleDark`).toHaveProperty("styleDark");
      expect(cfg, `block "${def.type}" missing styleBreakpoints`).toHaveProperty(
        "styleBreakpoints",
      );
      expect(
        cfg,
        `block "${def.type}" missing styleHoverBreakpoints`,
      ).toHaveProperty("styleHoverBreakpoints");
      expect(cfg, `block "${def.type}" missing advanced`).toHaveProperty("advanced");

      // Type checks — the empty placeholders are objects (not null/undefined)
      // so consumers can spread them safely.
      expect(typeof cfg.style).toBe("object");
      expect(typeof cfg.styleHover).toBe("object");
      expect(typeof cfg.styleDark).toBe("object");
      expect(typeof cfg.styleBreakpoints).toBe("object");
      expect(typeof cfg.styleHoverBreakpoints).toBe("object");
      expect(typeof cfg.advanced).toBe("object");
    }
  });

  // Every block's defaultConfig.advanced must include every key in
  // `EMPTY_ADVANCED_DEFAULTS`. Mirrors the AdvancedConfig shape in
  // src/admin/right-panel/types.ts plus position offset keys.
  it("every block's defaultConfig.advanced has every EMPTY_ADVANCED_DEFAULTS key", () => {
    const advancedKeys = Object.keys(EMPTY_ADVANCED_DEFAULTS);
    for (const def of BLOCK_DEFINITIONS) {
      const adv = (def.defaultConfig.advanced ?? {}) as Record<string, unknown>;
      for (const key of advancedKeys) {
        expect(
          adv,
          `block "${def.type}" defaultConfig.advanced is missing key "${key}"`,
        ).toHaveProperty(key);
      }
    }
  });

  // No design values invented — every key in EMPTY_STYLE_DEFAULTS that
  // wasn't pre-populated with a design value should still be "" on the
  // BlockDef instance. The container block intentionally sets padding +
  // gap design values; everything else uses the empty defaults.
  // Whitelist captures the pre-existing design values that survive the
  // F3.6.1 merge.
  it("F3.6.1 invents no design values (only pre-existing defaults stay non-empty)", () => {
    const PRE_EXISTING: Partial<Record<string, Record<string, string>>> = {
      container: {
        paddingTop: "12px",
        paddingRight: "12px",
        paddingBottom: "12px",
        paddingLeft: "12px",
      },
    };

    for (const def of BLOCK_DEFINITIONS) {
      const styleDefault = (def.defaultConfig.style ?? {}) as Record<string, string>;
      const allowed = PRE_EXISTING[def.type] ?? {};
      for (const key of STYLE_PROPS_SNAPSHOT) {
        const expected = allowed[key] ?? "";
        expect(
          styleDefault[key],
          `block "${def.type}" style.${key} should be "${expected}" (F3.6.1 invents no values)`,
        ).toBe(expected);
      }
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
