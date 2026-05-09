import type { ReactNode } from "react";
import type { BlockType, BreakpointId, SectionBlock } from "../types.js";
import type { BackgroundType } from "./controls/BackgroundControl.js";
import type { TypographyValue } from "./controls/TypographyControl.js";

// ─── Field Schema ─────────────────────────────────────────────────────────────

export type FieldType =
  | "text"
  | "textarea"
  | "url"
  | "select"
  | "toggle"
  | "number"
  | "json-array"
  | "link"
  | "rich-text"
  | "code"
  | "number-units"
  | "icon-group";

/**
 * STANDARD FIELD STYLING — convention.
 *
 * To match the rest of the panel (label-left, control-right with bg + border,
 * uniform reset behavior), set `labelClassName: "epx-row-label--section"`
 * on every `text` / `url` / `textarea` / `number` / `select` / `toggle`
 * field. FieldRenderer then wraps the control in `<FieldGroup>` and uses the
 * row variants (`SelectRow`, `<input>` row, switch). Do NOT introduce new
 * one-off styled wrappers — reuse `FieldGroup` + the existing row primitives.
 */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  labelClassName?: string;
  /** Show this field only when another field's value matches */
  showWhen?: { key: string; value: string };
  /** For json-array: schema of each item's sub-fields */
  itemFields?: FieldDef[];
  /** For type='code': syntax mode */
  language?: "html" | "css" | "js";
  /** For type='icon-group': expose Position select */
  showPosition?: boolean;
  /** For type='number-units': allowed unit set */
  units?: Array<"px" | "rem" | "em" | "%" | "vh" | "vw" | "deg" | "turn">;
}

// ─── Style Section Schema (declarative Style tab) ────────────────────────────

/**
 * Background "mode" exposed in the Style tab. Aliased from the existing
 * `BackgroundType` union in `controls/BackgroundControl.tsx` (`color` /
 * `gradient` / `image` / `video` / `slideshow`) so we don't fork a second
 * source of truth. `BackgroundControl` already accepts an `allowedTypes`
 * prop typed as `BackgroundType[]`; the `kind: "background"` section
 * forwards this list verbatim under the `modes` key (dropping into the
 * existing `allowedTypes` slot in F3.5.6).
 */
export type BackgroundMode = BackgroundType;

/**
 * A single typography sub-property exposed in `kind: "typography"`. The
 * value set mirrors the keys of `TypographyValue` from `TypographyControl`
 * — when a section restricts via `props: TypographyProp[]`, only those
 * sub-controls render. The `*Alpha` numeric helpers live alongside their
 * color counterparts; selecting `"color"` implicitly enables `colorAlpha`,
 * selecting `"linkColor"` implicitly enables `linkColorAlpha`. Blocks that
 * want the full typography stack omit `props` entirely (treat as "all").
 */
export type TypographyProp = keyof TypographyValue;

/**
 * Render props passed to `kind: "custom"` section renderers. Mirrors the
 * top-level `RightPanel` prop conventions (`block`, `onChange`,
 * `activeBreakpoint`) so custom branches can be lifted out of the panel
 * with no signature changes. Custom renderers are responsible for their
 * own bp routing — they receive the `activeBreakpoint` and decide whether
 * to write base style keys or `styleBreakpoints[bpId]` overrides.
 */
export interface SectionRenderProps {
  block: SectionBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}

/**
 * Declarative description of one section in the Style tab. Replaces the
 * imperative `block.type === "..."` branches that live in
 * `RightPanel.tsx` today (~9 hardcoded forks across ~1670 LOC).
 *
 * F3.5.1 (this PR) introduces the type only. F3.5.2 migrates the 9
 * `BlockDef` instances to declare their `styleTab` lists. F3.5.3 + .4
 * land the `SectionRenderer` / `TabRenderer` that consume them. F3.5.6
 * deletes the hardcoded branches and switches `RightPanel` over to the
 * declarative path.
 *
 * Each variant either targets a built-in section that the renderer knows
 * how to draw (theme / spacing / background / etc.) or hands off to a
 * caller-supplied `render` for the genuinely block-specific bits
 * (text-editor drop cap, video aspect ratio, divider gradient, etc.).
 */
export type StyleSection =
  | { kind: "theme" }
  | { kind: "spacing"; targets?: ("padding" | "margin")[] }
  | { kind: "background"; modes?: BackgroundMode[] }
  | { kind: "border" }
  | { kind: "borderRadius" }
  | { kind: "boxShadow" }
  | { kind: "typography"; props?: TypographyProp[] }
  | { kind: "textStroke" }
  | { kind: "textShadow" }
  | { kind: "alignment" }
  | { kind: "blendMode" }
  | { kind: "filter" }
  | { kind: "overflow" }
  | { kind: "opacity" }
  | { kind: "imgVisual" }            // image-only — width/height/objectFit/objectPosition/imgStyle
  | { kind: "videoSource" }          // video-only — aspect-ratio + filter group on Style tab
  | { kind: "iconGroup" }            // icon / button / divider — collapsible icon-picker section
  | { kind: "dividerLine" }          // divider-spacer-only — divider style/width/length/color/align
  | { kind: "custom"; render: (props: SectionRenderProps) => ReactNode };

// ─── Block Definition ─────────────────────────────────────────────────────────

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultConfig: Record<string, any>;
  /**
   * @deprecated F3.5 — use `fieldsTab`. Kept as an alias of `fieldsTab`
   *   through the F3.5 transition so existing callers (`RightPanel.tsx`,
   *   reducer ADD_BLOCK defaults, tests) keep compiling. F3.5.2 migrates
   *   the 9 BlockDef instances to populate `fieldsTab`; F3.5.6 retires
   *   the alias and drops `fields` entirely.
   */
  fields: FieldDef[];
  /**
   * @deprecated F3.5 — use `styleTab`. Block-specific fields rendered at
   *   the top of the Style tab. Today only the `text-editor` block uses
   *   this (custom branch in `RightPanel.tsx`). F3.5.2 folds these into
   *   `styleTab` (typically as a leading `kind: "custom"` entry); F3.5.6
   *   retires the alias.
   */
  styleFields?: FieldDef[];
  /**
   * Replacement for `fields`. Same shape (`FieldDef[]`) — declarative list
   * of inputs to render in the Fields tab. While both are present they
   * MUST point at the same array (alias). New code should read
   * `def.fieldsTab ?? def.fields`. F3.5.2 starts populating this; F3.5.6
   * makes it the only source.
   */
  fieldsTab?: FieldDef[];
  /**
   * Declarative description of the Style tab. Each entry maps to one
   * section the panel renders. When omitted the panel falls back to
   * today's imperative branches. F3.5.6 makes this the only source.
   */
  styleTab?: StyleSection[];
}

// ─── Block Definitions ────────────────────────────────────────────────────────

export const BLOCK_DEFINITIONS: BlockDef[] = [
  {
    type: "text",
    label: "Text",
    icon: "📝",
    description: "A text block with custom CSS control",
    category: "general",
    defaultConfig: { content: "", theme: "light" },
    fields: [
      { key: "content", label: "Content", type: "textarea", placeholder: "Enter text...", labelClassName: "epx-row-label--section" },
    ],
  },

  {
    type: "image",
    label: "Image",
    icon: "🖼️",
    description: "An image with optional caption and link",
    category: "general",
    defaultConfig: { theme: "light", resolution: "full" },
    fields: [
      { key: "caption", label: "Caption", type: "textarea", placeholder: "Optional caption…", labelClassName: "epx-row-label--section" },
    ],
  },

  {
    type: "text-editor",
    label: "Text Editor",
    icon: "📄",
    description: "Rich text article with columns and drop cap",
    category: "general",
    defaultConfig: {
      content: [],
      theme: "light",
      columns: "1",
      columnsGap: "0px",
      dropCap: false,
    },
    fields: [
      { key: "content", label: "Content", type: "rich-text", labelClassName: "epx-row-label--section" },
      // dropCap, columns, columnsCustom, columnsGap rendered via custom
      // branch in RightPanel.tsx (text-editor block) — they support per-
      // breakpoint overrides through configBreakpoints[bpId].
    ],
  },

  {
    type: "video",
    label: "Video",
    icon: "🎬",
    description: "YouTube, Vimeo, or self-hosted video with image overlay",
    category: "general",
    defaultConfig: {
      theme: "light",
      video: { src: "url", autoplay: false, mute: true, controls: true, lazyLoad: true },
      aspectRatio: "16:9",
    },
    fields: [
      // The Video Source field is intentionally a single declarative entry —
      // FieldRenderer dispatches it via a custom branch in RightPanel.
      // Wire it as a select so the entry shows a label; full UI lives in RightPanel.
    ],
  },

  {
    type: "button",
    label: "Button",
    icon: "🔘",
    description: "Action button with optional icon and link",
    category: "general",
    defaultConfig: {
      theme: "light",
      text: "Click me",
      icon: { iconPosition: "left", iconSize: "16px" },
    },
    fields: [
      { key: "text", label: "Text", type: "textarea", placeholder: "Click me", labelClassName: "epx-row-label--section" },
      { key: "icon", label: "Icon", type: "icon-group", showPosition: true },
    ],
  },

  {
    type: "icon",
    label: "Icon",
    icon: "✨",
    description: "Standalone SVG or PNG icon, optionally linked",
    category: "general",
    defaultConfig: {
      theme: "light",
      icon: { iconSize: "32px" },
    },
    fields: [
      { key: "icon", label: "Icon", type: "icon-group", showPosition: false },
    ],
  },

  {
    type: "html",
    label: "HTML",
    icon: "🧩",
    description: "Raw HTML/CSS/JS block (trusted input — not sanitized)",
    category: "core",
    defaultConfig: {
      theme: "light",
      code: "",
    },
    fields: [
      { key: "code", label: "HTML", type: "code", language: "html", labelClassName: "epx-row-label--section" },
    ],
  },

  {
    type: "divider-spacer",
    label: "Divider / Spacer",
    icon: "➖",
    description: "Vertical space, optional decorative divider line",
    category: "core",
    defaultConfig: {
      theme: "light",
      space: "48px",
      divider: {
        style: "none",
        width: "1px",
        length: "100%",
        color: "#000000",
        colorAlpha: 0.12,
        align: "center",
      },
    },
    fields: [
      { key: "space", label: "Space", type: "number-units", units: ["px", "rem", "em", "vh", "%"], labelClassName: "epx-row-label--section" },
      // Divider sub-fields handled inline in RightPanel (collapsible group, IconGroup nested).
    ],
  },

  {
    type: "container",
    label: "Container",
    icon: "📦",
    description: "Wrapper block that can contain other blocks",
    category: "core",
    defaultConfig: {
      theme: "light",
      layout: "flex",
      style: {
        paddingTop: "12px",
        paddingRight: "12px",
        paddingBottom: "12px",
        paddingLeft: "12px",
        columnGap: "6px",
        rowGap: "6px",
      },
    },
    fields: [],
  },
];

/**
 * Look up the BlockDef for a given block type.
 *
 * F3.5.1 transitional behavior: ensures the returned def carries the new
 * `fieldsTab` property as an alias of the legacy `fields` array. The
 * registered `BLOCK_DEFINITIONS` entries above don't need to declare both
 * — `getBlockDef` is the single readback path used by `RightPanel` and
 * the reducer, so aliasing here keeps the 9 entries unchanged while new
 * consumers can read `def.fieldsTab` cleanly. F3.5.2 will start
 * populating `fieldsTab` (and `styleTab`) directly on each entry; F3.5.6
 * retires the alias.
 *
 * `styleTab` is intentionally NOT aliased from `styleFields` — they have
 * different shapes (`StyleSection[]` vs `FieldDef[]`). F3.5.2 declares
 * `styleTab` explicitly per block.
 */
export function getBlockDef(type: BlockType): BlockDef | undefined {
  const def = BLOCK_DEFINITIONS.find((d) => d.type === type);
  if (!def) return undefined;
  if (def.fieldsTab !== undefined) return def;
  return { ...def, fieldsTab: def.fields };
}
