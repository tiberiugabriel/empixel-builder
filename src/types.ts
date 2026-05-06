// ─── Block Types ──────────────────────────────────────────────────────────────

export type BlockType =
  | "testimonials"
  | "faq"
  | "pricing"
  | "spacer"
  | "container"
  | "text"
  | "image";

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

export interface SpacerConfig {
  height?: "sm" | "md" | "lg" | "xl";
  showDivider?: boolean;
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

