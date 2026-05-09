import Text from "./Text.astro";
import ImageBlock from "./Image.astro";
import TextEditor from "./TextEditor.astro";
import Video from "./Video.astro";
import Button from "./Button.astro";
import Icon from "./Icon.astro";
import Html from "./Html.astro";
import DividerSpacer from "./DividerSpacer.astro";
import FieldBinding from "./FieldBinding.astro";
import LayoutRenderer from "./LayoutRenderer.astro";

// Frontend reader for `(collection, entryId)` layouts. v0.9 (F3.4)
// signature: `getBuilderLayout(astro, collection, entryId, enabled?)` —
// async, takes Astro (or any context with `.locals.emdash`) as the
// first arg, returns `Promise<BuilderLayoutResult>`. Re-exported here
// (along with the result type and the cache-tag helper) so consumers
// don't deep-import from `empixel-builder/components/db` (the F2.4
// debt called out in `.claude/coordination/interfaces.md`).
export { getBuilderLayout, builderLayoutCacheTag } from "./db.js";
export type { BuilderCacheHint, BuilderLayoutContext, BuilderLayoutResult } from "./db.js";
export { LayoutRenderer };
export { default as BuilderWrapper } from "./BuilderWrapper.astro";
// F2.2 — exposed so admin (Agent C) and any external consumer can resolve
// `storageKey` references through the host's storage adapter without
// importing the legacy local-runtime URL.
export { resolveMediaUrl } from "./media.js";
export type { MediaUrlResolver, ResolveMediaUrlOptions } from "./media.js";
// F4.10 — responsive image pipeline. `Image.astro` uses these to emit
// `<picture>` markup with AVIF + WebP `<source>` elements + an
// `<img srcset>` fallback when the host's storage adapter supports
// format conversion. Re-exported so admin previews and tests can also
// build the same markup.
export {
  buildResponsiveSrcSet,
  resolveResponsiveSrcSet,
  RESPONSIVE_DEFAULT_WIDTHS,
  RESPONSIVE_DEFAULT_SIZES,
} from "./media.js";
export type {
  ResponsiveImageFormat,
  ResponsiveSrcSet,
  ResolveResponsiveSrcSetOptions,
} from "./media.js";

export const blockComponents: Record<string, unknown> = {
  text: Text,
  image: ImageBlock,
  "text-editor": TextEditor,
  video: Video,
  button: Button,
  icon: Icon,
  html: Html,
  "divider-spacer": DividerSpacer,
  // F4.4 — `field-binding` reads `entry.data[config.field]` instead
  // of carrying its own content. The matching `BlockRenderer.astro`
  // dispatch passes the host's resolved `entry` through.
  "field-binding": FieldBinding,
};
