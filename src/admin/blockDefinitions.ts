import type { BlockType } from "../types.js";

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
        labelClassName: "epx-row-label--section",
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
];

export function getBlockDef(type: BlockType): BlockDef | undefined {
  return BLOCK_DEFINITIONS.find((d) => d.type === type);
}
