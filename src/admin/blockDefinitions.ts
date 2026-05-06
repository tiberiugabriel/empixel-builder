import type { BlockType } from "../types.js";

// ─── Field Schema ─────────────────────────────────────────────────────────────

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "select" | "toggle" | "number" | "json-array" | "link";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  labelClassName?: string;
  /** Show this field only when another field's value matches */
  showWhen?: { key: string; value: string };
  /** For json-array: schema of each item's sub-fields */
  itemFields?: FieldDef[];
}

// ─── Block Definition ─────────────────────────────────────────────────────────

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultConfig: Record<string, any>;
  fields: FieldDef[];
  /** Block-specific fields rendered at the top of the Style tab */
  styleFields?: FieldDef[];
}

// ─── Shared Fields ────────────────────────────────────────────────────────────


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
    type: "testimonials",
    label: "Testimonials",
    icon: "💬",
    description: "Customer testimonials and reviews",
    category: "general",
    defaultConfig: {
      layout: "grid",
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "What Our Customers Say" },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "grid", label: "Grid" },
          { value: "carousel", label: "Carousel" },
        ],
      },
      {
        key: "items",
        label: "Testimonials",
        type: "json-array",
        itemFields: [
          { key: "quote", label: "Quote", type: "textarea", placeholder: "The testimonial text..." },
          { key: "author", label: "Author Name", type: "text", placeholder: "John Doe" },
          { key: "role", label: "Role / Title", type: "text", placeholder: "CEO" },
          { key: "company", label: "Company", type: "text", placeholder: "Acme Corp" },
          { key: "avatarUrl", label: "Avatar URL", type: "url", placeholder: "https://..." },
        ],
      },
    ],
  },

  {
    type: "faq",
    label: "FAQ Section",
    icon: "❓",
    description: "Frequently asked questions with accordion",
    category: "general",
    defaultConfig: {
      theme: "light",
      items: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Frequently Asked Questions" },
      { key: "subheadline", label: "Section Subheadline", type: "textarea", placeholder: "Supporting text..." },
      {
        key: "items",
        label: "Questions",
        type: "json-array",
        itemFields: [
          { key: "question", label: "Question", type: "text", placeholder: "What is...?" },
          { key: "answer", label: "Answer", type: "textarea", placeholder: "The answer is..." },
        ],
      },
    ],
  },

  {
    type: "pricing",
    label: "Pricing Table",
    icon: "💰",
    description: "Pricing tiers with feature lists",
    category: "general",
    defaultConfig: {
      theme: "light",
      tiers: [],
    },
    fields: [
      { key: "headline", label: "Section Headline", type: "text", placeholder: "Simple Pricing" },
      { key: "subheadline", label: "Section Subheadline", type: "textarea", placeholder: "Supporting text..." },
      {
        key: "tiers",
        label: "Pricing Tiers",
        type: "json-array",
        itemFields: [
          { key: "name", label: "Tier Name", type: "text", placeholder: "Pro" },
          { key: "price", label: "Price", type: "text", placeholder: "$49" },
          { key: "period", label: "Period", type: "text", placeholder: "/month" },
          { key: "description", label: "Description", type: "textarea", placeholder: "For growing teams" },
          { key: "features", label: "Features (one per line)", type: "textarea", placeholder: "Feature 1\nFeature 2\nFeature 3" },
          { key: "ctaLabel", label: "CTA Label", type: "text", placeholder: "Get Started" },
          { key: "ctaUrl", label: "CTA URL", type: "url", placeholder: "https://..." },
          { key: "highlighted", label: "Highlighted (recommended)", type: "toggle" },
        ],
      },
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

  {
    type: "spacer",
    label: "Spacer",
    icon: "↕️",
    description: "Vertical spacing or divider line",
    category: "core",
    defaultConfig: {
      height: "md",
      showDivider: false,
    },
    fields: [
      {
        key: "height",
        label: "Height",
        type: "select",
        options: [
          { value: "sm", label: "Small (32px)" },
          { value: "md", label: "Medium (64px)" },
          { value: "lg", label: "Large (96px)" },
          { value: "xl", label: "Extra Large (128px)" },
        ],
      },
      { key: "showDivider", label: "Show Divider Line", type: "toggle" },
    ],
  },
];

export function getBlockDef(type: BlockType): BlockDef | undefined {
  return BLOCK_DEFINITIONS.find((d) => d.type === type);
}
