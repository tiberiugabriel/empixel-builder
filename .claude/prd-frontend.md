# empixel-builder — Frontend Components (Astro)

## Role
Server-rendered Astro components that render blocks to HTML. Zero client-side JavaScript.

## Architecture

```
src/components/
├─ index.ts              # Exports: blockComponents map, getBuilderLayout, LayoutRenderer, BuilderWrapper
├─ BlockRenderer.astro   # Leaf-block dispatcher (testimonials/faq/pricing/spacer/text/image)
├─ LayoutRenderer.astro  # Iterates sections; routes containers to SectionContainer, leaves to BlockRenderer
├─ SectionContainer.astro # container block (renders children, handles layout/video/link)
├─ BuilderWrapper.astro  # Wrapper for builder-enabled pages
├─ styleUtils.ts         # CSS generation from block config (selector-based, not inline)
├─ db.ts                 # getBuilderLayout() database query
├─ Testimonials.astro    # testimonials block
├─ FaqSection.astro      # faq block
├─ PricingSection.astro  # pricing block
├─ SpacerSection.astro   # spacer block
├─ Text.astro            # text block
└─ Image.astro           # image block
```

## blockComponents map (index.ts)

```ts
export const blockComponents: Record<string, unknown> = {
  testimonials: Testimonials,
  faq: FaqSection,
  pricing: PricingSection,
  spacer: SpacerSection,
  text: Text,
  image: ImageBlock,
};
```

Every leaf `BlockType` must have an entry here. `container` is rendered by `SectionContainer.astro` directly (not via `blockComponents`).

## LayoutRenderer (root)

Iterates `layout.sections`. Containers go through `SectionContainer.astro` (which handles its own children recursively); leaves go to `BlockRenderer`.

```astro
---
import type { SectionBlock } from "../types.js";
import BlockRenderer from "./BlockRenderer.astro";
import SectionContainer from "./SectionContainer.astro";

interface Props { sections: SectionBlock[]; }
const { sections } = Astro.props;
---
{sections.map((block) => block.type === "container"
  ? <SectionContainer value={block.config} children={block.children ?? []} blockId={block.id} />
  : <BlockRenderer block={block} />
)}
```

## BlockRenderer (leaf dispatcher)

Routes to the correct Astro component by `block.type`. Builds CSS via `buildBlockCss` / `buildHoverCss` / `getCustomCss` and injects a single global `<style>` block.

- `text` → `<Text value={block.config} blockId={block.id} />`
- `image` → `<ImageBlock value={block.config} blockId={block.id} />`
- `testimonials` / `faq` / `pricing` / `spacer` → `<Component value={block.config} />` inside a wrapper `<div data-epx-block>` (which also hosts an optional video background overlay)

## SectionContainer.astro

Owns the full container rendering pipeline:
- Resolves padding from `style.*` with legacy named-spacing fallback (`sm`/`md`/`lg`/`xl`)
- Renders flex or grid layout (mode from `value.layout`)
- Composes block CSS via `wrapBlockCss(buildBlockStyle + layoutStyle, blockId)`
- Renders hover, breakpoint, breakpoint-hover, and custom CSS in a single `<style is:global>`
- Renders video backgrounds: HTML5 `<video>`, YouTube iframe, Vimeo iframe (with start/end time, loop, fallback poster)
- HTML tag from `value.htmlTag` (default `section`); when tag = `a`, applies `linkHref`/`linkTarget`/`linkRel` and parses `linkCustomAttr`
- Recursively renders children — nested containers re-enter via `<Astro.self>`

## Block Component Pattern (leaves)

```astro
---
import type { TextConfig } from "../types.js";
import { buildBlockCss, buildHoverCss, getCustomCss } from "./styleUtils.js";

interface Props { value: TextConfig; blockId?: string; }
const { value, blockId } = Astro.props;
const Tag = ((value.htmlTag || "p") as astroHTML.JSX.HTMLTag);

const config = value as Record<string, unknown>;
const allCss = [
  buildBlockCss(config, blockId!),
  buildHoverCss(config, blockId!),
  getCustomCss(config, blockId!),
].filter(Boolean).join("");
---

<Tag data-epx-block={blockId}>{value.content}</Tag>
{allCss && <style set:html={allCss} is:global />}
```

### Props Pattern Rules
- Leaves take `{ value: ConfigType, blockId?: string }` (not the full `SectionBlock`)
- Container takes `{ value, children, blockId }`
- `data-epx-block="<id>"` is the canonical CSS hook on the root element
- All CSS is **selector-based**, injected via `<style set:html={...} is:global />` (not inline `style=""`) so that hover, breakpoints, and custom CSS can reference the block

## Nested Rendering

### Container
Handled by `SectionContainer.astro` — recurses via `<Astro.self>` for nested containers.

### Image block
Renders as `<figure>` (when caption present) or `<a>` (when link present, no caption) or `<div>`. Inner `<img>` carries `imgStyle` inline plus visual CSS (border/radius/shadow) from `buildImgVisualCss` scoped to `[data-epx-block="<id>"] img{…}`.

## Style Utilities (styleUtils.ts)

All exports return CSS **strings** (selector-based rules), not inline declarations. Caller is responsible for wrapping them in `<style is:global>`.

| Function | Purpose |
|----------|---------|
| `buildBlockStyle(config, opts?)` | Inline-ready CSS body (no selector) for the block — combines background, border, text color, all `STYLE_PROPS`, box-shadow, text-stroke, text-shadow, position/offset, z-index, opacity, auto `overflow:hidden` heuristic |
| `buildBlockCss(config, blockId, opts?)` | Same as above wrapped in `[data-epx-block="<id>"]{…}` |
| `wrapBlockCss(styleStr, blockId)` | Selector wrapper helper |
| `buildBackgroundCss(style)` | Color / gradient / image / slideshow background CSS (video handled separately) |
| `buildHoverCss(config, blockId, opts?)` | `:hover` selector with `!important` declarations from `styleHover` |
| `buildBreakpointCss(config, blockId, layoutSelector?)` | Media-query rules from `styleBreakpoints` (visual props on root, layout/gap props on `layoutSelector`) |
| `buildBreakpointHoverCss(config, blockId)` | `@media + :hover` rules from `styleHoverBreakpoints` |
| `buildImgVisualCss(config, blockId)` | `[data-epx-block="<id>"] img{…}` — border/radius/shadow scoped to inner `<img>` |
| `buildImgVisualHoverCss(config, blockId)` | Same as above for `:hover img` |
| `getEffectiveStyle(config)` | Merges `style` + `styleDark` when `theme === "dark"` (accent not yet implemented) |
| `getVideoBackground(config)` | Resolves video URL from storage key or external URL |
| `getVideoInfo(config)` | Detects YouTube / Vimeo / HTML5 from URL pattern |
| `buildYouTubeEmbedUrl(id, opts)` / `buildVimeoEmbedUrl(id, opts)` | Embed URL construction with autoplay/mute/loop/start/end |
| `getBlockId(config)` / `getBlockClass(config)` | Reads `advanced.cssId` / `advanced.cssClasses` |
| `getCustomCss(config, blockId)` | Wraps `advanced.customCss` in `[data-epx-block="<id>"]{…}` |

## Database Query (db.ts)

### getBuilderLayout(pageId, collection)
```ts
export async function getBuilderLayout(pageId: string, collection: string): Promise<PageLayout | null>
```
- Queries `empixel_builder_layouts` WHERE `collection = ? AND entry_id = ?`
- Resolves slug ↔ ULID same as backend API
- Deserializes `sections` JSON string → `SectionBlock[]`
- Returns `{ sections, updatedAt }` or `null`

## Image Fields

Image fields are objects: `{ src, alt }`.

Use EmDash `<Image>` component:
```astro
import { Image } from "emdash/ui";
<Image image={config.backgroundImage} />
```

Never use raw `<img>`. Never assume image is a string.

## Props Flow (Page → Blocks)

```astro
---
// In an Astro page:
import { getBuilderLayout, LayoutRenderer } from "empixel-builder/components";

const layout = await getBuilderLayout(entry.id, collection);
Astro.cache.set(cacheHint);
---

{layout && <LayoutRenderer layout={layout} />}
```

## BuilderWrapper

Wraps pages with builder-related metadata/attributes. Usage TBD.

## Rules

- All components are **server-rendered** (no client JS, no `client:*` directives) — except a tiny inline `<script>` in `SectionContainer.astro` for HTML5 video start/end time control
- **Image fields** for the image block are `ImageMediaRef` objects with `storageKey`; URL is `/_emdash/api/media/file/${storageKey}`
- **Use `buildBlockCss(config, blockId)`** plus `<style set:html is:global>` — never raw inline `style=""` for block-level CSS (inline is only used for runtime overrides like image `imgStyle`)
- **Use `data-epx-block` attribute** on root element of each block
- **No duplicate logic** between admin previews and frontend components
- **Cache pages** that query layouts (`Astro.cache.set(cacheHint)`)

## TODO

- [ ] Add Astro components for all remaining block types (hero, features-grid, etc.)
- [ ] Register new components in `blockComponents` and `BlockRenderer.astro`
- [x] Implement breakpoint media queries (`buildBreakpointCss` / `buildBreakpointHoverCss`)
- [x] Apply hover CSS via `:hover` pseudo-selector from `styleHover`
- [x] Apply dark-theme CSS from `styleDark` (via `getEffectiveStyle`)
- [ ] Apply accent-theme CSS from `styleAccent` (scoped via `data-theme="accent"`)
- [ ] Add responsive image optimization (`<picture>` / `srcset`)
- [ ] Add SEO metadata (og:image, schema.org)
- [ ] Test nested containers (3+ levels deep)
