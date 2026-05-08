# empixel-builder — Frontend Components (Astro)

## Role
Server-rendered Astro components that render blocks to HTML. Zero client-side JavaScript.

## Architecture

```
src/components/
├─ index.ts              # Exports: blockComponents map (12 entries), getBuilderLayout, LayoutRenderer, BuilderWrapper
├─ BlockRenderer.astro   # Leaf-block dispatcher (12 leaves)
├─ LayoutRenderer.astro  # Iterates sections; routes containers to SectionContainer, leaves to BlockRenderer
├─ SectionContainer.astro # container block (renders children, handles layout/video/link)
├─ BuilderWrapper.astro  # Wrapper for builder-enabled pages
├─ styleUtils.ts         # CSS generation from block config (selector-based)
├─ db.ts                 # getBuilderLayout() database query
├─ Testimonials.astro    # testimonials block
├─ FaqSection.astro      # faq block
├─ PricingSection.astro  # pricing block
├─ Text.astro            # text block
├─ Image.astro           # image block
├─ TextEditor.astro      # v0.6 — Portable Text via emdash/ui (lazy import, plain-text fallback)
├─ Video.astro           # v0.6 — YT/Vimeo/HTML5 embed + image overlay click-to-play
├─ Button.astro          # v0.6 — <a> | <button>, icon flex order
├─ Icon.astro            # v0.6 — SVG mask color or <img> for PNG, optional rotate + drop-shadow filter
├─ Html.astro            # v0.6 — raw set:html (trusted input, not sanitized)
└─ DividerSpacer.astro   # v0.6 — fixed-height block + optional decorative divider (solid/dashed/.../wavy/zigzag/gradient)
```

## blockComponents map (index.ts)

```ts
export const blockComponents: Record<string, unknown> = {
  testimonials: Testimonials,
  faq: FaqSection,
  pricing: PricingSection,
  text: Text,
  image: ImageBlock,
  "text-editor": TextEditor,
  video: Video,
  button: Button,
  icon: Icon,
  html: Html,
  "divider-spacer": DividerSpacer,
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

## v0.6+ — frontend updates

- **HTML block** rendered inside a sandboxed iframe with `srcdoc` (`sandbox="allow-scripts allow-same-origin"`, `scrolling="no"`) so site CSS doesn't cross in and the block's `<style>`/`<script>` doesn't leak out. If user code already has `<html>`, srcdoc reuses it; else minimal shell wraps the fragment. Auto-resize via parent script (idempotent global flag) reads `iframe.contentDocument.documentElement.scrollHeight` after `load` + `ResizeObserver` + `MutationObserver` + img loads + 100ms polling for first 2s. Iframe collapsed to `0px` before measurement to neutralize `vh`/`100%` body height feedback. Iframe IS the `data-epx-block` element (no wrapper `<div>`); inline style + global rule force `width: 100%; border: none` regardless of flex/grid parent.
- **Text Editor block** (`TextEditor.astro`) emits per-breakpoint media queries by walking the union of `configBreakpoints` + `styleBreakpoints` for `column-count`, `column-gap`, and `::first-letter` rule (drop cap toggle + size/lines/margin-right). Image inserts inside PortableText render via custom `components.type.image` → [PortableTextImage.astro](../src/components/PortableTextImage.astro) which builds the URL from `node.asset.storageKey` / `node.storageKey` / `node.url`. Renderer pulled from `emdash/ui` lazily; falls back to plain text when unavailable.
- **`getCustomCss(config, blockId)`** in `styleUtils.ts` substitutes the `selector` keyword (`/\bselector\b/g`) with `[data-epx-block="<id>"]`. If user CSS contains `{` it's emitted as-is (full rules with selectors); else it's wrapped as bare declarations under the block's selector. Powers the Custom CSS editor + the same on canvas (Canvas.tsx walks tree and injects via `<style id="epx-canvas-custom-css">`).
- **Text shadow** on canvas + frontend now defaults missing `textShadowColor` to `#000000` (was inheriting `currentColor` → white-on-dark).
- **Image.astro** defensive guard — `value = rawValue ?? {}` so undefined props (e.g. PortableText image slot) don't throw at frontmatter destructure.

## v0.6 styleUtils additions

- `STYLE_PROPS` and `BP_VISUAL_PROPS` extended with `aspectRatio` and `filter` so the existing CSS pipeline emits them per-breakpoint and at desktop.
- `TextEditor.astro` injects scoped one-off rules for column-count/gap, paragraph spacing (`p + p { margin-top }`), drop cap (`> *:first-child::first-letter { ... }`), and link color (`a { color: var(...); opacity: ... }`).
- `DividerSpacer.astro` renders SVG mask data URIs for `wavy` and `zigzag` divider styles, `linear-gradient` for `gradient` style, and a regular CSS border for the rest.
- `Video.astro` sets `aspect-ratio` directly on the wrapper (resolved from preset or `aspectRatioCustomW/H`) and lazy-loads the embed by withholding `src` until the overlay is clicked (tiny inline script promotes `data-epx-src` → `src`).
- `Button.astro` sets `display:inline-flex` + `flex-direction` from `iconPosition`.
- `Icon.astro` for SVG sources renders an inner span with `mask: url(...)` so `iconColor` recolors the silhouette; for PNG it renders `<img>` (admin shows a "color ignored" note).

## peerDependencies (v0.6)

- `@emdash-cms/admin` is declared as **optional** peerDep so the plugin works without it; if installed, `RichTextField` lazy-imports `PortableTextEditor` for the `text-editor` block, and `TextEditor.astro` lazy-imports `PortableText` from `emdash/ui` for SSR rendering.
- Both fall back to a plain JSON textarea (admin) and plain-text rendering (frontend) when unavailable.

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
- [x] Add Astro components: text-editor, video, button, icon, html, divider-spacer (v0.6)
