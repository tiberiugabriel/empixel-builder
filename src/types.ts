// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "container"
  | "text"
  | "image"
  | "text-editor"
  | "video"
  | "button"
  | "icon"
  | "html"
  | "divider-spacer";

/** Block types that can contain other blocks */
export const CONTAINER_TYPES: BlockType[] = ["container"];

export function isContainerType(type: BlockType): boolean {
  return CONTAINER_TYPES.includes(type);
}

/**
 * Block types that may sit at the canvas root level (not nested inside a
 * container). Container is always root-allowed; `html` and `divider-spacer`
 * are also acceptable at root because they are self-contained chrome
 * (raw markup / pure spacing). Every other leaf block must live inside a
 * container.
 */
export const ROOT_ALLOWED_TYPES: BlockType[] = ["container", "html", "divider-spacer"];

export function isRootAllowedType(type: BlockType): boolean {
  return ROOT_ALLOWED_TYPES.includes(type);
}

/** Set of all known block types — used to silently drop layout entries
 *  whose `type` was removed (variant B cleanup, audit follow-up). */
export const BLOCK_TYPES: ReadonlySet<string> = new Set<BlockType>([
  "container",
  "text",
  "image",
  "text-editor",
  "video",
  "button",
  "icon",
  "html",
  "divider-spacer",
]);

export function isKnownBlockType(type: string): type is BlockType {
  return BLOCK_TYPES.has(type);
}

/**
 * Recursively strip nodes whose `type` is not in the current `BlockType`
 * union. Idempotent. Applied at the load path so old layouts that still
 * contain removed types (e.g. the v0.6 → post-v0.6 testimonials/faq/pricing
 * removal) load cleanly. Orphans leave the DB on the next save.
 *
 * Returns a new array; never mutates the input.
 */
export function stripUnknownBlocks(sections: SectionBlock[]): SectionBlock[] {
  const out: SectionBlock[] = [];
  for (const block of sections) {
    if (!isKnownBlockType(block.type)) continue;
    let next = block;
    if (block.children) {
      next = { ...next, children: stripUnknownBlocks(block.children) };
    }
    if (block.slots) {
      next = { ...next, slots: block.slots.map((slot) => stripUnknownBlocks(slot)) };
    }
    out.push(next);
  }
  return out;
}

// ─── Shared block-level types (lifted from per-block configs) ────────────────

export type Theme = "light" | "dark";

/** A bag of CSS-like properties (camelCase keys, string/number values).
 *  Permissive on purpose — styleUtils consumes via cssStr / cssVal helpers. */
export type CssProps = Record<string, unknown>;

/** Per-breakpoint overrides carry a `_px` boundary alongside the CSS keys. */
export type BreakpointStyleEntry = CssProps & { _px?: number };

export interface AdvancedConfig {
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number | string;
  cssId?: string;
  cssClasses?: string;
  customCss?: string;
}

/** Common keys present on (almost) every block's config. Extended with an
 *  open `Record<string, unknown>` so callers can keep accessing one-off keys
 *  via `(config.foo as Bar)` without TS friction during incremental migration. */
export interface BaseBlockConfig extends Record<string, unknown> {
  theme?: Theme;
  style?: CssProps;
  styleDark?: CssProps;
  styleHover?: CssProps;
  styleBreakpoints?: Record<string, BreakpointStyleEntry>;
  styleHoverBreakpoints?: Record<string, BreakpointStyleEntry>;
  advanced?: AdvancedConfig;
  configBreakpoints?: Record<string, Record<string, unknown>>;
}

// ─── Section Block (stored in layout) ─────────────────────────────────────────

/**
 * Broad shape used by tree utilities, reducer and storage. Config typed as
 * `BaseBlockConfig` (open index signature) so generic mutations like
 * `{ ...b, config: { ...b.config, ...patch } }` keep compiling without
 * casts. For type-narrowed reads use `TypedSectionBlock` below.
 */
export interface SectionBlock {
  id: string;
  type: BlockType;
  config: BaseBlockConfig;
  /** Children blocks — for type === "container" */
  children?: SectionBlock[];
  /** Slotted children — slots[0] = col1, slots[1] = col2, ... */
  slots?: SectionBlock[][];
}

interface TypedSectionBlockBase {
  id: string;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
}

/**
 * Discriminated over `type`. Each branch carries its specific config interface.
 * Use this in new code (or migrated branches) where you switch on `block.type`
 * and want `block.config` typed precisely. Convert via `asTyped(block)`.
 *
 * Migration path (audit M4): consumers move from `SectionBlock` →
 * `TypedSectionBlock` one at a time. RightPanel per-block branches and
 * BlockRenderer dispatch are the natural first consumers.
 */
export type TypedSectionBlock =
  | (TypedSectionBlockBase & { type: "container";     config: ContainerConfig })
  | (TypedSectionBlockBase & { type: "text";          config: TextConfig })
  | (TypedSectionBlockBase & { type: "image";         config: ImageConfig })
  | (TypedSectionBlockBase & { type: "text-editor";   config: TextEditorConfig })
  | (TypedSectionBlockBase & { type: "video";         config: VideoConfig })
  | (TypedSectionBlockBase & { type: "button";        config: ButtonConfig })
  | (TypedSectionBlockBase & { type: "icon";          config: IconConfig })
  | (TypedSectionBlockBase & { type: "html";          config: HtmlConfig })
  | (TypedSectionBlockBase & { type: "divider-spacer"; config: DividerSpacerConfig });

/** Type-narrow a broad SectionBlock to its discriminated counterpart. */
export function asTyped(block: SectionBlock): TypedSectionBlock {
  return block as unknown as TypedSectionBlock;
}

// ─── Page Layout ──────────────────────────────────────────────────────────────

export interface PageLayout {
  sections: SectionBlock[];
  updatedAt: string;
}

// ─── Block Config Interfaces ──────────────────────────────────────────────────

export interface ContainerConfig extends BaseBlockConfig {
  layout?: "flex" | "grid";
  htmlTag?: string;
  flexWrap?: string;
  flexDirection?: string;
  justifyContent?: string;
  flexAlignItems?: string;
  alignItems?: string;
  gridFlow?: string;
  justifyItems?: string;
  gridColumns?: string;
  gridRows?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
}

export interface TextConfig extends BaseBlockConfig {
  content?: string;
  htmlTag?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
}

export interface ImageMediaRef {
  id: string;
  storageKey: string;
  alt?: string;
  filename?: string;
}

export type ImageResolution = "thumbnail" | "medium" | "large" | "full";

export interface ImageElementStyle {
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  objectFit?: string;
  objectPosition?: string;
}

export interface ImageConfig extends BaseBlockConfig {
  image?: ImageMediaRef;
  resolution?: ImageResolution;
  caption?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  imgStyle?: ImageElementStyle;
}

// ─── Icon group (used by Video overlay, Button, Icon, Divider-Spacer) ────────

export interface IconGroupValue {
  iconSrc?: ImageMediaRef;
  iconSize?: string;
  iconColor?: string;
  iconColorAlpha?: number;
  iconPosition?: "left" | "right" | "top" | "bottom" | "center" | "above" | "below";
}

// ─── Text Editor Block ────────────────────────────────────────────────────────

// Portable Text JSON — kept loose to avoid hard runtime coupling to @portabletext.
export type RichTextValue = unknown[];

export interface TextEditorConfig extends BaseBlockConfig {
  content?: RichTextValue;
  dropCap?: boolean;
  columns?: "1" | "2" | "3" | "custom";
  columnsCustom?: number;
  columnsGap?: string;
}

// ─── Video Block ──────────────────────────────────────────────────────────────

export type VideoProvider = "youtube" | "vimeo" | "custom";

export interface VideoSourceValue {
  src?: "media" | "url";
  media?: ImageMediaRef;
  url?: string;
  provider?: VideoProvider;
  autoplay?: boolean;
  mute?: boolean;
  controls?: boolean;
  captions?: boolean;
  lazyLoad?: boolean;
  controlsColor?: string;
  /** Vimeo only */
  introTitle?: boolean;
  introPortrait?: boolean;
  introByline?: boolean;
}

export interface VideoOverlayValue {
  image?: ImageMediaRef;
  resolution?: ImageResolution;
  size?: "cover" | "contain" | "auto";
  position?: string;
  icon?: IconGroupValue;
}

export interface VideoConfig extends BaseBlockConfig {
  video?: VideoSourceValue;
  overlay?: VideoOverlayValue;
  aspectRatio?: "1:1" | "3:2" | "4:3" | "16:9" | "21:9" | "9:16" | "custom";
  aspectRatioCustomW?: string;
  aspectRatioCustomH?: string;
}

// ─── Button Block ─────────────────────────────────────────────────────────────

export interface ButtonConfig extends BaseBlockConfig {
  text?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  icon?: IconGroupValue;
}

// ─── Icon Block ───────────────────────────────────────────────────────────────

export interface IconConfig extends BaseBlockConfig {
  icon?: IconGroupValue;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  rotate?: string;
}

// ─── HTML Block ───────────────────────────────────────────────────────────────

export interface HtmlConfig extends BaseBlockConfig {
  code?: string;
}

// ─── Divider / Spacer Block ───────────────────────────────────────────────────

export type DividerStyle =
  | "none"
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "gradient"
  | "wavy"
  | "zigzag";

export interface DividerGradientStop {
  color: string;
  alpha: number;
  pos: number;
}

export interface DividerGradient {
  angle?: number;
  stops?: DividerGradientStop[];
}

export interface DividerConfig {
  style?: DividerStyle;
  width?: string;
  length?: string;
  color?: string;
  colorAlpha?: number;
  align?: "left" | "center" | "right";
  icon?: IconGroupValue;
  gradient?: DividerGradient;
}

export interface DividerSpacerConfig extends BaseBlockConfig {
  space?: string;
  divider?: DividerConfig;
}

// ─── Breakpoints ──────────────────────────────────────────────────────────────

export type BreakpointId =
  | "desktop"
  | "laptop"
  | "tablet-landscape"
  | "tablet-portrait"
  | "mobile-landscape"
  | "mobile-portrait";

export interface BreakpointDef {
  id: BreakpointId;
  label: string;
  defaultPx: number | null; // null = Desktop (current screen)
  removable: boolean;
}

export const BREAKPOINT_DEFS: BreakpointDef[] = [
  { id: "desktop",          label: "Desktop",          defaultPx: null, removable: false },
  { id: "laptop",           label: "Laptop",           defaultPx: 1440, removable: true  },
  { id: "tablet-landscape", label: "Tablet Landscape", defaultPx: 1240, removable: true  },
  { id: "tablet-portrait",  label: "Tablet Portrait",  defaultPx: 992,  removable: false },
  { id: "mobile-landscape", label: "Mobile Landscape", defaultPx: 767,  removable: true  },
  { id: "mobile-portrait",  label: "Mobile Portrait",  defaultPx: 575,  removable: false },
];

export interface BreakpointOverride {
  id: BreakpointId;
  px: number;
}

export interface BreakpointsConfig {
  enabled: BreakpointId[];
  overrides: BreakpointOverride[];
}

export const DEFAULT_BREAKPOINTS_CONFIG: BreakpointsConfig = {
  enabled: ["desktop", "tablet-portrait", "mobile-portrait"],
  overrides: [],
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export function parseItems<T>(json: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(json)) return json as T[];
  if (typeof json === "string") {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

