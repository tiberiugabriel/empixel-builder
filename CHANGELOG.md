# Changelog

All notable changes to `empixel-builder`. Format roughly Keep-a-Changelog,
SemVer.

## 1.0.5 — 2026-05-09

**Debt cleanup — `STYLE_PROPS` exported from `styleUtils.ts`.** F3.6.1
landed the full default `style` shape via `EMPTY_STYLE_DEFAULTS` in
`src/admin/blockDefinitions.ts`, mirroring the canonical key list from
`src/components/styleUtils.ts`'s non-exported `STYLE_PROPS` literal.
The mirror was a sync-debt — every future style-key addition needed
matching edits in three places (`STYLE_PROPS`, `EMPTY_STYLE_DEFAULTS`,
plus the `STYLE_PROPS_SNAPSHOT` arrays in `tests/blockDefinitions.test.ts`'s
two describes). Now `STYLE_PROPS` is `export`-ed from `styleUtils.ts`
(re-exported from `src/components/index.ts` for the public surface)
and the admin schema derives `EMPTY_STYLE_DEFAULTS` via
`Object.fromEntries(STYLE_PROPS.map((k) => [k, ""]))`. The test imports
`STYLE_PROPS` directly and drops both snapshot mirrors. Single source
of truth — future style-key additions only need to land in
`styleUtils.ts`.

- `src/components/styleUtils.ts`: `const STYLE_PROPS` → `export const STYLE_PROPS`. Doc-comment added explaining the contract.
- `src/components/index.ts`: re-exports `STYLE_PROPS`.
- `src/admin/blockDefinitions.ts`: imports `STYLE_PROPS` from `../components/styleUtils.js`. `EMPTY_STYLE_DEFAULTS` body collapses from a 22-line literal to one `Object.fromEntries(...)` derivation.
- `tests/blockDefinitions.test.ts`: drops two `STYLE_PROPS_SNAPSHOT` literals (one per describe block); imports `STYLE_PROPS` once at the top and references it directly. Test count unchanged (414/414).

No runtime behaviour change. No public API break vs. 1.0.4 (the
addition is purely additive — a new named export). PRDs updated.

## 1.0.4 — 2026-05-09

**Cleanup — drop legacy `empixel_builder_layouts` provisioning from
`src/add.js` install script.** Plugin storage has lived in EmDash's
`_plugin_storage` table since 0.9.0 (F3.1+); the legacy
`empixel_builder_layouts` table was used as a read fallback through
F3.5peer (1.0.0) but is now fully unreachable from plugin code. The
CLI installer (`npx empixel-builder add`) was still creating the
legacy table on install — removed. New installs only need EmDash's
`ctx.storage` declaration. Patched `[slug].astro` snippet uses the
2-arg legacy `getBuilderLayout(collection, id)` call (polymorphic
shim from 1.0.1 still routes it correctly); the deprecated
`empixel_builder` boolean column reference is gone from the
generated code. `_require(`better-sqlite3`)` import dropped from
`add.js` since `createTable` was the only consumer.

Hosts that already ran 0.9.x → 1.0.x can safely
`DROP TABLE empixel_builder_layouts; DROP TABLE empixel_builder_meta;`
(the data is in `_plugin_storage` after the F3.3 lazy gate runs;
the legacy `empixel_builder` boolean column on `ec_<collection>`
tables is also dead — drop is optional).

## 1.0.3 — 2026-05-09

**P0 fix — restore double-envelope `{ data: payload }` on GET /layout return.**
1.0.2 fixed the EmDash route-wrap mismatch but went one step too far: the
plugin's client convention is **double-envelope** — handler returns
`{ data: payload }`, EmDash wraps once more so the HTTP body becomes
`{"data":{"data":payload}}`, `parseApiResponse` strips one envelope, the
client destructures `{ data }` to reach `payload`. Other routes
(`/collections`, `/entries`, `/breakpoints`) follow this convention; only
`/layout` GET regressed. After 1.0.2 the builder canvas loaded empty
because `parseApiResponse` returned `{sections:[...]}`, then
`({ data })` destructure gave `undefined`, then `data?.sections ?? []`
gave `[]`. 1.0.3 wraps both `/layout` GET return paths (cache hit + cache
miss) in `{ data: payload }` to match. Tests in `cacheETag.test.ts`
adapted (assertions wrap in `{ data: ... }`).

## 1.0.2 — 2026-05-09

**P0 fix — F4.2 ETag/304 dropped; GET handler now returns plain object.**
F4.2's `Response` returns from the `/layout` GET handler broke under
EmDash's plugin route framework (`route.handler` return value is wrapped
as `{ data: <return-value> }` — `Response` objects serialize to `{}`,
so the client saw `{"data":{}}` and the builder loaded with empty
sections; verified at
`node_modules/emdash/dist/search-DkN-BqsS.mjs:7332-7336`). The handler
now returns the payload directly (`{ sections: SectionBlock[] }` or
`null`); EmDash wraps it.

- ETag computation, `If-None-Match` 304 short-circuit, and
  `Last-Modified` header all removed from the GET handler. They were
  incompatible with the framework wrap. CDN / reverse-proxy HTTP-level
  caching is the host's call.
- In-memory LRU cache stays — still skips the storage round-trip on a
  warm hit. `LayoutCacheEntry` shape changed from
  `{ body: string; etag: string; lastModified: Date }` to
  `{ payload: { sections: SectionBlock[] } | null; lastModified: Date }`.
  Capacity 200, LRU eviction, recency promotion on hit.
- `badRequest` helper switched from returning `Response` (same wrap
  problem) to throwing `PluginRouteError("BAD_REQUEST", ..., 400)` so
  EmDash returns a proper 400 status with structured error payload.
  New `methodNotAllowed()` helper does the same for 405. All
  `new Response(...)` returns scattered across the route handlers
  (settings, toggle, breakpoints, layout method-not-allowed) replaced
  with the same throw pattern; the bare-object `{ error: "..." }`
  returns in `entries` / `toggle` likewise replaced with throws.
- `buildBlockChromeCss` memoize in `styleUtils.ts` (orthogonal F4.2
  perf win) is untouched.

Test suite adapted: dropped the ETag round-trip / mismatch / 304 tests
(no longer applicable); kept the cache hit / eviction / recency /
invalidation / cross-collection-isolation tests with the new
parsed-payload assertions. 413 → 414 tests (added a deep-equality
case on the cached payload).

Files: `src/plugin.ts`, `tests/cacheETag.test.ts`, `package.json`,
`src/index.ts`, `CHANGELOG.md`, `.claude/prd-backend.md`,
`.claude/coordination/status/agent-a.md`. Pipeline: lint + typecheck +
414 tests + build all green.

## 1.0.1 — 2026-05-09

**P0 hotfix on top of 1.0.0** — F4.1 (CSS coalescing) reverted because the
`Astro.locals` collect-then-IIFE-drain pattern in `LayoutRenderer.astro`
didn't reliably see child-side pushes (parent JSX expression evaluation
order vs. child component frontmatter execution). Frontend pages rendered
builder blocks with zero styling. Each block component now emits its own
inline `<style is:global>` again (pre-F4.1 behavior). `coalesceLayoutCss`
helper stays exported in `styleUtils.ts` for a future redo with a reliable
mechanism. 1.0.0 was never published — supersede it with 1.0.1.

## 1.0.0 — 2026-05-09

**Phase F4 (Performance & Polish) shipped.** F4.9 (E2E Playwright) deferred to 1.0.x — needs host fixture infra design.


- **P0 fix — F4.1 reverted to per-block `<style is:global>` emit.**
  F4.1's `Astro.locals.empixelLayoutCss` collect-then-IIFE-drain pattern
  in `LayoutRenderer.astro` didn't reliably see child-side pushes —
  Astro's JSX evaluation order evaluates the parent's IIFE before child
  component frontmatters push their CSS, so the bundled `<style>` came
  out empty and frontend pages rendered builder blocks with zero
  styling (Novapera retest confirmed). Reverted to the pre-F4.1
  pattern: each block component (`Text` / `Image` / `Button` / `Icon`
  / `Video` / `Html` / `DividerSpacer` / `TextEditor` /
  `SectionContainer` / `FieldBinding`) emits its own inline
  `<style is:global>` after its JSX root, and `LayoutRenderer.astro`
  emits the F1.3 reset CSS as its own inline `<style is:global>` (its
  pre-F4.1 location). `coalesceLayoutCss` helper stays exported in
  `styleUtils.ts` for future use; F4.1's perf win (1 style tag per
  page instead of N) is deferred to a redo with a reliable mechanism
  — likely a server-pre-pass walk in `LayoutRenderer.astro`'s own
  frontmatter that builds CSS for every block before any child renders,
  OR an upgrade once Astro's component-tree-render order is documented.
  Files: `src/components/LayoutRenderer.astro`, `src/components/Text.astro`,
  `src/components/Image.astro`, `src/components/Button.astro`,
  `src/components/Icon.astro`, `src/components/Video.astro`,
  `src/components/Html.astro`, `src/components/DividerSpacer.astro`,
  `src/components/TextEditor.astro`,
  `src/components/SectionContainer.astro`,
  `src/components/FieldBinding.astro`, `tests/fieldBinding.test.ts`
  (one assertion flipped from `empixelLayoutCss` push to inline
  `<style set:html={allCss} is:global />` + a negative-guard against
  re-introducing the buggy pattern), `tests/styleUtils.test.ts`
  (describe-block comment reframed — the helper stays unit-tested; the
  `end-to-end` case documents the future shape, not current LayoutRenderer
  behavior), `CHANGELOG.md`, `.claude/prd-frontend.md`,
  `.claude/prd-breakpoints.md`,
  `.claude/coordination/status/agent-b.md`. Tests: 413 → 413
  (count unchanged; 1 assertion adapted in `fieldBinding.test.ts`).
  Pipeline: lint + typecheck + 413/413 + build all green.

- **F4.8 — HTML block iframe auto-resize via `postMessage` protocol.**
  Replaces the v0.6 DOM-polling watcher. The iframe runs a tiny inline
  measure script that posts `document.documentElement.scrollHeight` to
  the parent on `load`, `resize`, and `MutationObserver` content
  changes (`subtree` + `childList` + `characterData`). Parent listens
  on a single `window.message` event handler, validates the envelope
  (`{ type: "epx:html:resize", height, id }`), matches the iframe by
  `e.source === iframe.contentWindow` (canonical — under tightened
  sandbox the iframe's origin is `"null"` so origin checks can't
  disambiguate), and updates the iframe's height inline. Sandbox
  attribute tightens from `allow-scripts allow-same-origin` to
  **`allow-scripts` only** — untrusted HTML can no longer reach
  `parent.document` / `parent.location` / etc., even if it tries. The
  protocol works cross-origin because `parent.postMessage` is one of
  the few APIs available under no-`allow-same-origin`. Drops the
  `setInterval` polling, the parent-side `ResizeObserver` /
  `MutationObserver` setup on `iframe.contentDocument` (no longer
  reachable under tightened sandbox — but the in-iframe MutationObserver
  picks up the slack), and the per-image `load` listener attachment.
  Mirror behavior in `HtmlPreview.tsx` so the canvas iframe matches
  the frontend (documented F4.8 cross-domain edit). Files:
  `src/components/Html.astro`, `src/admin/previews/HtmlPreview.tsx`,
  `tests/previewParity.test.ts` (added `F4.8 — HtmlPreview postMessage
  auto-resize` describe with 5 cases: sandbox attr, srcDoc measure
  script presence, `data-epx-html-frame` correlation, no-polling
  guard, no-iframe smoke test), `CHANGELOG.md`, `.claude/prd-frontend.md`,
  `.claude/prd-blocks.md`, `.claude/coordination/status/agent-b.md`.
  Tests: 408 → 413 (+5). **Role-based sanitization** (no-scripts mode
  for non-admin authors — drop `allow-scripts` and run the user's
  HTML through a sanitizer like DOMPurify when the saver isn't an
  admin) is **deferred** to a 1.0.x follow-up. Needs author-role
  tracking on layout rows + a sanitization library, which is a
  substantial design surface that doesn't fit the F4 scope. The
  current security stance: HTML blocks are admin-only by virtue of
  the admin route's auth, and the tightened sandbox keeps untrusted
  code from reaching parent state even if a non-admin somehow gets
  write access.

- **F4.4 follow-up — entry plumb-through to `FieldBinding`.**
  `BuilderWrapper.astro`, `LayoutRenderer.astro`, and
  `BlockRenderer.astro` now accept an optional `entry` prop and thread
  it down so the new `field-binding` block can read
  `entry.data[config.field]` and spread `entry.edit?.[config.field]`
  onto its rendered tag (live-edit reattach). The original F4.4 PR
  documented this plumb-through as out-of-scope (those parent files
  weren't in the cross-domain exception list); this PR closes the gap.
  Backwards compatible — existing host pages that don't pass `entry`
  still render identically; `field-binding` blocks just resolve to
  empty strings (the leaf-level fallback was already in place from the
  F4.4-impl commit). Hosts that want to use `field-binding` now write
  `<BuilderWrapper sections={getBuilderLayout(...)} entry={post}>` —
  the polymorphic `getBuilderLayout` doesn't know about the entry
  itself, so passing it through the wrapper is the host's
  responsibility. The shared `BuilderEntryRef` shape (`{ data?:
  Record<string, unknown>; edit?: Record<string, unknown> }`) is
  declared inline in each of the four `.astro` files (KISS — no shared
  module while only four files reference it). New tests in
  `tests/fieldBinding.test.ts` (file-content probes — Astro components
  don't run under vitest natively, same approach as the existing
  F4.4-impl dispatch probes): `BuilderWrapper.astro` accepts +
  forwards entry, `LayoutRenderer.astro` accepts + forwards entry,
  `BlockRenderer.astro` types entry via `BuilderEntryRef`, plus a
  cross-file consistency probe asserting the shape stays uniform
  across all four sites. Tests: 404 → 408 (+4). Files:
  `src/components/BuilderWrapper.astro`,
  `src/components/LayoutRenderer.astro`,
  `src/components/BlockRenderer.astro`,
  `src/components/FieldBinding.astro` (prop type tightened to use the
  same `BuilderEntryRef` interface), `tests/fieldBinding.test.ts`,
  `CHANGELOG.md`, `.claude/prd-frontend.md`,
  `.claude/coordination/status/agent-b.md`.

- **F4.4 — new `field-binding` block type.** Reads
  `entry.data[config.field]` instead of carrying its own content; on
  the frontend, spreads `entry.edit?.[config.field]` so the EmDash
  live-edit overlay reattaches on builder pages (parity with
  hand-rolled host templates like `<h1 {...post.edit.title}>`). The
  `BlockType` union + `BLOCK_TYPES` set were extended in the prereq
  commit `07126c7` per the F4.4 types proposal — the block follows
  the canonical `defaultConfig` shape (theme + style stack +
  styleHover/Dark/HoverDark/Breakpoints + advanced) so reducer fill
  helpers, RightPanel declarative pipeline, AdvancedTab universal
  controls, F4.5 theme × state × breakpoint cascade, and F4.1 CSS
  coalescing all keep working with no per-type branches. Fields tab
  exposes a free-text `field` input + an `as` (HTML tag) select
  whitelisted to `p / h1–h6 / span / div`. Style tab mirrors the
  `text` block: alignment + typography + textStroke + textShadow +
  blendMode (no background/border/shadow — bound element is plain
  inline-or-paragraph). LeftPanel grows a "Bound to this entry"
  palette section that lists each entry-level field as a
  draggable card; drop pre-fills `config.field` and picks a sensible
  default `as` (title→h1, excerpt→p, default→p) via
  `defaultAsForField` (exported from `LeftPanel.tsx` so
  `Builder.tsx` reuses the same mapping for the click path). Entry
  field source: today the `/entries` route only exposes
  `id, slug, title, builder_enabled, created_at, updated_at` per
  row (no `entry.data` keys), so `BuilderPage.tsx` seeds the palette
  with `["title", "slug", "id"]` — authors can always rebind via
  the Fields tab to ANY entry key. Expanding the palette to include
  `entry.data` keys (excerpt, image, body, etc.) is a future PR
  that needs an `/entries/:id` API on Agent A's side. New
  `FieldBinding.astro` (Agent B's column — documented F4.4
  cross-domain exception per the report's task allocation table)
  reads the bound value via `entry?.data?.[config.field]`, clamps
  `config.as` against the same tag whitelist as the BlockDef so a
  corrupted/legacy config can't render `<script>`, falls through
  to `<p>` for object-shaped values (e.g. images — F4.4 follow-up
  adds image-binding via `<Image image={...} />` from `emdash/ui`),
  and pushes per-block CSS into `Astro.locals.empixelLayoutCss`
  (the F4.1 coalescing buffer) instead of emitting an inline
  `<style>` tag. Cross-domain dispatch in `BlockRenderer.astro` +
  `components/index.ts` (the other two F4.4 exceptions) accepts an
  optional `entry` prop and forwards it ONLY to the `field-binding`
  branch — every other block ignores it. The `entry` plumb-through
  from `BuilderWrapper.astro` → `LayoutRenderer.astro` →
  `BlockRenderer.astro` is intentionally OUT of scope for this PR
  (those files are Agent B's column and not in the documented
  cross-domain exception list); a future Agent B PR threads the
  prop through. Until that lands, hosts can still use the block —
  it just renders an empty element (the `entry` arg defaults to
  `null` at the leaf). New `FieldBindingPreview` (canvas badge:
  `<bound: ${field}>` when set, `<unbound>` italic gray
  otherwise — the canvas can't resolve the actual entry value at
  preview time so the badge names the binding instead). Replaces
  the temporary `() => null` stub in `src/admin/previews/index.ts`
  introduced by the prereq types commit. Drag-handler in
  `useDragHandlers.ts` extended to read an optional `field` slot
  off the new-block drag-data — when present, pre-fills
  `config.field` + `config.as` on the freshly-created block via
  the same title→h1/excerpt→p/default→p mapping. `addBlock` in
  `Builder.tsx` now accepts an optional `overrides`
  `Record<string, unknown>` argument so `addFieldBindingBlock`
  routes through the existing container-context resolution
  (selected container → drop inside; selected leaf → drop in same
  parent). Tests: 363 → 404 (+41 — `tests/fieldBinding.test.ts`
  covers BlockDef shape, fields/style tab declarations, preview
  bound/unbound badges, defaultAsForField mapping, LeftPanel
  palette section visibility under various prop combinations,
  generic field-binding card filtered out of Core, and file-content
  parity probes for `BlockRenderer.astro` dispatch +
  `components/index.ts` registration + `FieldBinding.astro`
  contract). Existing 9-block sweeps (`tabRenderer.test.ts`,
  `rightPanel.test.ts`, `builderReducer.test.ts`,
  `advancedTab.test.ts`, `blockDefinitions.test.ts`) extended to
  cover the 10th type. PRDs: `prd-blocks.md` (new block in the
  inventory + spec), `prd-builder-ui.md` (LeftPanel palette
  section + addFieldBindingBlock callback + drag-data field
  slot), `prd-frontend.md` (FieldBinding.astro + entry plumb
  through + tag whitelist + F4.1 push pattern).

- **F4.5 — theme × state × breakpoint matrix complete.** New
  `styleHoverDark` (CSSProps) + `styleBreakpointsHoverDark`
  (`{ [bpId]: { _px, ...CSSProps } }`) keys on every `BlockDef`
  `defaultConfig`. `buildBlockChromeCss` now emits the full 4-variant
  base (light/normal → dark/normal → light/hover → dark/hover) ×
  4-variant-per-bp matrix in correct selector-specificity order. New
  helpers `buildHoverDarkCss(config, blockId, opts?)` +
  `buildBreakpointHoverDarkCss(config, blockId)` in
  `src/components/styleUtils.ts` plus `darkBlockHoverSelector(blockId)`
  internal selector builder. The dark-hover selector
  (`darkBlockSelector + :hover`) strictly outranks dark-normal AND
  light-hover by specificity, so `!important` is no longer needed —
  dropped from `buildHoverCss`, `buildBreakpointHoverCss`, and
  `buildImgVisualHoverCss`. Existing layouts unchanged in render: no
  `styleHoverDark` set falls through to `styleHover` on dark via the
  cascade, byte-identical to pre-F4.5 modulo the `!important` drop
  (which only mattered for ties the new dark-hover slot now resolves
  explicitly). New `.claude/prd-theme.md` documents the model: 4 base
  + 4 per-bp variants, cascade-order table, selector-specificity
  rationale, customCss interaction, migration semantics, editor
  surface routing, and authoring workflows. F3.6.7 parity snapshots
  regenerated cleanly (5 inline snapshots updated — pure
  `!important` drop on hover declarations); new fixture (`M1`) locks
  the full 4-base + 4-per-bp matrix output, fallback fixture (`M2`)
  asserts byte-identical-modulo-!important rendering of layouts
  without `styleHoverDark`. customCss has no per-theme slot — authors
  who want dark-specific hover via customCss hand-write the
  `[data-theme="dark"] selector:hover` clause; documented in
  `prd-theme.md`. Cross-domain edit to `src/components/styleUtils.ts`
  is the documented F4.5 exception per task allocation. Tests:
  363 → 380 (+17: 14 new in `tests/parity/all.test.ts` for the 4×4
  matrix + fallback case; 3 in `tests/blockDefinitions.test.ts` for
  the new BASE_DEFAULTS keys + per-block presence). Files:
  `src/admin/blockDefinitions.ts`, `src/components/styleUtils.ts`,
  `tests/parity/all.test.ts`, `tests/styleUtils.test.ts`,
  `tests/canvasCss.test.ts`, `tests/blockDefinitions.test.ts`,
  `CHANGELOG.md`, `.claude/prd-theme.md` (new), `.claude/prd-blocks.md`,
  `.claude/prd-frontend.md`, `.claude/prd-rightpanel.md`,
  `.claude/prd-breakpoints.md`,
  `.claude/coordination/status/agent-c.md`.

- **F4.10 — image pipeline polish (`srcset` + WebP/AVIF).**
  `Image.astro` now emits responsive `<picture>` markup with
  `<source type="image/avif">` + `<source type="image/webp">` elements
  and an `<img srcset="...">` fallback. Default widths
  `[480, 800, 1200, 1920]`; default `sizes` is
  `"(max-width: 768px) 100vw, 50vw"` (overridable via the
  `resolveResponsiveSrcSet` opts bag — future blocks can pick their
  own size set). Falls back to the pre-F4.10 plain `<img>` when the
  host's storage adapter doesn't support format conversion (no
  `getPublicMediaUrl`, the resolved URL is the legacy
  `/_emdash/api/media/file/...` route, or the adapter returns
  undefined for the key) — so hosts on the local-runtime adapter
  see byte-identical markup to v0.9.6 and ship no broken
  `<source>` URLs. New helpers `resolveResponsiveSrcSet`,
  `buildResponsiveSrcSet`, `appendImageTransformParams`,
  `isLegacyLocalRuntimeUrl` + the constants
  `RESPONSIVE_DEFAULT_WIDTHS` / `RESPONSIVE_DEFAULT_SIZES` live in
  `src/components/media.ts`; all are re-exported from
  `empixel-builder/components` so admin previews and tests can
  build the same markup. The `<source>` URLs append
  `?format=avif&w=N` / `?format=webp&w=N` to the adapter-resolved
  URL — CDNs that intercept those query params (Cloudflare Image
  Resizing, Vercel/Netlify image optimization, custom S3-fronted-by-
  CF setups) do the actual transform; CDNs that don't honor the
  query string serve the original-format file, so the page still
  renders correctly. Path 1 (routing through `<Image>` from
  `emdash/ui`) was investigated and rejected: the EmDash component
  takes `MediaValue` (`{ id, src?, meta?, width?, height? }`) not
  the plugin's `ImageMediaRef` (`{ id, storageKey, alt?, filename? }`),
  AND only emits responsive `srcset` when the active media provider
  exposes `ImageEmbed.getSrc()` — the local + plain-S3 storage
  adapters don't, so routing through it would add normalization
  plumbing for zero responsive benefit on the majority of hosts.
  Lighthouse imagery score expected > 95 on tuned hosts. Tests:
  350 → 365 (+15: 3 for `appendImageTransformParams`, 3 for
  `buildResponsiveSrcSet`, 2 for `isLegacyLocalRuntimeUrl`, 7 for
  `resolveResponsiveSrcSet`). Files: `src/components/media.ts`,
  `src/components/Image.astro`, `src/components/index.ts`,
  `tests/media.test.ts`, `CHANGELOG.md`, `.claude/prd-frontend.md`,
  `.claude/coordination/status/agent-b.md`.
- **F4.7 — split `BackgroundControl.tsx` (~939 LOC) into 5 per-mode
  sub-files under `src/admin/controls/background/`** (`ColorSub`,
  `GradientSub`, `ImageSub`, `SlideshowSub`, `VideoSub`). The main
  control becomes a thin mode-switcher + dispatcher under 200 LOC
  (939 → 182). Behavior identical; refactor only. Also extracted:
  `serialize.ts` (the `BackgroundConfig` type plus `parseBackground`
  / `serializeBackground` / `buildBackgroundCss` helpers, kept
  re-exported from `BackgroundControl.tsx` so existing import sites
  continue working), `common.tsx` (shared `BgNumRow` / `BgToggleRow`
  / `BgOptionRow` row components, the option-set arrays, and the
  small icons used by image / video / slideshow modes), and
  `TypeTabs.tsx` (the 5-tab strip). The color-picker popup (used by
  Color + Gradient subs) and the media-picker modal (Image / Video /
  Slideshow / video-fallback) remain in `BackgroundControl.tsx` so
  they can be dispatched against any mode without round-tripping
  through the sub-files. F4.3's lazy boundary at
  `SectionRenderer.tsx`'s `case "background"` still wraps the
  entire control via `BackgroundSection`; the new sub-files load as
  part of the same deferred chunk. New smoke test:
  `tests/backgroundSubs.test.ts` (13 cases — one render-shape check
  per `<Mode>Sub`, a TypeTabs filter test, and a 5-case
  serialize/parse round-trip suite). Tests: 350 → 363 (+13).

- **F4.2 — In-memory LRU cache on `/layout` GET (200 entries,
  invalidates on POST/toggle/afterDelete). ETag on GET responses;
  conditional GET returns 304 when `If-None-Match` matches.
  `buildBlockChromeCss` memoized per config-hash (~500 LRU);
  skipped when `opts.resolveMediaUrl` is set.** Cache key is
  `${collection}::${entryId}` over the resolved (post-slug-→-ULID)
  identity so admin and host hit the same row. ETag is `"<sha1>"` of the
  serialized response body, computed once on cold path and cached
  alongside `body` + `lastModified` (derived from the row's
  `updatedAt`) so warm hits don't re-hash. The memo wrap around
  `buildBlockChromeCss` lives in `src/components/styleUtils.ts` (the
  documented F4.2 cross-domain exception per the report's task
  allocation table) — fingerprint is
  `JSON.stringify(config) + "|" + blockId + "|" + (opts.imgScoped ? "1" : "0")`.
  When `opts.resolveMediaUrl` is provided the wrap falls through to
  the direct call because the resolver is a closure built per-request
  from `Astro.locals` and structurally-identical configs would still
  need different resolved URLs. Files touched:
  `src/plugin.ts` (LRU + ETag + invalidation; `_resetLayoutCache` /
  `_layoutCacheSize` test exports), `src/components/styleUtils.ts`
  (memo wrap + `_resetBuildBlockChromeCssCache` /
  `_buildBlockChromeCssCacheSize` test exports),
  `tests/cacheETag.test.ts` (new — 9 cases: cache hit < 5ms, ETag
  round trip, ETag mismatch, LRU eviction at 201, recency promotion,
  POST/toggle/afterDelete invalidation, cross-collection
  non-collision, missing-row caching), `tests/styleUtils.test.ts`
  (+9 cases — hit short-circuits, hit-bench < 50ms for 100 iters,
  blockId / config / imgScoped key separation, resolveMediaUrl
  skip path, LRU eviction at 501, recency promotion,
  output-equivalence sanity), `CHANGELOG.md`, `.claude/prd-backend.md`,
  `.claude/prd-frontend.md`, `.claude/coordination/status/agent-a.md`.
  Tests: 331 → 350 (+19).

- **F4.1 — single `<style>` per page with grouped `@media` queries.**
  Pre-F4.1 every leaf block component emitted its own
  `<style is:global>` at template position; a 30-block page shipped
  30+ inline `<style>` tags, each repeating its own
  `@media (max-width: ...)` block. F4.1 collects every block's CSS
  string in `LayoutRenderer.astro` (via a shared
  `Astro.locals.empixelLayoutCss` string-array — initialized in the
  layout root, pushed-to in each block's frontmatter) and emits
  exactly **one** coalesced `<style>` per page. New helper
  `coalesceLayoutCss(strings)` in `styleUtils.ts` parses the
  collected CSS for `@media` blocks, groups rule bodies by query
  string (whitespace-tolerant — `@media(max-width:992px)` and
  `@media (max-width: 992px)` merge into the same wrapper), and
  emits base rules first, then one `@media (...) { merged-body }`
  per unique query in first-seen order. The F1.3 plugin-scoped
  reset is folded into the same coalesced bundle so the page emits
  one `<style>` rather than reset + bundle. Hover, dark
  (`:is(html.dark, …)`), per-bp, and customCss rules all flow
  through unchanged. **Performance benchmark:** 5-block page goes
  from 5+ `<style>` tags to 1; 30-block page goes from 30+ to 1.
  Each unique breakpoint opens exactly one `@media` block instead
  of one per block × per bp. Files touched:
  `src/components/styleUtils.ts` (new `coalesceLayoutCss`),
  `src/components/LayoutRenderer.astro` (collects + emits one
  `<style>`), `src/components/{Text,Image,Button,Icon,Video,Html,
  DividerSpacer,TextEditor,SectionContainer}.astro` (pushes per-block
  CSS into the shared buffer instead of emitting inline `<style>`),
  `tests/styleUtils.test.ts` (+10 cases — empty input, fast path,
  same-query merge, different-query separation, base-before-media
  ordering, three-block × two-query merge, nested-brace tolerance
  for `:hover` rules inside `@media`, whitespace-tolerant query
  grouping, dark `:is(...)` selector preservation, end-to-end
  5-block page emits exactly 1 `<style>` tag), `CHANGELOG.md`,
  `.claude/prd-frontend.md`, `.claude/prd-breakpoints.md`,
  `.claude/coordination/status/agent-b.md`. Tests: 316 → 326 (+10).

- **F4.3 — code-split heavy admin components via `React.lazy` +
  `Suspense`.** Three admin chunks now defer until the user actually
  needs them, dropping the initial admin bundle measurably:

  | Component | Lazy boundary | Chunk size (post-F4.3) |
  |-----------|---------------|------------------------|
  | `RightPanel` | `src/admin/builder/Builder.tsx` (Suspense at the panel slot, fallback is an `epx-right-panel--loading` empty placeholder matching the column width) | 98.92 KB / 16.07 KB gzipped |
  | `BackgroundSection` (which transitively pulls in `BackgroundControl` + `parseBackground` / `serializeBackground` + `ColorPicker` + `MediaPicker`) | `src/admin/right-panel/SectionRenderer.tsx` `case "background"` | 41.91 KB / 7.91 KB gzipped |
  | `CodeEditor` | Two sites: `src/admin/right-panel/AdvancedTab.tsx` (Custom CSS) and `src/admin/fields/FieldRenderer.tsx` (`code` field type — Custom HTML for the `html` block) | 11.35 KB / 3.39 KB gzipped (de-duplicated by the bundler — both Suspense boundaries hit the same chunk) |

  All three fallbacks are dimension-matched empty `<div>` /
  `<aside>` placeholders (`epx-right-panel--loading`,
  `epx-bg-ctrl--loading`, `epx-code-editor--loading`) with
  `aria-busy="true"`, so opening the panel doesn't cause layout
  shift while the chunk fetches.

- **F4.3 — `npm run analyze` script.** Added `vite-bundle-visualizer`
  + `vite` as devDependencies and a root-level `vite.analyze.config.ts`
  that builds `src/admin/index.tsx` as a Vite library, externalizing
  the peer deps the host already provides (React, ReactDOM,
  EmDash plugin-utils, dnd-kit). Run via `npm run analyze` — emits
  a treemap to `dist-analyze/stats.html`. The output directory is
  excluded from commits via the agent's explicit-paths staging
  convention (orchestrator can add `dist-analyze/` to `.gitignore`
  in a follow-up if desired).

- **F4.3 — measured initial-bundle reduction.** Same Vite config,
  same entry, before vs. after the lazy boundaries:

  ```
  Baseline (commit 0d767dd, pre-F4.3):
    admin.js                   472.62 kB │ gzip:  87.93 kB   (single entry chunk)
    index-BRa1p64P.js            6.36 kB │ gzip:   2.21 kB   (shared chunk)
    index-DidfX0SO.js           52.07 kB │ gzip:  12.69 kB   (shared chunk)
    ───────────────────────────────────────────────────────
    Initial-graph total:       531.05 kB │ gzip: 102.83 kB

  Post-F4.3 (this commit):
    admin.js                     0.10 kB │ gzip:   0.11 kB   (entry shim)
    index-CTKVloHO.js          324.89 kB │ gzip:  63.15 kB   (initial chunk)
    index-BRa1p64P.js            6.36 kB │ gzip:   2.21 kB   (shared chunk)
    index-DidfX0SO.js           52.07 kB │ gzip:  12.69 kB   (shared chunk)
    ───────────────────────────────────────────────────────
    Initial-graph total:       383.42 kB │ gzip:  78.16 kB   (-148 kB / -25 kB gzipped)

    + Deferred chunks (loaded on demand):
      RightPanel-CGTdluba.js    98.92 kB │ gzip:  16.07 kB
      BackgroundSection-…js     41.91 kB │ gzip:   7.91 kB
      CodeEditor-DbAx4vVW.js    11.35 kB │ gzip:   3.39 kB
  ```

  The audit's "1.5 MB initial admin bundle" figure was on the
  consumer side (host bundler, with React + dnd-kit + EmDash inlined).
  This local report externalizes those (the host already provides
  them), so the absolute numbers are smaller — but the **percentage
  improvement is the same shape**: ~28% smaller initial graph, ~24%
  smaller gzipped. Once the host bundle is rebuilt, RightPanel /
  BackgroundSection / CodeEditor download as separate chunks the
  first time their UI surface mounts.

- **F4.3 — test coverage.** New `tests/codeSplit.test.ts` (5 tests)
  pins three contracts: (a) the lazy boundaries don't crash under
  SSR (`renderToStaticMarkup` resolves the Suspense fallback
  cleanly); (b) the documented `epx-*--loading` placeholder
  classes + `aria-busy="true"` make it into the initial markup;
  (c) the deferred prop graph is reachable via React's element
  tree (lazy elements are `isValidElement`-true and carry their
  props). Existing `tests/advancedTab.test.ts` updated to reflect
  the lazy `CodeEditor` (it now matches by prop signature instead
  of function name, since `React.lazy` wraps the type symbol).
  Total tests: 316 → 321 (+5).

## 0.9.6 — 2026-05-09

- **F3.6.7 — parity snapshot suite for the 9 block types.** New
  `tests/parity/all.test.ts` holds 9 fixtures (one per block type) +
  inline `toMatchInlineSnapshot()` assertions on
  `buildBlockChromeCss(config, blockId, opts)`. Each fixture starts
  from `getDefaultBlockConfig(<type>)` so every structural key
  (style / styleHover / styleDark / styleBreakpoints /
  styleHoverBreakpoints / advanced + the F3.6.1 `STYLE_PROPS`
  placeholders) is present, then layers aesthetic values on top to
  exercise the relevant CSS code paths. The `container` fixture
  carries the EXHAUSTIVE "every key non-empty" config — every
  `STYLE_PROPS` entry has a real value; hover, dark, breakpoint
  (tablet + mobile), breakpoint-hover, and advanced (cssId /
  cssClasses / customCss / position + offsets / zIndex) all carry
  meaningful overrides. The other 8 fixtures cover representative
  per-block subsets. **One canvas-vs-frontend equality test** (text
  block, desktop) locks `buildCanvasBlockCss(block, "desktop")`
  against `buildBlockChromeCss(block.config, block.id)` at the
  chrome-CSS level — extends the F3.6.3 unification beyond
  "contains substring" to full-string equality. Future
  `styleUtils.ts` edits that drift Canvas / frontend rendering
  surface as snapshot diffs; reviewing each diff IS the
  verification that the change was intentional and the canvas /
  frontend stay in sync. Inline snapshots (not separate `.snap`
  files) keep assertion + expected output co-located for easier
  diff review. Tests: 306 → 316 (+10 — 9 per-block + 1
  canvas-vs-frontend equality). Files: `tests/parity/all.test.ts`
  (new, 517 LOC including the inline expected CSS strings),
  `.claude/prd-blocks.md` (parity-guard section documenting the
  snapshot regen / drift workflow), `CHANGELOG.md`,
  `.claude/coordination/status/agent-c.md` (start + done entries).
  **No production code touched** — tests + docs only.

- **F3.6.6 — audit + reconcile preview / Astro DOM.** 1:1 walked every
  pair `src/admin/previews/<Block>Preview.tsx` ↔ `src/components/<Block>.astro`
  for the 9 block types and pinned the audit table in
  `.claude/prd-previews.md`. **3 unintentional drift fixes applied**:
  (a) `TextPreview.tsx` was hardcoded `<span>`; now mirrors `Text.astro`'s
  `<Tag(htmlTag)>` with whitelist `[p, div, span, h1, h2, h3, h4, h5, h6]`
  (defaults to `<p>`) so headings look heading-sized on canvas.
  (b) `IconPreview.tsx` was raw `<img color=...>` (color is a no-op on
  `<img>`); now mirrors `Icon.astro`'s SVG-vs-PNG branch — `<span style="
  mask:url(...); background-color:hexA(iconColor, alpha)">` for SVG +
  iconColor set, plain `<img>` otherwise. SVG icons now actually recolor
  on canvas. (c) `HtmlPreview.tsx` iframe style now emits `display:block;
  box-sizing:border-box` to match `Html.astro`'s `iframeOverrideCss`. **6
  intentional differences documented** with rationale: container preview
  is dead code (Canvas routes to `ContainerBlock`); image preview always
  uses `<figure>` outer wrapper (canvas already wraps in
  `<div data-epx-block>`); image preview hand-builds
  `/_emdash/api/media/file/<key>` URL (cross-cuts all 9 previews — tracked
  by orchestrator task #9 "admin resolveMediaUrl migration debt"); video
  preview uses `padding-top: <ratio>%` hack (Canvas chrome doesn't emit
  `aspect-ratio`); button preview hardcodes default visual chrome (so a
  fresh button looks button-shaped before configuration); html preview's
  `data-epx-block` lives one element above the iframe (Canvas wrapper
  pattern). Tests: new `tests/previewParity.test.ts` (+14 cases). 292 →
  306 tests pass. Files: `src/admin/previews/TextPreview.tsx`,
  `src/admin/previews/IconPreview.tsx`,
  `src/admin/previews/HtmlPreview.tsx` (drift fixes);
  `tests/previewParity.test.ts` (+14 cases);
  `.claude/prd-previews.md` (audit table + drift summary);
  `.claude/coordination/status/agent-c.md` (start + done entries).

- **F3.6.5 — Canvas wraps each root-level block in
  `.epx-canvas-block-host` (full-width).** Solves the "leaf block at canvas
  root collapses to content width" issue: `.epx-canvas__list` was
  `display: flex; flex-direction: column` and flex children fold to
  intrinsic width — so a button / icon / divider-spacer promoted to root
  via `isRootAllowedType` collapsed on the canvas while looking fine on
  the host site (the host page's container gives the block-root its own
  block-context). The fix has two parts in lockstep:
  - `.epx-canvas__list` switched to plain `display: block` (normal flow).
    Vertical stacking is what normal block flow gives us anyway. The
    `position: relative; transform: translateZ(0)` rule lower in
    `builder.css` (containing-block trick for fixed/absolute descendants)
    is preserved.
  - `Canvas.tsx`'s `frameContent` now wraps each `sections.map(...)`
    iteration in `<div class="epx-canvas-block-host" data-epx-block-host="<id>">…</div>`.
    The wrapper is `display: block; width: 100%`. The inner block keeps
    its own `style.display` intent: `inline-flex` / `inline-block` /
    `inline-grid` / `inline` keep the inner element at intrinsic width
    inside the full-width host (host gets the `--inline-inner` modifier
    so `text-align: start` anchors the inline child at the left). All
    other display values render as block-level full-width.
  - **Children inside containers stay unwrapped.** A container's
    `epx-container-block__children` flex/grid IS the block-context for
    its children, exactly the same way `SectionContainer.astro`'s flex/grid
    is the block-context on the frontend (parity with
    `BlockRenderer.astro`'s leaf dispatch). Wrapping there would
    poison the container layout.
  - Inline-display detection: new `isInnerInlineDisplay(block,
    activeBreakpoint)` exported from `Canvas.tsx` reads
    `block.config.style.display`, with the active bp's
    `styleBreakpoints[bp].display` taking precedence on non-desktop bp.
    Mirrors how the frontend resolves bp-overrides — switching display
    per breakpoint flips `--inline-inner` automatically.
  - Doesn't break: drag-and-drop (BlockOverlay, drop targets), hover
    and selection borders (still rendered by `epx-block-preview` /
    `epx-container-block` on the inner element), breakpoint preview
    width simulation (the host wrapper sits inside the resizable
    `epx-canvas__preview-frame`).
  - Tests: `tests/canvasCss.test.ts` adds two describe blocks. (a)
    `isInnerInlineDisplay` — 4 cases covering unset / block-level /
    inline-* / bp-override. (b) `Canvas — root host wrapper (F3.6.5)`
    — 5 cases that render `<Canvas>` via `react-dom/server` and assert
    wrapper presence on root blocks (container + leaf), absence on
    container children, the `--inline-inner` modifier on inline-display
    roots, and that the empty-state placeholder still renders without a
    host wrapper. Total test count 283 → 292.
  - Files: `src/admin/Canvas.tsx` (frameContent wraps roots; new
    `isInnerInlineDisplay` export), `src/admin/builder/styles/builder.css`
    (`.epx-canvas__list` → block; new `.epx-canvas-block-host` rule +
    `--inline-inner` modifier), `tests/canvasCss.test.ts` (+9 cases),
    `.claude/prd-builder-ui.md` (Canvas section documents the wrapper),
    `.claude/coordination/status/agent-c.md` (start + done entries).
    `package.json` stays at `0.9.5` — F3.6 phase will bump to 0.9.6 at
    phase close.

- **F3.6.3 — Canvas now calls `buildBlockChromeCss` identically with the
  frontend `*.astro` components. Drift between admin preview and host
  render dies by construction.** Previously `Canvas.tsx`'s
  `buildEffectiveBlockCss` only called a subset (`buildBlockCss` +
  `buildHoverCss` + `getCustomCss` + `buildImgVisualCss/Hover` for image
  blocks) and pseudo-merged `styleBreakpoints[bp]` into `style` to fake
  the active breakpoint. That subset silently dropped `buildBreakpointCss`
  and `buildBreakpointHoverCss`, so a config with hover + breakpoint +
  dark variants rendered one way on Canvas, another on the host site
  (audit M2 / H1 follow-up). After F3.6.3, Canvas's per-block CSS path
  is one call to the same `buildBlockChromeCss` helper every leaf Astro
  block (`Text.astro`, `Image.astro`, `Button.astro`, `Icon.astro`,
  `TextEditor.astro`, `Video.astro`, `Html.astro`, `DividerSpacer.astro`)
  uses — so the FULL chain (block + hover + `@media` breakpoint + `@media`
  breakpoint-hover + custom + image-visual variants when `imgScoped`)
  emits identically in both worlds.
  - **Active-breakpoint preview mechanism** — Canvas viewport is the
    actual browser window, so `@media(max-width:Xpx)` queries from
    `buildBreakpointCss` don't fire when previewing a 575px mobile bp on
    a 1920px screen. Spec option (a) `@container` queries was rejected
    because rewriting `buildBreakpointCss` falls in Agent B's column;
    spec option (b) CSS variable + `:where(...)` was rejected because
    CSS variables can't gate `@media` evaluation (the browser checks
    actual viewport regardless of an author CSS var). KISS fallback per
    F3.6.3 spec: emit a **stacked preview overlay** — a non-`@media`
    duplicate of the active bp's declarations (scoped to
    `[data-epx-block="<id>"]` for visual, `[…]:hover` for hover,
    `[…] img` when `imgScoped`) layered AFTER the frontend bundle so it
    wins in cascade order. Frontend stays untouched. F4 can revisit if
    `@container` becomes viable across all block components.
  - New exported helper from `src/admin/Canvas.tsx`:
    `buildCanvasBlockCss(block, activeBreakpoint)` — full frontend
    bundle + active-bp overlay. Exported only for testing
    (`tests/canvasCss.test.ts`); the inline reducer's `walk(sections)`
    is the only production caller.
  - Imports in `Canvas.tsx`: `buildBlockChromeCss` added; `getCustomCss`
    dropped (now folded into `buildBlockChromeCss`). `buildBlockCss` /
    `buildHoverCss` / `buildImgVisualCss` / `buildImgVisualHoverCss`
    kept — used by the overlay path.
  - Tests: new `tests/canvasCss.test.ts` (11 tests) — desktop output
    equals the frontend's `buildBlockChromeCss` exactly for each
    representative shape (text, image with `imgScoped`, dark variant,
    full bundle); active-bp preview overlay layers AFTER the frontend
    bundle (string prefix), only fires when active bp has overrides,
    routes images through `imgScoped`, wins cascade order. Total
    242 → 253 (+11 new).
  - LOC: `Canvas.tsx` 596 → 631 (+35) — the new
    `buildCanvasBlockCss` + `buildActiveBpPreviewCss` pair plus the
    F3.6.3 doc comment block. The pseudo-merge logic moved into the
    overlay function but no longer pollutes the main code path.
  - Files: `src/admin/Canvas.tsx`, `tests/canvasCss.test.ts` (new),
    `CHANGELOG.md`, `.claude/prd-builder-ui.md`,
    `.claude/prd-breakpoints.md`,
    `.claude/coordination/status/agent-c.md`.
- **F3.6.4 (migration) — `runMigrationLegacySpacingV1` rewrites legacy
  symbolic spacing values (`none/sm/md/lg/xl`) to their px equivalents
  in stored layouts.** Idempotent, KV-flag-gated
  (`state:migration:legacy_spacing_v1`), runs at the lazy gate alongside
  `migration_to_storage_v1`. Pair with F3.6.4's frontend half (B) to
  fully retire the symbolic-spacing path.
  - Map (verbatim from `SectionContainer.astro`'s `spacingMap`):
    `none → "0"`, `sm → "32px"`, `md → "48px"`, `lg → "64px"`,
    `xl → "96px"`.
  - Coverage: `paddingTop/Right/Bottom/Left` and
    `marginTop/Right/Bottom/Left` keys, on every block's
    `config.style`, `config.styleHover`, `config.styleDark`,
    `config.styleBreakpoints[bp]`, `config.styleHoverBreakpoints[bp]`,
    recursively into `block.children` and `block.slots`.
  - Sequencing: lazy-gate-wired in `plugin.ts` after
    `ensureStorageMigrationRan` so legacy SQLite rows have already
    landed in `ctx.storage` before this rewrites them. Sites:
    `listEntriesForCollection`, `/layout` GET + POST, `/toggle`,
    and the `content:afterDelete` hook.
  - Brief upgrade glitch: Agent B is concurrently dropping the
    `spacingMap` fallback in `SectionContainer.astro`. After both
    PRs ship, frontend has no fallback AND data is migrated. Hosts
    upgrading 0.9.5 → 0.9.6 may see padding / margin render as the
    unparsed string (e.g. `"md"`) for one request after the upgrade
    until the lazy gate runs and rewrites the stored row. KISS —
    running the migration on every layout read would add a meaningful
    per-request cost.
  - On rewrite, `updatedAt` is bumped to a fresh ISO timestamp so the
    `cacheHint.lastModified` path on `getBuilderLayout` invalidates
    any cached page that rendered with the unparsed symbolic value
    before the migration ran.
  - Files: `src/migrations/legacySpacingV1.ts` (new), `src/plugin.ts`
    (5 lazy-gate sites + import), `tests/legacySpacingMigration.test.ts`
    (new — 22 cases). `version` in `package.json` stays at `0.9.5` —
    F3.6 phase will bump to 0.9.6 at phase close.
- **F3.6.4 (frontend) — drop SectionContainer's legacy `spacingMap`
  fallback. Symbolic spacing values (`none`/`sm`/`md`/`lg`/`xl`) are now
  inline-resolved by `styleUtils.ts` via `normalizeLegacySpacing`,
  applied to padding/margin keys inside `buildStyleBodyFromObject` (the
  single chokepoint that emits every block's CSS).** Single source of
  truth: `style.paddingTop` etc. carry concrete px values at render
  time, with the legacy map applied only when the persisted value
  matches one of the five symbolic keys. The post-hoc
  `paddingCss` / `styleWithoutPadding` regex dance in
  `SectionContainer.astro` was retired together with the local
  `spacingMap` and `resolveSpacing` helpers — the container now just
  spreads `value.style` through the standard chrome builder. Pair with
  Agent A's `runMigrationLegacySpacingV1` (separate branch) which
  rewrites stored values forward; the inline-resolve guards the brief
  upgrade-to-migration window so rows that haven't been rewritten yet
  still render correct padding instead of dropping to 0. Restricted to
  padding+margin keys (`LEGACY_SPACING_PROP_SET`) so non-spacing
  attributes (`width`, `borderTopWidth`, …) keep their values
  unchanged. New export: `normalizeLegacySpacing(value)`. New tests
  (`tests/styleUtils.test.ts`): `normalizeLegacySpacing` describe (3
  cases — exact-map, pass-through, no-false-match), `buildBlockCss —
  F3.6.4 legacy spacing inline-resolve` describe (4 cases — symbolic
  padding, symbolic margin, concrete-value pass-through, scoped to
  padding+margin only), `buildBreakpointCss — F3.6.4 legacy spacing
  inline-resolve` describe (1 forward-compat case). Total 242 → 250
  (+8 new). Files: `src/components/styleUtils.ts`,
  `src/components/SectionContainer.astro`,
  `tests/styleUtils.test.ts`, `.claude/prd-frontend.md`,
  `.claude/prd-breakpoints.md`.

- **F3.6.2 — `getDefaultBlockConfig(type)` helper exported from
  `blockDefinitions.ts`. `ADD_BLOCK` + `LOAD_SUCCESS` (plus
  `ADD_TO_CONTAINER` and `INSERT_AFTER` for consistency) fill missing
  keys at mount, not at render. Old layouts upgraded transparently;
  Canvas / RightPanel / frontend no longer need defensive `?? ""`
  checks for style keys (F3.6.3 builds CSS unification on top).** New
  exports:
  - `BASE_DEFAULTS` — shared shape every block inherits
    (`theme: "light"` plus the F3.6.1 empty structural placeholders
    `style` / `styleHover` / `styleDark` / `styleBreakpoints` /
    `styleHoverBreakpoints` / `advanced`). Centralises the contract so
    legacy layouts that pre-date the F3.6.1 BlockDef edits still
    backfill correctly.
  - `getDefaultBlockConfig(type: BlockType)` — returns
    `structuredClone({ ...BASE_DEFAULTS, ...def.defaultConfig })` with
    nested objects (`style`, `advanced`) deep-merged so design defaults
    like `container.style.paddingTop = "12px"` survive on top of the
    `EMPTY_STYLE_DEFAULTS` floor. Two calls return independent objects
    (mutating one doesn't affect the other). Unknown block types fall
    back to a deep-cloned `BASE_DEFAULTS` so callers never get
    `undefined`.
  - Reducer: `ADD_BLOCK` (+ `ADD_TO_CONTAINER` + `INSERT_AFTER`)
    deep-merges the action's `block.config` over
    `getDefaultBlockConfig(block.type)` so freshly-instantiated blocks
    are always full-shape and the action's explicit values win on
    overlap. `LOAD_SUCCESS` walks the section tree (recursing into
    `children` and `slots`) and backfills missing keys per node;
    existing values are never overwritten.
  - Tests: `tests/blockDefinitions.test.ts` adds an F3.6.2 describe
    block (9 tests) — `BASE_DEFAULTS` shape, full STYLE_PROPS coverage
    on every `getDefaultBlockConfig`, deep-clone independence,
    pre-existing design defaults preserved, unknown-type fallback,
    block-specific scalar/nested defaults survive, advanced defaults
    are all `""`. `tests/builderReducer.test.ts` adds an F3.6.2
    describe block (9 tests) — ADD_BLOCK fills defaults for each of
    the 9 block types, action-wins-on-overlap, design defaults
    preserved, LOAD_SUCCESS backfills sparse layouts (root +
    children + slots), nested values preserved, ADD_TO_CONTAINER +
    INSERT_AFTER consistency. Total 224 → 242 (+18 new).
  - Files: `src/admin/blockDefinitions.ts`,
    `src/admin/builder/builderReducer.ts`,
    `tests/blockDefinitions.test.ts`,
    `tests/builderReducer.test.ts`,
    `.claude/prd-blocks.md`, `.claude/prd-builder-ui.md`.
    `package.json` stays at `0.9.5` — F3.6 phase will bump to 0.9.6 at
    phase close.

- **F3.6.1 — every `BlockDef.defaultConfig` now declares the full
  style/styleHover/styleDark/styleBreakpoints/styleHoverBreakpoints/advanced
  structure (empty values).** No design values invented — user
  populates aesthetic defaults later. Foundation for F3.6.2 (load-time
  fill helper) and F3.6.3 (Canvas / frontend CSS unification). The new
  shared shape:
  - `style` carries every key in `STYLE_PROPS` (`styleUtils.ts`) — 36
    entries spanning padding/margin/sizing/border-radius/border-width/
    overflow/typography/blend-mode/aspect-ratio/filter, all defaulted
    to `""`. Two new exports — `EMPTY_STYLE_DEFAULTS` and
    `EMPTY_ADVANCED_DEFAULTS` — live in `src/admin/blockDefinitions.ts`
    so each BlockDef spreads them rather than duplicating the key list.
  - `styleHover`, `styleDark`, `styleBreakpoints`, `styleHoverBreakpoints`
    default to empty `{}` placeholders (populated by user toggles).
  - `advanced` defaults to `{ cssId, cssClasses, customCss, position,
    top, right, bottom, left, zIndex }` all `""`. Mirrors
    `AdvancedConfig` from `right-panel/types.ts`.
  - Pre-existing design values survive: `container.style` still carries
    its `paddingTop/Right/Bottom/Left = "12px"` and
    `columnGap/rowGap = "6px"` baked-in defaults; the merge spreads
    `EMPTY_STYLE_DEFAULTS` first and lets the design overrides win.
    Block-specific keys (`text-editor.columns`, `video.aspectRatio`,
    `divider-spacer.divider`, etc.) keep their existing values.
  - Tests: `tests/blockDefinitions.test.ts` adds an F3.6.1 describe
    block (5 new tests, 219 → 224) — STYLE_PROPS coverage on
    `EMPTY_STYLE_DEFAULTS`, full STYLE_PROPS coverage on every block's
    `defaultConfig.style`, full top-level shape coverage, every
    `EMPTY_ADVANCED_DEFAULTS` key on every `defaultConfig.advanced`,
    and a "no design values invented" assertion that whitelists the
    pre-existing `container` padding overrides.
  - Files: `src/admin/blockDefinitions.ts`,
    `tests/blockDefinitions.test.ts`, `.claude/prd-blocks.md`.
    `version` in `package.json` stays at `0.9.5` — F3.6 phase will bump
    to 0.9.6 only at phase close.

## 0.9.5 — 2026-05-09

- **F3.5.8 — block-author guide added to `.claude/prd-blocks.md`.** Phase
  F3.5 (Block Settings Standardization) is now complete: declarative
  `BlockDef.fieldsTab` + `styleTab` replaces 1671 LOC of imperative
  `RightPanel.tsx` branching with a 3-step workflow (BlockDef + preview
  + Astro component). Adding a new block type no longer requires
  touching `RightPanel.tsx`, `SectionRenderer.tsx`, `TabRenderer.tsx`,
  or `AdvancedTab.tsx`. The new author guide documents the recipe,
  full `BlockDef` / `FieldDef` / `StyleSection` references, a worked
  example (`quote` block), the explicit "what NOT to touch" list, and
  the `kind: "custom"` escape hatch for both Style and Fields tabs.
  `prd-rightpanel.md` cross-links to the guide and adds a
  "When you'd modify RightPanel.tsx" section (top-shell concerns
  only). `prd-index.md` Quick Links surface the guide as the entry
  point for new-block work; the architecture diagram + BlockDef schema
  snippet now reflect the post-F3.5.6 declarative shape.
- **Hotfix follow-up — `getBuilderLayout(...)` is now polymorphic over the
  3-arg legacy and 4-arg `Astro`-first signatures.** F3.4 (and the earlier
  `fix/F3.4-frontend-empty` follow-up) changed the signature from
  `(collection, entryId, enabled)` to `(astro, collection, entryId, enabled)`
  but host pages scaffolded by `npx empixel-builder add` (and any host that
  pinned to the v0.8 / pre-F3.4 shape, e.g. Novapera) still call the 3-arg
  form. When the legacy 3-arg call hit the new function, args slotted in as
  `astro = "<collection>"` (a string), `collection = <entryId>` (the
  uppercase Crockford ULID), `entryId = <enabled flag>` — and the
  `COLLECTION_RE.test(collection)` line then rejected the uppercase ULID,
  returning null sections. `BuilderWrapper` fell through to `<slot />` and
  the host theme template rendered instead of builder content (the same
  visible symptom as the original F3.4 bug, despite the
  `fix/F3.4-frontend-empty` patch). The new function dispatches on the
  first argument: if it's a string, treat as legacy (3-arg) and resolve the
  Kysely handle via `getDb()` from `emdash/runtime` directly — no
  `Astro.locals.emdash.db` available in that path. The 4-arg form is
  unchanged. Hosts that want `Astro.cache.set(cacheHint)` plumbing should
  adopt the 4-arg form, but the 3-arg form continues to render builder
  content correctly. Theme code (Novapera and other host sites) stays
  untouched per the hard constraint. Files: `src/components/db.ts`,
  `tests/getBuilderLayout.test.ts` (+5 cases — Novapera-shape ULID
  short-circuit absence, enabled=false / undefined / invalid-collection in
  the legacy shape, end-to-end runtime-singleton round-trip via the legacy
  shape), `.claude/prd-frontend.md`.

- **Hotfix (admin): F3.5.6 follow-up — Style tab spacing matches Fields tab.**
  The F3.5.6 RightPanel rewrite renders the Style-tab body inside a
  `.epx-right-panel__style` wrapper (vs Fields' `.epx-right-panel__fields`),
  but `builder.css` only carried the spacing/scrollbar rule for the Fields
  selector. Result: the Style tab body collapsed against the panel edge
  with no padding, no inter-section gap, no working overflow scroll.
  Fix: combined the selector
  (`.epx-right-panel__fields, .epx-right-panel__style { ... }`) so both
  tab bodies inherit the same spacing. Class names in `TabRenderer.tsx`
  are intentionally distinct (different child shapes) — the bug was
  purely a missing CSS rule, not a class-emission mismatch.
- **Hotfix (admin): F3.5.6 follow-up — drop redundant top-level `theme`
  entries from container/button `styleTab`.** `BackgroundSection`
  already renders `<ThemeStyleToggle />` inline at the top of the
  Background controls (`sections/BackgroundSection.tsx` L57), so a
  leading `{ kind: "theme" }` entry on a `styleTab` that also contains
  `{ kind: "background" }` produced two theme toggles stacked above
  each other on the container Style tab (and on button after F3.5.2
  declared its `styleTab` with the same shape). Per-block audit:
  - `container` — `[theme, background, …]` → dropped `theme`. Now
    `[background, borderRadius, border, boxShadow]` (5 → 4 entries).
  - `button` — `[typography, theme, background, …]` → dropped `theme`.
    Now `[typography, background, borderRadius, border, boxShadow]`
    (6 → 5 entries).
  - `text`, `image`, `text-editor`, `video`, `icon`, `html`,
    `divider-spacer` — no leading-`theme`-then-`background` pattern;
    no change. Theme is currently surfaced only via the Background
    section; if a future block needs theme without Background (e.g.
    a future flex-grid section that wants the toggle), re-introduce
    `{ kind: "theme" }` next to that section, not at the top of
    `styleTab`. Regression test: `blockDefinitions.test.ts` now
    asserts no `theme→background` adjacent pair exists in any
    BlockDef.
- **Hotfix: `/entries` route now returns the entries the builder is
  enabled for instead of an empty list.** F3.2's storage migration
  produced rows under doc id `<collection>::<entryId>`, but the F3.5
  rewrite of the `/entries` handler reached for a Kysely handle on
  `(ctx as { db?: unknown }).db` which does not exist —
  `PluginContext` only exposes `kv`, `storage`, `content?`, `media?`,
  `http?`, `log`, `site`, `users?`, `cron?`, `email?`. The cast was a
  type-level lie; at runtime `ctx.db === undefined` and the entire
  host-table SELECT short-circuited, leaving the page-selector table
  blank on Novapera (and any other production host). Cascade: the
  builder topbar showed the bare ULID instead of the entry title
  because `BuilderPage.tsx`'s `selected.title` falls back to
  `selected.id` when the entries response doesn't contain the row.
  - The handler now reads through `ctx.content.list(collection,
    { limit, orderBy: { createdAt: "desc" } })` and merges in the
    per-entry metadata (enabled flag + timestamps) from
    `ctx.storage.layouts.query({ where: { collection } })`. Works
    transparently on SQLite, Postgres, libSQL, D1, and Turso —
    the multi-driver story F3.5 promised but didn't deliver.
  - `resolveSlugToUlid` (the route-boundary slug→ULID resolver for
    fresh entries) goes through `ctx.content.list` for the same
    reason. Capped at 200 rows because the slug→ULID branch is
    only a fresh-entry convenience; a slug that doesn't appear in
    the first 200 most-recent entries is almost certainly stale.
  - The `/toggle` route's "mirror enabled bit onto
    `ec_<collection>.empixel_builder`" UPDATE has been **dropped**.
    It was already a runtime no-op (same `ctx.db` lie); maintaining
    a duplicate enabled bit purely for downstream host queries
    would require expanding the capability surface to
    `content:write`, which fails KISS for a best-effort mirror.
    Hosts that need to filter on `empixel_builder` should read from
    `_plugin_storage` instead (filter by `plugin_id`,
    `collection = "layouts"`, JSON-extract `data.enabled`).
  - New helper `listEntriesForCollection(ctx, collection, limit)` is
    exported from `src/plugin.ts` so the unit test can drive every
    branch directly without spinning up an HTTP layer. Public
    response shape unchanged — `BuilderPage.tsx` /
    `PageSelector.tsx` consume the same `{ id, slug, title,
    created_at, updated_at, builder_enabled }` items as before.
- **Hotfix — `getBuilderLayout(...)` now finds the layout row in
  `_plugin_storage`.** Two bugs landed together in F3.4: (1) the reader
  gated the entire storage read on `Astro.locals.emdash.db` being a
  Kysely instance, but the EmDash middleware only attaches `db` to
  `locals.emdash` on **authenticated/admin** requests — anonymous public
  page renders (the actual host pages the builder targets) get
  `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }` only,
  so the read short-circuited to null; (2) the Kysely query filtered on
  `(plugin_id, collection)` and called `executeTakeFirst()`, which
  returned an arbitrary plugin row — the post-fetch
  `parsed.collection !== collection` guard then forced null even when the
  matching row existed (and collided with stale orphan rows on real
  data). The fix: resolve the Kysely handle through `Astro.locals.emdash.db`
  first, then fall back to `await getDb()` from `emdash/runtime` (the
  public accessor for the same singleton EmDash uses internally) so
  anonymous renders also reach the DB; query for the canonical composite
  doc id `${collection}::${entryId}` (mirrored from `src/plugin.ts §
  layoutDocId`, the same key the plugin runtime writes rows under). The
  lookup is now single-row deterministic, no scan, no orphan-row
  collision. Builder-enabled pages render builder content instead of
  falling back to the host theme's static template. Files: `src/components/db.ts`,
  `tests/getBuilderLayout.test.ts` (+2 regression cases — the Novapera
  multi-row scenario and the orphan-only short-circuit), `.claude/prd-frontend.md`.

- **F3.5.6 — rewrite `RightPanel.tsx` on the declarative pipeline.**
  `RightPanel.tsx` is now a thin shell on top of the
  `BlockDef.fieldsTab` / `styleTab` declarations introduced in
  F3.5.1—F3.5.5. Every per-block imperative branch (9 across the
  Fields and Style tabs) is gone; tab visibility is driven by
  `getVisibleTabs(block)` (replaces the hardcoded
  `hideStyleTab = block.type === "html"` gate). Body dispatch goes
  through `<TabRenderer />` → `<FieldRenderer />` /
  `<SectionRenderer />` / `<AdvancedTab />`.
  - `FieldDef` gained a `kind: "custom"` variant alongside the
    existing `kind: "standard"` (default) shape — mirrors the
    Style-tab equivalent and lets blocks declare their bespoke
    Fields-tab content (`container` LayoutControl/Gap/Overflow/HTML
    tag/link, `video` source + image overlay, `image` preview/
    resolution/link, etc.) through `fieldsTab` without an imperative
    branch. The discriminator is optional on the standard variant so
    every existing declaration compiles unchanged. `FieldRenderer`
    extended with a `customCtx` prop carrying `{ block, panelOnChange,
    activeBreakpoint }` for `kind: "custom"` entries.
  - Six new section components extracted under
    `src/admin/right-panel/sections/`:
    `ContainerLayoutPicker.tsx`, `VideoFieldsSection.tsx`,
    `ImageFieldsSection.tsx`, `TextFieldsExtras.tsx`,
    `LinkFieldsSection.tsx`, `TextEditorFieldsSection.tsx`.
    Each owns the previously-inline state (e.g. `pickerOpen` for the
    image / video media picker, the columns scrub handler) so the
    shell stays state-free.
  - `divider-spacer` Fields tab no longer renders the divider-line
    picker — it lives on the Style tab now (already declared as
    `kind: "custom"` in F3.5.2).
  - `RightPanel.tsx`: 1671 LOC → 162 LOC. The deprecated `fields` /
    `styleFields` aliases on `BlockDef` are kept for one more release
    (still pointed at the same arrays as `fieldsTab`) — F3.5.7 / .8
    can drop them once external consumers (if any) finish migrating.
  - Tests: 171 → 198 (+27 across `rightPanel.test.ts`,
    `blockDefinitions.test.ts` field-count assertions updated).

- **F3.5.5 — universal `<AdvancedTab />` component.** Extract
  `src/admin/right-panel/AdvancedTab.tsx`. One component covers
  Width / Height / Padding / Margin / Position+Offset / Z-Index /
  CSS ID / CSS Classes / Custom CSS for every block — no per-type
  branching. Reads `block.config.advanced` (for the
  position/z-index/css/customCss group) and `block.config.style`
  (for width/height/padding/margin), dispatching merged
  `{ advanced }` or `{ style }` patches via `onChange`. Reuses the
  existing `controls/` primitives (`SpacingControl`,
  `DimensionControl`, `SelectRow`, `NumberRow`, `TextRow`,
  `CodeEditor`, `FieldGroup`) so the markup is identical to the
  inline JSX in `RightPanel.tsx`. The Offset block is conditionally
  revealed only when `advanced.position` is non-empty (matches the
  legacy behavior). `TabRenderer` now renders this component for
  the `advanced` tab — replaces the F3.5.4 placeholder. F3.5.6
  deletes the inline `AdvancedTab` function from `RightPanel.tsx`.

- **F3.5.4 — `TabRenderer` + `getVisibleTabs(block)`.** New
  `src/admin/right-panel/TabRenderer.tsx` wires the 3-tab shell
  (Fields / Style / Advanced) to the declarative `BlockDef` schema.
  `getVisibleTabs(block)` computes the visible set per declaration:
  Fields appears when `def.fieldsTab` (or back-compat `def.fields`) is
  set, Style appears when `def.styleTab` is non-empty, Advanced is
  always present. The Style tab hides automatically when `styleTab` is
  absent — replaces the hardcoded `hideStyleTab = block.type === "html"`
  branch in `RightPanel.tsx`. The Fields body iterates
  `def.fieldsTab ?? def.fields` and dispatches to `<FieldRenderer>` (a
  KISS `kind: "custom"` slot is anticipated for F3.5.6 without
  committing to it today). The Style body iterates `def.styleTab` and
  dispatches to F3.5.3's `<SectionRenderer>`. The Advanced body is a
  placeholder until F3.5.5 ships the real `<AdvancedTab />`. Also
  exports `useAutoSelectTab(block, activeTab, setActiveTab)`, a hook
  that snaps `activeTab` back to the first visible tab when
  `block.type` changes — F3.5.6 imports it as a one-line drop-in.
  `RightPanel.tsx` is unchanged in this PR; F3.5.6 owns the swap.

- **F3.5.3 — `SectionRenderer` dispatcher.** New
  `src/admin/right-panel/SectionRenderer.tsx` maps each
  `StyleSection.kind` to the matching control under
  `src/admin/controls/` (or one of the extracted wrappers under
  `src/admin/right-panel/sections/`). Pure switch — no business logic
  — under 200 LOC. Exhaustiveness enforced via an `assertNever` default
  branch so adding a new `StyleSection` variant in the future causes
  a typecheck error here. The dispatcher is NOT yet wired into
  `RightPanel.tsx`; F3.5.6 will swap the imperative `block.type ===`
  branches over to it. Five new section wrappers landed alongside the
  dispatcher to keep the switch under the LOC ceiling:
  `BackgroundSection.tsx` (Normal/Hover toggle + theme row),
  `StatefulStyleSection.tsx` (shared shell for `borderRadius` /
  `border` / `boxShadow` Normal/Hover state + bp routing),
  `OpacitySection.tsx` (image-block Opacity with state toggle),
  `ImgVisualSection.tsx` (image-block Width/Height/fit/position/align),
  `BpAwareStyleSections.tsx` (small bp-aware wrappers for `alignment` /
  `typography` / `textStroke` / `textShadow` / `blendMode` / `filter` /
  `overflow` / `spacing`).

- **F3.5.2 — migrate all 9 `BlockDef` instances to the declarative
  `fieldsTab` + `styleTab` schema introduced in F3.5.1.** Each of
  `container`, `text`, `image`, `text-editor`, `video`, `button`,
  `icon`, `html`, and `divider-spacer` now declares its Fields tab
  (`fieldsTab: FieldDef[]`) and Style tab (`styleTab: StyleSection[]`)
  through the new schema. Non-trivial Style logic
  (text-editor paragraph spacing + drop cap, video aspect ratio +
  filter, divider-spacer divider-line picker, icon color/size/rotate)
  extracted into `src/admin/right-panel/sections/` and referenced via
  `{ kind: "custom", render: ... }` entries:
    * `TextEditorDropCapSection.tsx` — covers Paragraph Spacing and
      the conditional Drop Cap subgroup (Size / Lines / Margin Right).
    * `VideoSourceSection.tsx` — Aspect Ratio (with custom W/H
      fallback) and `CssFiltersControl`.
    * `DividerLineSection.tsx` — full divider-line picker
      (style / width / length / color or gradient editor / align /
      `IconGroup`). Lifted out of the divider-spacer Fields branch;
      lives under `styleTab` going forward.
    * `IconBlockStyleSection.tsx` — icon color (Normal/Hover), size,
      and rotate. None of these match a built-in `StyleSection`
      variant, so they share one custom entry.
  Existing `fields` / `styleFields` arrays are kept and now alias the
  new `fieldsTab` arrays directly (every block points both keys at the
  same shared array). The hardcoded `block.type === ...` branches in
  `RightPanel.tsx` stay in place — F3.5.6 deletes them and switches
  the panel onto the declarative path.

- **F3.5.1 — declarative `StyleSection` types + `fieldsTab` /
  `styleTab` on `BlockDef`.** Adds the discriminated-union schema
  (`theme` / `spacing` / `background` / `border` / `borderRadius` /
  `boxShadow` / `typography` / `textStroke` / `textShadow` /
  `alignment` / `blendMode` / `filter` / `overflow` / `opacity` /
  `imgVisual` / `videoSource` / `iconGroup` / `dividerLine` /
  `custom`) plus optional `fieldsTab: FieldDef[]` and
  `styleTab: StyleSection[]` properties on `BlockDef`. Existing
  `fields` / `styleFields` are kept as deprecated aliases during the
  F3.5 transition; `getBlockDef` returns `fieldsTab` aliased from
  `fields` when an entry doesn't declare it. F3.5.2 migrates the 9
  `BlockDef` instances to the new schema; F3.5.6 drops the imperative
  `block.type ===` branches in `RightPanel.tsx`. No behavioral change
  in 0.9.x — types are additive.

## 0.9.0 — 2026-05-09

- **Breaking** — drop the `better-sqlite3` peer dependency. Plugin no
  longer opens its own SQLite handle; all reads + writes go through
  EmDash's `ctx.storage` (multi-driver: SQLite, Postgres, libSQL/D1).
  Removed the `databasePath` option from `empixelBuilder({ ... })` —
  storage is configured at the EmDash root in `astro.config.mjs`.
  Hosts upgrading from 0.8.x: ensure F3.3's `migration_to_storage_v1`
  ran successfully (check the `_plugin_storage` table for your plugin
  id). Hosts on Postgres / libSQL: the migration is a no-op since the
  legacy table never existed.

  ### Migration steps for hosts

  1. **Check that `migration_to_storage_v1` ran on your previous
     deploy.** On 0.8.x the migration ran lazily on the first request
     to a layout route after upgrade. Verify by querying your storage
     back-end for the `_plugin_storage` row matching
     `plugin_id = 'empixel-builder' AND collection = 'layouts'`. If
     rows exist, you're done. (Hosts on Postgres / libSQL never had
     the legacy table, so this is a no-op for you.)
  2. **Remove the `databasePath` option** from your
     `empixelBuilder({ ... })` call in `astro.config.mjs` if you set
     it. The option is gone — storage is configured at the EmDash
     root via `database()` in `astro.config.mjs`, not on the plugin.
  3. **Optional: drop `better-sqlite3` from your host's
     `peerDependencies`** if you only carried it for this plugin.
     EmDash itself still uses `better-sqlite3` transitively for the
     SQLite driver; only the explicit peer dep on the plugin side is
     gone.

- The legacy fallback paths in `src/plugin.ts` (route handlers
  reading from `empixel_builder_layouts`, `content:afterDelete`
  cascade DELETE) and `src/components/db.ts` (frontend reader's
  `readFromLegacyTable`) are removed. The route handlers and frontend
  reader are storage-only.
- `src/dbShared.ts` is deleted. The shared SQLite handle factory
  (`getDb`) and the `setDefaultDatabasePath` /
  `resolveDatabasePath` helpers are gone — the plugin no longer
  manages a SQLite singleton.
- `runMigrationToStorageV1` keeps a dynamic-import bridge to
  `better-sqlite3` so SQLite hosts upgrading from 0.8.x still copy
  their legacy `empixel_builder_layouts` rows into `ctx.storage` on
  first cold start. On Postgres / libSQL / D1 hosts where the
  binary isn't installed, the migration silently no-ops and the KV
  flag is set so future requests are O(1). The cold-start migrations
  `runSpacerMigration` (v0.6 → divider-spacer) and
  `runSlugToUlidMigration_v1` (v0.8 → ULID-keyed rows) are deleted —
  both apply only to the legacy SQLite table that the plugin no
  longer touches; any host that upgraded through 0.8.x already has
  them flagged in `empixel_builder_meta`, and the F3.3 migration
  copies the post-rewrite rows into `ctx.storage` regardless.
- `getMigrationFlag` and `setMigrationFlag` no longer take a `db`
  argument or mirror to the legacy `empixel_builder_meta` table. They
  read/write `ctx.kv` only. The legacy-meta sync-forward path lives
  inside `toStorageV1.ts` against the migration's own dynamically-
  imported SQLite handle (so hosts that ran the migration pre-F3.2
  still get the flag synced forward to KV on the F3.5 upgrade).
- The `/settings` and `/toggle` routes no longer auto-add the
  `empixel_builder INTEGER NOT NULL DEFAULT 0` column to
  `ec_<collection>` via `ALTER TABLE`. The auto-augment helper
  required direct SQLite access; with the multi-driver storage
  abstraction, schema augmentation is back to seed-driven (declare
  the column in your `seed.json`). The `/toggle` UPDATE that mirrors
  the enable bit onto the host's row is best-effort via `ctx.db`
  (Kysely) — failures log via `logCaught` and don't break the route.

### Earlier work folded into 0.9.0

- One-shot data migration `migration_to_storage_v1`. Copies every
  `empixel_builder_layouts` row into `ctx.storage.layouts` on first
  boot. Idempotent — KV flag `state:migration:to_storage_v1` gates
  re-runs (and is honored from the legacy `empixel_builder_meta`
  table for hosts that flipped the flag pre-F3.2). Conflict
  resolution: newer `updatedAt` wins; ties go to storage. Together
  with F3.2's storage-first reads, hosts upgrade transparently — no
  manual steps. Wire-up is a **lazy gate**
  (`ensureStorageMigrationRan`) called at the top of every route
  handler that reads or writes layouts. EmDash's `plugin:install` /
  `plugin:activate` lifecycle hooks only fire on state transitions
  (not every cold start), so they're not suitable for this migration
  — the lazy gate runs on the very first request post-upgrade and
  short-circuits via a process-local cache plus the KV flag for
  every subsequent call.
- Refactor every plugin route handler to read/write layouts via
  `ctx.storage.layouts` instead of direct SQL against the legacy
  `empixel_builder_layouts` table. **Writes go only to ctx.storage**;
  **reads try storage first** and fall back to the legacy table for one
  version while F3.3 migrates rows. The fallback is encapsulated in two
  helpers — `readLayoutFromStorageOrLegacy` for single-row reads
  (`/layout` GET) and `readLegacyEntryMetaForCollection` for the
  collection-wide listing (`/entries`) — so F3.5 can drop both in one
  surgical edit after F3.3 ships and a release goes by. The
  `content:afterDelete` hook deletes from BOTH layers because pre-F3.3
  rows may live in either. Storage docs are keyed by the deterministic
  composite id `${collection}::${entryId}` so direct point-lookups stay
  O(1) without going through `query({ where })`. The legacy table
  itself is **not dropped** — only its writes are; its reads remain as
  a fallback during the transition.
- Migration flag plumbing moved to `ctx.kv` (key prefix
  `state:migration:`). New helpers `getMigrationFlag` and
  `setMigrationFlag` read from KV first; if KV is empty but the legacy
  `empixel_builder_meta` table has the flag, the legacy value is
  trusted and synced forward to KV (so the next read skips the SQL
  lookup entirely). Existing cold-start migrations
  (`runSpacerMigration`, `runSlugToUlidMigration_v1`) keep writing to
  the legacy meta table — they run synchronously inside `getDb()` and
  don't have access to async ctx — but the new helpers are exported for
  the F3.3 ctx.storage migration to use directly.
- **Breaking** — `getBuilderLayout(...)` is now async and takes `Astro`
  (or any context with `.locals.emdash`) as the first argument. The new
  signature is
  `getBuilderLayout(astro, collection, entryId, enabled?): Promise<BuilderLayoutResult>`.
  The frontend reader routes through `ctx.storage.layouts` (EmDash's
  multi-driver plugin storage abstraction) by querying the shared
  `_plugin_storage` table via `Astro.locals.emdash.db` — partitioned
  under `plugin_id = "empixel-builder", collection = "layouts"` — with a
  read-only fallback to the legacy `empixel_builder_layouts` SQLite
  table for one version while the F3.3 migration copies rows over. The
  legacy fallback dispatches through `getDb()` from `dbShared.ts`
  (`src/components/db.ts:275` — `readFromLegacyTable`). F3.5 drops the
  fallback and the `better-sqlite3` peer dependency entirely. Hosts
  importing `getBuilderLayout` directly need to (1) `await` the call
  and (2) pass `Astro` as the first arg. `BuilderWrapper.astro` does
  both for you when used as `<BuilderWrapper sections={getBuilderLayout(Astro, ...)}>`
  — the wrapper accepts the resolved value, the awaited promise, and
  the legacy `SectionBlock[] | null` shape from older
  `npx empixel-builder add` scaffolds.
- Re-export `getBuilderLayout`, `BuilderLayoutResult`,
  `BuilderCacheHint`, `BuilderLayoutContext`, and
  `builderLayoutCacheTag` from `empixel-builder/components` so consumers
  don't deep-import from `empixel-builder/components/db.js`. This lifts
  the F2.4 deep-import debt that was deferred when Agent A wasn't
  allowed to touch `src/components/index.ts`.
- Declare `storage.layouts` in `definePlugin` so EmDash provisions the
  layouts collection through its multi-driver storage abstraction. The
  collection is keyed on the composite `(collection, entryId)` pair via
  both `indexes` and `uniqueIndexes`, mirroring the existing
  `empixel_builder_layouts` PK. EmDash routes storage rows through the
  shared `_plugin_storage` table (filtered by `plugin_id =
  "empixel-builder" AND collection = "layouts"`), which is separate
  from the legacy `empixel_builder_layouts` table — so the two
  back-ends coexist while the migration is in flight.
- New `src/storage-types.ts` exposes `LayoutRow` and
  `StorageLayoutsCollection` (typed `StorageCollection<LayoutRow>`) so
  Agent B can consume the typed `ctx.storage.layouts` handle in F3.4
  without re-declaring the shape.

## 0.8.0 — 2026-05-09

- **Breaking — `getBuilderLayout` now returns `{ sections, cacheHint }`**
  instead of `SectionBlock[] | null`. The `cacheHint` matches EmDash's
  `CacheHint` shape (`{ tags?: string[]; lastModified?: Date }`) and
  always carries the layout-scoped tag
  `empixel:layout:<collection>:<entryId>` so admin saves can invalidate
  the host page by tag. `lastModified` is parsed from the layout row's
  `updated_at` (existing column — no schema change). `BuilderWrapper`
  plumbs the hint into `Astro.cache.set(...)` automatically when the
  host passes the `BuilderLayoutResult` straight through; the wrapper
  also accepts the legacy `SectionBlock[] | null` shape so pages
  scaffolded by an older `npx empixel-builder add` keep rendering until
  they're updated. Manual consumers can destructure
  `{ sections, cacheHint }` and call `Astro.cache.set` themselves —
  documented in the README's "Caching builder layouts" section. Public
  API break for any host that imports `getBuilderLayout` directly.
- One-shot slug → ULID migration on cold start (KV flag
  `migration_slug_to_ulid_v1` in `empixel_builder_meta`). Pre-0.8 routes
  accepted both keys and the read paths walked a slug↔ULID fallback
  chain on every request; the migration rewrites every slug-keyed
  `empixel_builder_layouts` row to its canonical ULID by joining on
  `ec_<collection>.slug`. Conflicts (both keys present) resolve in
  favour of the row with the newer `updated_at`; ULID wins on ties.
  Unresolvable slug rows are LEFT IN PLACE and logged — manual recovery
  via re-save under the new slug. Wrapped in a transaction; idempotent
  (the flag is set on completion). Plugin routes (`/layout` GET+POST,
  `/toggle`) and the frontend reader (`components/db.ts`
  `getBuilderLayout`) drop the multi-query fallback chain — layouts now
  resolve by ULID directly. The route-level slug → ULID resolution is
  retained for the fresh-entry case (host CMS hands us a slug for an
  entry that has never been saved through the builder).
- Plugin now auto-adds the `empixel_builder INTEGER NOT NULL DEFAULT 0`
  column to `ec_<collection>` on the first `POST /settings` enable (and
  the first `POST /toggle` for collections that skip the collection-level
  enable). Hosts no longer need to declare the column in `seed.json`.
  Idempotent — SQLite's "duplicate column" error is swallowed; any other
  ALTER failure is logged via `logCaught`. The collection name still
  passes through `isValidCollection(...)` before the DDL — never raw
  user input into a SQL identifier (issue: report C2/Q5).
- `resolveMediaUrl(key, { locals })` helper in `src/components/media.ts`.
  Replaces hardcoded `/_emdash/api/media/file/...` URLs everywhere on the
  frontend; routes through EmDash's storage adapter
  (`Astro.locals.emdash.getPublicMediaUrl`) so layouts work under
  `local()`, `s3()`, R2, etc. Background and video storage-key references
  in `styleUtils.ts` accept an optional `resolveMediaUrl` callback so CSS
  generation stays synchronous; Astro components build the closure from
  `Astro.locals` once and thread it through. Re-exported from
  `empixel-builder/components` for use by admin and external consumers.
  Legacy `/_emdash/api/media/file/<key>` URL retained as the fallback
  inside `media.ts` for hosts that haven't wired the public URL builder
  yet.

## 0.7.1 — 2026-05-09

- Bump peer deps: `emdash >=0.9.0`, `better-sqlite3 >=12.0.0`. `better-sqlite3` 12
  ships native bindings built against Node 20, so the plugin now requires
  Node 20+ as well — noted in the README.
- Rename capability `read:content` → `content:read`. Both names alias in
  EmDash today, but the marketplace publish pipeline requires the new form.
- Stop swallowing exceptions silently in plugin routes; log via
  `ctx.log.warn` (or `console.warn` at module load). Set `EMPIXEL_DEBUG=1` to
  escalate to error level for local debugging.
- Emit a minimal plugin-scoped reset (`box-sizing: border-box; margin: 0`)
  once per rendered layout. Defends builder blocks from theme `* { ... }`
  resets that bleed onto plugin elements (`<figure>`, `<button>`, `<a>`,
  etc.). Skipped when the layout has zero sections.
- Single shared SQLite connection across the plugin runtime and the frontend
  reader (`getDb()` in `src/dbShared.ts`). Previously `plugin.ts` and
  `components/db.ts` each opened their own `new Database(...)` against the
  same file. New option `empixelBuilder({ databasePath })` controls the
  path; defaults to `<process.cwd()>/data.db`.

## 0.7.0 — 2026-05-08

### Breaking

- **Removed `testimonials`, `faq`, `pricing` block types.** Their preview
  components, Astro components, BlockDef entries, type interfaces, and
  RightPanel branches are gone. Layouts that still reference these types
  load fine but render nothing (frontend) and show "Unknown block"
  placeholders (canvas). On load, the new `stripUnknownBlocks` helper
  silently drops the orphans from the in-memory tree; saving a layout
  removes them from storage.

### Security

- **Fix SQL injection via `collection` parameter.** Added
  `isValidCollection` validator on every plugin route that interpolates the
  collection name into a SQL identifier (`ec_${collection}`). `db.ts`
  (frontend reader) gained the same regex check.

### Added

- `stripUnknownBlocks(sections)` and `isKnownBlockType(type)` in
  `src/types.ts` — used at every load path.
- **Undo / redo.** New `historyReducer` meta-reducer wraps the existing
  reducer with `past` / `future` snapshots. New `UNDO` / `REDO` actions
  plus `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` (or `Cmd+Y`) keyboard shortcuts.
  Skipped while editable inputs have focus so browser-native text-input
  undo keeps working. No topbar buttons — keyboard shortcuts only.
- **Light + dark variants render simultaneously.** `getEffectiveStyle`
  no longer merges based on `config.theme`. `buildBlockCss` now emits TWO
  rules: the light variant on `[data-epx-block="<id>"]` and (when
  `styleDark` has any property) the dark variant on the compound selector
  `[data-theme="dark"] [data-epx-block="<id>"], [data-epx-block="<id>"][data-theme="dark"]`.
  Pattern: host site sets `data-theme="dark"` on `<html>` (or `<body>`)
  when its theme switch flips → all blocks cascade to their dark variant
  without re-rendering. The canvas mirrors the same model by setting
  `data-theme={config.theme}` on each block's `data-epx-block` element so
  the ThemeStyleToggle preview shows the right variant.
- **Root-allowed block predicate.** New `isRootAllowedType(type)` and
  `ROOT_ALLOWED_TYPES` in `src/types.ts`. Container is always root-allowed;
  `html` and `divider-spacer` are also acceptable at canvas root. All
  other leaves must be inside a container. Replaces the previous
  `isContainerType` gate at the canvas drop sites.
- **RightPanel placeholder for unknown blocks.** Blocks whose `type`
  doesn't resolve to a `BlockDef` (corrupt JSON, removed types) now show
  a small panel with the type name + CSS ID / classes inputs instead of
  a silently empty (gray) right column.
- **`BlockErrorBoundary`** — per-block React error boundary inside Canvas.
  A crash in any one preview no longer kills the whole builder.
- **Vitest test suite** with 72 tests covering `treeUtils`,
  `builderReducer` + `historyReducer`, `styleUtils`, `stripUnknownBlocks`.
- `tsconfig.check.json` + `npm run typecheck` script wired into
  `prepublishOnly`. Catches drift in the frontend `src/components/` tree
  that the published-only `tsc` config skips.
- **`buildBlockChromeCss`** helper in `styleUtils.ts` consolidating the
  per-block CSS bundle (block + hover + breakpoint + breakpoint-hover +
  custom). Every leaf component uses it now.
- **`BaseBlockConfig` + `ContainerConfig` + `TypedSectionBlock` discriminated
  union** in `src/types.ts`. Additive — existing `SectionBlock` shape
  unchanged. Use `asTyped(block)` to opt into narrowing.
- **`useResizeHandle`, `useBlockClipboard`, `useBuilderPersistence`,
  `useDragHandlers`** hooks under `src/admin/builder/hooks/` — extract
  panel resize, copy/paste clipboard, layout load+save+beforeunload, and
  drag handlers from `Builder.tsx`.
- **`right-panel/icons.tsx` + `right-panel/types.ts`** — RightPanel SVG
  icons and `AdvancedConfig` type extracted to siblings.
- **`controls/colorUtils.ts`** — `hexToRgba`, `hexToRgbVals`, `GradientStop`
  extracted from `BackgroundControl.tsx` so other admin modules don't
  cross-import a 950-LOC file.

### Changed

- **Canvas styling unified** — `Canvas.tsx` no longer computes inline
  `style` for visual props; everything goes through `styleUtils.ts` via a
  single global `<style id="epx-canvas-block-css">`. Per-breakpoint
  preview faked by synthetically merging `styleBreakpoints[bp]` /
  `styleHoverBreakpoints[bp]` before the helper call. Canvas dropped from
  818 → 588 LOC.
- **`BlockRenderer.astro` single dispatch** — every leaf block component
  is self-contained (semantic root + chrome attrs + injected CSS). The
  previous LEAF_COMPONENTS + bespoke wrapper path is gone.
- **`BuilderStyles.tsx` returns `null` and imports `./styles/builder.css`**.
  CSS lives as a real stylesheet now, copied to `dist/` by the build script.
  Theme variables further split into `vars.css`. `epxVars` template-string
  interpolation removed.
- **`FieldRenderer` map dispatch** — replaced the if-chain with a
  `Record<FieldType, FC>` map. TypeScript exhaustiveness checks every
  field type has a renderer.
- **`Builder.tsx` 729 → 481 LOC** after extracting four hooks + the drag
  handler factory.
- **`useMemo` on Canvas's `collectAllBlockCss`** — identity-stable string,
  the `<style>` injection effect skips DOM writes when nothing changed.

### Fixed

- **Slot recursion bug in tree utilities.** `removeFromTree`,
  `updateBlockInTree`, `insertAtPath`, `reorderInContainer`, and
  `addToContainer` previously skipped `block.slots` whenever `block.children`
  was a truthy empty array. They now walk both independently. Found by the
  new test suite.
- **Container background not visible in canvas.** `BuilderStyles.tsx` had a
  `.epx-container-block { background: transparent }` rule that beat the
  attribute-selector rule on equal specificity; removed.
- **`deepCloneBlock` shared the `config` object reference.** Now uses
  `structuredClone` (with a JSON round-trip fallback) so mutating a clone
  no longer corrupts the original.

### Removed

- Stale 0-byte `data.db` from the plugin root. The runtime always uses
  `process.cwd()/data.db` (the host site's DB), not the plugin's.
- **Accent theme support.** `Theme` is now `"light" | "dark"` only. The
  `styleAccent` / `styleHoverAccent` keys are gone from `BaseBlockConfig`
  and `getEffectiveStyle` no longer special-cases accent. Old layouts that
  carry `styleAccent` data ignore it silently — the editor never exposed an
  accent button via `ThemeStyleToggle`, so any accent data came from
  pre-0.7 hand-edits and was never rendered anyway.

## 0.6.0

Initial public version. See `.claude/prd.md` for the v0.6 baseline.
