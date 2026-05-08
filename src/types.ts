// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "testimonials"
  | "faq"
  | "pricing"
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

// ─── Section Block (stored in layout) ─────────────────────────────────────────

export interface SectionBlock {
  id: string;
  type: BlockType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>;
  /** Children blocks — for type === "container" */
  children?: SectionBlock[];
  /** Slotted children — slots[0] = col1, slots[1] = col2, ... */
  slots?: SectionBlock[][];
}

// ─── Page Layout ──────────────────────────────────────────────────────────────

export interface PageLayout {
  sections: SectionBlock[];
  updatedAt: string;
}

// ─── Block Config Interfaces ──────────────────────────────────────────────────

export interface TestimonialItem {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
}

export interface TestimonialsConfig {
  headline?: string;
  layout?: "grid" | "carousel";
  theme?: "light" | "dark";
  items: TestimonialItem[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqConfig {
  headline?: string;
  subheadline?: string;
  theme?: "light" | "dark";
  items: FaqItem[];
}

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string;
  ctaLabel: string;
  ctaUrl: string;
  highlighted?: boolean;
}

export interface PricingConfig {
  headline?: string;
  subheadline?: string;
  theme?: "light" | "dark";
  tiers: PricingTier[];
}

export interface TextConfig {
  content?: string;
  htmlTag?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  theme?: "light" | "dark";
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

export interface ImageConfig {
  image?: ImageMediaRef;
  resolution?: ImageResolution;
  caption?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  theme?: "light" | "dark";
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

export interface TextEditorConfig {
  content?: RichTextValue;
  dropCap?: boolean;
  columns?: "1" | "2" | "3" | "custom";
  columnsCustom?: number;
  columnsGap?: string;
  theme?: "light" | "dark";
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

export interface VideoConfig {
  video?: VideoSourceValue;
  overlay?: VideoOverlayValue;
  aspectRatio?: "1:1" | "3:2" | "4:3" | "16:9" | "21:9" | "9:16" | "custom";
  aspectRatioCustomW?: string;
  aspectRatioCustomH?: string;
  theme?: "light" | "dark";
}

// ─── Button Block ─────────────────────────────────────────────────────────────

export interface ButtonConfig {
  text?: string;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  icon?: IconGroupValue;
  theme?: "light" | "dark";
}

// ─── Icon Block ───────────────────────────────────────────────────────────────

export interface IconConfig {
  icon?: IconGroupValue;
  linkHref?: string;
  linkNewTab?: boolean;
  linkNofollow?: boolean;
  linkCustomAttr?: string;
  rotate?: string;
  theme?: "light" | "dark";
}

// ─── HTML Block ───────────────────────────────────────────────────────────────

export interface HtmlConfig {
  code?: string;
  theme?: "light" | "dark";
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

export interface DividerSpacerConfig {
  space?: string;
  divider?: DividerConfig;
  theme?: "light" | "dark";
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

