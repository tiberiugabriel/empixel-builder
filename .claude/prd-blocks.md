# empixel-builder — Block System

## Role
Define all block types, their configuration schemas, and metadata. Single source of truth for editor UI and frontend rendering.

## Files
- `src/types.ts` — TypeScript `BlockType` union + all config interfaces
- `src/admin/blockDefinitions.ts` — `BLOCK_DEFINITIONS: BlockDef[]` array

## Block Definition Schema

### BlockDef interface
```ts
interface BlockDef {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
  category: "core" | "general";
  defaultConfig: Record<string, any>;
  fields: FieldDef[];
  styleFields?: FieldDef[];   // Shown at top of Style tab
}
```

### FieldDef interface
```ts
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "url" | "textarea" | "number" | "select" | "toggle" | "json-array" | "link";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  required?: boolean;
  labelClassName?: string;
  showWhen?: { key: string; value: string };  // Conditional render
  itemFields?: FieldDef[];   // For json-array: sub-field schema
}
```

### FieldType values
| Type | Rendered as | Value stored |
|------|-------------|--------------|
| `text` | `<input type="text">` | string |
| `url` | `<input type="url">` | string |
| `textarea` | `<textarea rows=3>` | string |
| `number` | `<input type="number">` | number |
| `select` | `<select>` | string |
| `toggle` | checkbox + inline label | boolean |
| `json-array` | JsonArrayField | array |
| `link` | LinkControl | `{ href, newTab, nofollow, customAttr }` |

## Current Blocks (v0.5.0)

### BlockType union (src/types.ts)
```ts
export type BlockType =
  | "testimonials"
  | "faq"
  | "pricing"
  | "spacer"
  | "container"
  | "text"
  | "image";
```

### 1. testimonials
- Category: general
- Fields: headline, layout (grid/carousel), items (json-array)
- Item fields: quote, author, role, company, avatarUrl
- Default: `{ layout: "grid", theme: "light", items: [] }`

### 2. faq
- Category: general
- Fields: headline, subheadline, items (json-array)
- Item fields: question, answer
- Default: `{ theme: "light", items: [] }`

### 3. pricing
- Category: general
- Fields: headline, subheadline, tiers (json-array)
- Tier fields: name, price, period, description, features, ctaLabel, ctaUrl, highlighted
- Default: `{ theme: "light", tiers: [] }`

### 4. container
- Category: core
- Fields: none (layout-only block)
- Default: `{ theme: "light", layout: "flex", style: { paddingTop/Right/Bottom/Left: "12px", columnGap/rowGap: "6px" } }`
- Holds: `children: SectionBlock[]`
- Extra fields tab controls: LayoutControl, GapControl, OverflowControl, HTML Tag, LinkControl (if tag = "a")

### 5. spacer
- Category: core
- Fields: height (sm/md/lg/xl), showDivider
- Default: `{ height: "md", showDivider: false }`

### 6. text
- Category: general
- Fields: content (textarea), HTML Tag selector (default `p`; supports h1–h6, span, div, a), LinkControl (if tag = "a")
- Default: `{ content: "", theme: "light" }`
- **Style tab is custom**: Align / Typography / TextStroke / TextShadow / BlendMode (no Background/Border/Shadow sections)
- Config: `TextConfig` — `content`, `htmlTag`, `linkHref`, `linkNewTab`, `linkNofollow`, `linkCustomAttr`, `theme`

### 7. image
- Category: general
- Fields: caption (textarea), MediaPicker thumbnail row, Resolution selector (full / thumbnail / medium / large), LinkControl (always available)
- Default: `{ theme: "light", resolution: "full" }`
- **Style tab is custom**: Width/Height (writes to `imgStyle`, not `style`), Object Fit, Object Position, Align, Opacity (normal/hover) — no Background/Border/Shadow sections at root (border/radius/shadow target inner `<img>` via `imgStyle`-equivalent CSS)
- Config: `ImageConfig` — `image: ImageMediaRef`, `resolution`, `caption`, `linkHref`, `linkNewTab`, `linkNofollow`, `linkCustomAttr`, `theme`, `imgStyle: ImageElementStyle`

```ts
interface ImageMediaRef {
  id: string;
  storageKey: string;
  alt?: string;
  filename?: string;
}

type ImageResolution = "thumbnail" | "medium" | "large" | "full";

interface ImageElementStyle {
  width?: string; minWidth?: string; maxWidth?: string;
  height?: string; minHeight?: string; maxHeight?: string;
  objectFit?: string;
  objectPosition?: string;
}
```

## SectionBlock (Tree Node)

```ts
interface SectionBlock {
  id: string;                    // UUID
  type: BlockType;
  config: Record<string, any>;   // Flat config object
  children?: SectionBlock[];     // Container: child blocks
  slots?: SectionBlock[][];      // Columns: col arrays
}
```

### Container types
```ts
export const CONTAINER_TYPES: BlockType[] = ["container"];
export function isContainerType(type: BlockType): boolean;
```

Only container types can be placed at the top level of the canvas.
Leaf blocks must be dropped inside a container.

## Config Structure Conventions

Each block's config may contain any combination of:
- Block-specific keys (e.g. `items`, `tiers`, `layout`)
- `theme` — "light" | "dark" | "accent"
- `style` — CSS properties for normal/light state
- `styleDark` — CSS properties for dark theme
- `styleAccent` — CSS properties for accent theme
- `styleHover` — CSS properties for hover state
- `styleBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` breakpoint overrides
- `styleHoverBreakpoints` — `{ [bpId]: { _px, ...cssProps } }` hover breakpoint overrides
- `advanced` — `{ position, top, right, bottom, left, zIndex, cssId, cssClasses, customCss }`
- `htmlTag` — semantic HTML element for container
- `linkHref`, `linkTarget` — for `<a>` containers

## Helpers

```ts
export function parseItems<T>(json: unknown, fallback: T[] = []): T[]
```
Safely parses JSON array from DB (may be string or already array).

## Rules

- **Every `BlockType` in `types.ts` must have a matching `BlockDef` in `blockDefinitions.ts`**
- **defaults must match type interface exactly**
- **Shared field objects** (like a THEME_FIELD) should be factored out, not duplicated
- **Preview component** must exist for every block
- **Astro frontend component** must exist for every block

## Adding a New Block

1. Add `BlockType` to union in `src/types.ts`
2. Add config interface to `src/types.ts`
3. Add `BlockDef` entry to `BLOCK_DEFINITIONS` in `blockDefinitions.ts`
4. Add preview component in `src/admin/previews/`
5. Register in `src/admin/previews/index.ts` (`PREVIEW_COMPONENTS` map)
6. Add Astro component in `src/components/`
7. Register in `src/components/index.ts` (`blockComponents` map)
8. Register in `src/components/BlockRenderer.astro`

## Blocks To Add

| Block | Category | Key fields |
|-------|----------|------------|
| `hero` | general | headline, subheadline, ctaLabel, ctaUrl, backgroundImage |
| `features-grid` | general | headline, items (icon, title, description) |
| `image-text` | general | headline, body, image, imagePosition |
| `cta` | general | headline, subheadline, ctaLabel, ctaUrl |
| `stats` | general | headline, items (label, value) |
| `gallery` | general | images (src, alt, caption) |
| `columns` | core | columnCount, slots |
| `heading` | core | text, level (h1-h6), align |
| `paragraph` | core | text, align |
| `rich-text` | core | content (Portable Text) |
| `html` | core | content (raw HTML) |

(Video as standalone block is on hold — video backgrounds already supported via `BackgroundControl` on container.)

## TODO

- [ ] Expand `BlockType` union with remaining block types
- [ ] Write `BlockDef` for each new block
- [ ] Add generic `image` field type to FieldDef (wires MediaPicker for non-image blocks)
- [ ] Add `rich-text` field type (Portable Text editor)
- [ ] Consider block categories: core / general / experimental
