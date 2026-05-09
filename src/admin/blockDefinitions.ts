import type { ReactNode } from "react";
import type { BlockType, BreakpointId, SectionBlock } from "../types.js";
import type { BackgroundType } from "./controls/BackgroundControl.js";
import type { TypographyValue } from "./controls/TypographyControl.js";
import { TextEditorDropCapSection } from "./right-panel/sections/TextEditorDropCapSection.js";
import { VideoSourceSection } from "./right-panel/sections/VideoSourceSection.js";
import { DividerLineSection } from "./right-panel/sections/DividerLineSection.js";
import { IconBlockStyleSection } from "./right-panel/sections/IconBlockStyleSection.js";
import { ContainerLayoutPicker } from "./right-panel/sections/ContainerLayoutPicker.js";
import { VideoFieldsSection } from "./right-panel/sections/VideoFieldsSection.js";
import { TextFieldsExtras } from "./right-panel/sections/TextFieldsExtras.js";
import { ImageFieldsSection } from "./right-panel/sections/ImageFieldsSection.js";
import { LinkFieldsSection } from "./right-panel/sections/LinkFieldsSection.js";
import { TextEditorFieldsSection } from "./right-panel/sections/TextEditorFieldsSection.js";

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
export interface StandardFieldDef {
  /**
   * Discriminator. Optional and defaults to `"standard"` so existing
   * declarations that omit it stay valid. F3.5.6 introduced the union
   * with `CustomFieldDef` to support the bespoke Fields-tab content
   * (`container` LayoutControl + GapControl + Overflow + HTML tag,
   * `video` VideoSourceControl + image overlay, etc.) that doesn't
   * fit the standard input-driven shape.
   */
  kind?: "standard";
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

/**
 * Render props passed to a `kind: "custom"` Fields-tab renderer.
 * Mirrors `SectionRenderProps` so a renderer can be reused on either
 * tab, but kept as a separate name to advertise intent at the call
 * site. Custom Fields renderers handle their own bp routing through
 * `activeBreakpoint` (e.g. `container` LayoutControl writes to
 * `styleBreakpoints[bpId]` on non-desktop).
 */
export interface FieldRenderProps {
  block: SectionBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}

/**
 * Bespoke Fields-tab entry. F3.5.6 introduced this variant so the
 * `container` and `video` blocks can declare their Fields tabs
 * through `BlockDef.fieldsTab` without an imperative branch in
 * `RightPanel.tsx`. Mirrors the Style-tab equivalent
 * (`StyleSection { kind: "custom"; render: ... }`). The renderer
 * receives the same `FieldRenderProps` shape and returns React nodes.
 */
export interface CustomFieldDef {
  kind: "custom";
  /**
   * Stable identifier used for React keys. Doesn't have to map to a
   * `block.config[key]` slot — the renderer can write multiple keys
   * via the dispatched `onChange` patches.
   */
  key: string;
  render: (props: FieldRenderProps) => ReactNode;
  /** Show this entry only when another field's value matches. */
  showWhen?: { key: string; value: string };
}

/** Discriminated union of standard input-style fields and bespoke
 *  renderers. F3.5.6 introduced the `kind: "custom"` variant; existing
 *  declarations that omit `kind` are inferred as `"standard"`. */
export type FieldDef = StandardFieldDef | CustomFieldDef;

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

/**
 * F3.6.1 — full default `style` shape, mirroring the canonical
 * `STYLE_PROPS` list in `src/components/styleUtils.ts` (Agent B's
 * column — not exported, so we replicate the key set here as a
 * read-only contract). Every key the plugin's CSS pipeline knows
 * about is present with an empty string value, so `block.config.style`
 * always has the same shape regardless of what the user has touched.
 *
 * Empty values are intentional: F3.6.1 introduces NO design defaults.
 * F3.6.2 builds the load-time `getDefaultBlockConfig(type)` helper on
 * top of this; F3.6.3 unifies Canvas / frontend CSS generation
 * knowing the keys are always present (no defensive `cssStr(...)`
 * misses).
 *
 * If `STYLE_PROPS` in `styleUtils.ts` ever gains a new entry, mirror
 * it here AND in the matching test array. The `blockDefinitions.test.ts`
 * shape assertion will fail until both lists agree.
 */
export const EMPTY_STYLE_DEFAULTS: Record<string, string> = {
  // Padding
  paddingTop: "",    paddingRight: "",  paddingBottom: "",  paddingLeft: "",
  // Margin
  marginTop: "",     marginRight: "",   marginBottom: "",   marginLeft: "",
  // Sizing
  width: "",         minWidth: "",      maxWidth: "",
  height: "",        minHeight: "",     maxHeight: "",
  // Border radius
  borderTopLeftRadius: "",     borderTopRightRadius: "",
  borderBottomRightRadius: "", borderBottomLeftRadius: "",
  // Border width
  borderTopWidth: "",    borderRightWidth: "",
  borderBottomWidth: "", borderLeftWidth: "",
  // Overflow
  overflowX: "",     overflowY: "",
  // Typography
  textAlign: "",
  fontFamily: "",    fontSize: "",      fontWeight: "",
  textTransform: "", fontStyle: "",     textDecoration: "",
  lineHeight: "",    letterSpacing: "", wordSpacing: "",
  // Misc
  mixBlendMode: "",  aspectRatio: "",   filter: "",
};

/**
 * F3.6.1 — empty `advanced` defaults. Mirrors `AdvancedConfig` in
 * `src/admin/right-panel/types.ts` (top / right / bottom / left typed
 * as `string?` there — kept as `""` here so the key is always
 * present). `zIndex` stays `""` for the same reason; the runtime CSS
 * generator already short-circuits when the value is empty/undefined.
 */
export const EMPTY_ADVANCED_DEFAULTS: Record<string, string> = {
  cssId: "",
  cssClasses: "",
  customCss: "",
  position: "",
  top: "",
  right: "",
  bottom: "",
  left: "",
  zIndex: "",
};

// ─── Field arrays (defined as locals so each BlockDef can point both
// `fields` and `fieldsTab` at the same array — keeps the alias contract
// honest and gives F3.5.6 a single line to delete per block when it
// retires `fields`).
const TEXT_FIELDS: FieldDef[] = [
  { key: "content", label: "Content", type: "textarea", placeholder: "Enter text...", labelClassName: "epx-row-label--section" },
  // F3.5.6 — HTML Tag selector + conditional LinkControl (when tag=`a`)
  // declared as a `kind: "custom"` entry. Original imperative branch in
  // `RightPanel.tsx` (~line 779) replaced by `TextFieldsExtras`.
  { kind: "custom", key: "text-extras", render: TextFieldsExtras },
];

const IMAGE_FIELDS: FieldDef[] = [
  { key: "caption", label: "Caption", type: "textarea", placeholder: "Optional caption…", labelClassName: "epx-row-label--section" },
  // F3.5.6 — image preview / resolution / link / MediaPicker block.
  // Original imperative branch in `RightPanel.tsx` (~line 798) replaced
  // by `ImageFieldsSection`.
  { kind: "custom", key: "image-fields", render: ImageFieldsSection },
];

const TEXT_EDITOR_FIELDS: FieldDef[] = [
  { key: "content", label: "Content", type: "rich-text", labelClassName: "epx-row-label--section" },
  // F3.5.6 — drop cap / columns (with custom-pen + scrub label) /
  // columns gap. All bp-aware via `configBreakpoints[bpId]`. Original
  // imperative branch in `RightPanel.tsx` (~line 631) replaced by
  // `TextEditorFieldsSection`.
  { kind: "custom", key: "text-editor-extras", render: TextEditorFieldsSection },
];

const VIDEO_FIELDS: FieldDef[] = [
  // F3.5.6 — `VideoSourceControl` + image overlay group declared as a
  // `kind: "custom"` entry. Original imperative branch in
  // `RightPanel.tsx` (~line 875) replaced by `VideoFieldsSection`.
  { kind: "custom", key: "video-fields", render: VideoFieldsSection },
];

const BUTTON_FIELDS: FieldDef[] = [
  { key: "text", label: "Text", type: "textarea", placeholder: "Click me", labelClassName: "epx-row-label--section" },
  { key: "icon", label: "Icon", type: "icon-group", showPosition: true },
  // F3.5.6 — `LinkControl`. Original imperative branch in
  // `RightPanel.tsx` (~line 952) replaced by `LinkFieldsSection`.
  { kind: "custom", key: "button-link", render: LinkFieldsSection },
];

const ICON_FIELDS: FieldDef[] = [
  { key: "icon", label: "Icon", type: "icon-group", showPosition: false },
  // F3.5.6 — `LinkControl`. Original imperative branch in
  // `RightPanel.tsx` (~line 955) replaced by `LinkFieldsSection`.
  { kind: "custom", key: "icon-link", render: LinkFieldsSection },
];

const HTML_FIELDS: FieldDef[] = [
  { key: "code", label: "HTML", type: "code", language: "html", labelClassName: "epx-row-label--section" },
];

const DIVIDER_SPACER_FIELDS: FieldDef[] = [
  { key: "space", label: "Space", type: "number-units", units: ["px", "rem", "em", "vh", "%"], labelClassName: "epx-row-label--section" },
  // Divider sub-fields (style/width/length/color/gradient/align/IconGroup)
  // moved to `styleTab` via `DividerLineSection` in F3.5.6 — they
  // logically belong to Style. The Fields tab now only carries the
  // top-level `space` field.
];

const CONTAINER_FIELDS: FieldDef[] = [
  // F3.5.6 — `LayoutControl` + `GapControl` + `OverflowControl` + HTML
  // Tag + conditional `LinkControl` declared as a `kind: "custom"`
  // entry. Original imperative branches in `RightPanel.tsx` (~lines
  // 839 / 849 / 852) replaced by `ContainerLayoutPicker`.
  { kind: "custom", key: "container-layout", render: ContainerLayoutPicker },
];

export const BLOCK_DEFINITIONS: BlockDef[] = [
  {
    type: "text",
    label: "Text",
    icon: "📝",
    description: "A text block with custom CSS control",
    category: "general",
    defaultConfig: {
      content: "",
      theme: "light",
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: TEXT_FIELDS,
    fieldsTab: TEXT_FIELDS,
    // Style tab — text block: align + typography stack only (no
    // background/border/shadow). RightPanel.tsx ~lines 1271–1299.
    styleTab: [
      { kind: "alignment" },
      { kind: "typography" },
      { kind: "textStroke" },
      { kind: "textShadow" },
      { kind: "blendMode" },
    ],
  },

  {
    type: "image",
    label: "Image",
    icon: "🖼️",
    description: "An image with optional caption and link",
    category: "general",
    defaultConfig: {
      theme: "light",
      resolution: "full",
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: IMAGE_FIELDS,
    fieldsTab: IMAGE_FIELDS,
    // Style tab — image block: imgVisual covers width/height/objectFit/
    // objectPosition/imgStyle, then alignment + opacity, then theme +
    // border/radius/shadow that target the inner <img>. The `imgVisual`
    // section also folds in the inner-img border behavior. Mirrors the
    // imperative branch in RightPanel.tsx ~lines 1471, 1489–1601.
    styleTab: [
      { kind: "imgVisual" },
      { kind: "alignment" },
      { kind: "opacity" },
      { kind: "borderRadius" },
      { kind: "border" },
      { kind: "boxShadow" },
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: TEXT_EDITOR_FIELDS,
    fieldsTab: TEXT_EDITOR_FIELDS,
    // Style tab — text-editor block: align, typography (base only — no
    // bp pass-through is intentional here, matches RightPanel.tsx
    // ~line 1308), text shadow, then a `kind: "custom"` covering
    // paragraph spacing + the conditional drop-cap subgroup
    // (Size / Lines / Margin Right). RightPanel.tsx ~lines 1301–1370.
    styleTab: [
      { kind: "alignment" },
      { kind: "typography" },
      { kind: "textShadow" },
      { kind: "custom", render: TextEditorDropCapSection },
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: VIDEO_FIELDS,
    fieldsTab: VIDEO_FIELDS,
    // Style tab — video block: aspect ratio (with custom W/H fallback)
    // + CssFiltersControl. Extracted to a `kind: "custom"` so the
    // aspect-ratio + filter group can be lifted out of RightPanel.tsx
    // (~lines 1372–1425) when F3.5.6 retires the imperative branch.
    styleTab: [
      { kind: "custom", render: VideoSourceSection },
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: BUTTON_FIELDS,
    fieldsTab: BUTTON_FIELDS,
    // Style tab — button block: typography prepended on top of the
    // default container/image-style stack (background, border-radius,
    // border, box-shadow). Mirrors the imperative branch in
    // RightPanel.tsx ~lines 1471–1652 (the `block.type === "button"`
    // arm of the shared default-style render).
    //
    // F3.5.6 followup (Bug 2): the leading `{ kind: "theme" }` was
    // removed because `BackgroundSection` already renders
    // `<ThemeStyleToggle />` inline (sections/BackgroundSection.tsx
    // L57). Top-level `theme` here duplicated the toggle.
    styleTab: [
      { kind: "typography" },
      { kind: "background" },
      { kind: "borderRadius" },
      { kind: "border" },
      { kind: "boxShadow" },
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: ICON_FIELDS,
    fieldsTab: ICON_FIELDS,
    // Style tab — icon block: align + a `kind: "custom"` covering icon
    // color (Normal/Hover), size, and rotate. None of the second group
    // map to a built-in section. RightPanel.tsx ~lines 1427–1461.
    styleTab: [
      { kind: "alignment" },
      { kind: "custom", render: IconBlockStyleSection },
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: HTML_FIELDS,
    fieldsTab: HTML_FIELDS,
    // No styleTab — `html` block hides the Style tab entirely.
    // Expressed as the absence of the property; F3.5.4's `TabRenderer`
    // (and F3.5.6's `getVisibleTabs`) treat `styleTab === undefined` as
    // "hide the Style tab" without any hardcoded type check.
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
      style: { ...EMPTY_STYLE_DEFAULTS },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: DIVIDER_SPACER_FIELDS,
    fieldsTab: DIVIDER_SPACER_FIELDS,
    // Style tab — divider-spacer: today the Style tab is a placeholder
    // ("All settings for this block are in the Fields tab.",
    // RightPanel.tsx ~line 1463). The divider-line picker
    // (style/width/length/color/gradient/align/IconGroup) currently
    // lives on the Fields tab (~lines 958–1267) but logically belongs
    // to the Style tab. F3.5.2 declares it as a `kind: "custom"`
    // entry here so F3.5.6 can route it through the new path.
    styleTab: [
      { kind: "custom", render: DividerLineSection },
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
      // F3.6.1 — merge existing design defaults onto the empty STYLE_PROPS
      // schema. Padding values are pre-existing design defaults (kept).
      // `columnGap` / `rowGap` are layout-only keys not in STYLE_PROPS but
      // consumed by `buildBreakpointCss`'s layoutParts pass — leave them
      // alongside.
      style: {
        ...EMPTY_STYLE_DEFAULTS,
        paddingTop: "12px",
        paddingRight: "12px",
        paddingBottom: "12px",
        paddingLeft: "12px",
        columnGap: "6px",
        rowGap: "6px",
      },
      styleHover: {},
      styleDark: {},
      styleBreakpoints: {},
      styleHoverBreakpoints: {},
      advanced: { ...EMPTY_ADVANCED_DEFAULTS },
    },
    fields: CONTAINER_FIELDS,
    fieldsTab: CONTAINER_FIELDS,
    // Style tab — container: full default stack (background +
    // border-radius + border + box-shadow) shared with image / button
    // via the `block.type === "container" || "image" || "button"`
    // dispatch in RightPanel.tsx ~line 1471.
    //
    // F3.5.6 followup (Bug 2): the leading `{ kind: "theme" }` was
    // removed because `BackgroundSection` already renders
    // `<ThemeStyleToggle />` inline (sections/BackgroundSection.tsx
    // L57). Theme is currently only surfaced via the Background
    // section; if a container-only theme entrypoint is needed later
    // (e.g. a future flex-grid section that also wants the toggle),
    // re-introduce `{ kind: "theme" }` next to that section, not here.
    styleTab: [
      { kind: "background" },
      { kind: "borderRadius" },
      { kind: "border" },
      { kind: "boxShadow" },
    ],
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
