# Agent B — Frontend Astro

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: render path (Astro components), CSS generation, theme selector, reset CSS, media URL resolver, cache hint, frontend `db.ts` reader.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentB-<task-id>` (e.g. `feature/agentB-F1.2`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentB-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR — especially `prd-frontend.md` and `prd-breakpoints.md` for any `styleUtils.ts` change.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-09 23:55 · F4.10 started

- Branch: `feature/agentB-F4.10` off worktree at latest main (76e0495 — F4.1 + F4.2 + F4.3 in).
- Goal: image blocks emit responsive `<picture>`/`<img srcset>` so the browser downloads the smallest appropriate image. Lighthouse target > 95 for image-heavy pages on hosts with format-conversion (S3 + image resizing, R2 + Cloudflare Image Resizing, etc.).
- **Investigation of EmDash's `<Image>`** (read `node_modules/emdash/src/components/EmDashImage.astro` + `Image.astro` + `media/url.ts` + storage `local.ts` / `s3.ts`):
  - `EmDashImage` (= `Image` from `emdash/ui`) takes `MediaValue` (`{ id, src?, meta?, width?, height?, alt?, provider? }`). Plugin layout JSON persists `ImageMediaRef` (`{ id, storageKey, alt?, filename? }`) — different shape, no `src`/`meta`/`width`/`height`. Adapting requires a normalization pass on every block at render time, plus a width/height lookup that's not in the persisted ref. Out of scope for F4.10 — same conclusion F2.2 reached.
  - **More importantly**: `EmDashImage` only emits responsive `srcset` when the active media provider exposes `ImageEmbed.getSrc({ width, height, format })`. The local storage adapter (`local.getPublicUrl`) returns `${baseUrl}/${key}` — no transform. The S3 adapter (`s3.getPublicUrl`) returns `${publicUrl}/${key}` — no transform unless an upstream CDN intercepts. So `EmDashImage` itself emits a plain `<img>` for the local + plain-S3 majority of hosts. Routing through it would add the normalization plumbing for zero responsive benefit on those hosts.
- **Decision: Path 2 (hand-rolled `<picture>`).** Cleanest plugin-side path. KISS:
  1. Add `resolveResponsiveSrcSet(key, opts)` to `media.ts`. Returns either `{ srcSet: { avif?, webp?, fallback }, sizes }` when the host's resolver supports format hints — detected by introspecting the URL shape `getPublicMediaUrl(key)` returns — or `null` otherwise. EmDash core's `getPublicMediaUrl` returns flat URLs today, so the helper returns `null` for the local + plain-S3 case → plain `<img>` falls through (no regression).
  2. Detection mechanism: hosts that wire format-conversion expose it via a custom hook on `Astro.locals.emdash` shape (or a query-param contract — keep it forward-compatible). For F4.10 we ship the helper + a feature flag the host can opt into via `getPublicMediaUrl` returning a URL with a `?format=` placeholder we can substitute, OR the plugin user passing a `transform` query convention. Simplest: emit a `<picture>` whose `<source>` URLs are derived by appending `?format=webp&w=N` / `?format=avif&w=N` to the resolved URL when an opt-in marker is present, with the `<img>` fallback always the original-format URL. CDN that intercepts those query params (Cloudflare Image Resizing, Vercel Image Optimization, Netlify Image CDN, custom S3-Fronted-by-CF) does the work; CDNs that don't ignore the query string (default S3) fall through to the same image so the page still renders correctly.
  3. **Default size set**: `[480, 800, 1200, 1920]`. **Default `sizes`**: `(max-width: 768px) 100vw, 50vw`. **Format set**: AVIF first, WebP next, original (JPEG/PNG) as `<img src>` fallback.
  4. `Image.astro` chooses `<picture>` when `resolveResponsiveSrcSet` returns a non-null result; plain `<img>` otherwise. Existing chrome (`data-epx-block`, `id`, classes, link wrap, caption, alt, `loading=lazy`, `decoding=async`, `style=imgInline`) is preserved verbatim. The `<picture>` wraps an existing `<img>` (no behavioral change for browsers without `<picture>` support).
  5. Default off (returns `null`) for the local-runtime fallback URL (`/_emdash/api/media/file/...`) — that route doesn't speak transforms either.
- Tests:
  1. `media.test.ts` — extend with a `describe("resolveResponsiveSrcSet")` block: null when key falsy, null when no resolver, null on local-runtime fallback URL (preserve no-regression promise), populated `{ srcSet, sizes }` when adapter URL contains an opt-in marker (using a stub adapter that emits `${baseUrl}/${key}?epx=1`).
  2. `Image.astro` doesn't have a unit test today (it's an `.astro` SFC — vitest can't render it without astro/server). Instead, structure the helper so the actual srcset string-building is unit-testable via `buildResponsiveSrcSet(baseUrl, widths, format)`. Test the assembled markup intent at the helper level — assert the URL set and `sizes` string match the spec.
- Files:
  - Edit: `src/components/Image.astro` — pick `<picture>` over `<img>` when responsive markup is available; preserve all existing chrome.
  - Edit: `src/components/media.ts` — add `resolveResponsiveSrcSet`, `buildResponsiveSrcSet`, and the constants `RESPONSIVE_DEFAULT_WIDTHS` / `RESPONSIVE_DEFAULT_SIZES`. Re-export from `index.ts`.
  - Edit: `tests/media.test.ts` — extend with the new describe block.
  - Edit: `CHANGELOG.md` — append F4.10 bullet under the existing `## Unreleased — 1.0.0 prep` section.
  - Edit: `.claude/prd-frontend.md` — document the responsive image flow + size/format defaults + fallback path.
- Coordination: Concurrent C on F4.7 (BackgroundControl split, admin only, branch `feature/agentC-F4.7`) is disjoint — admin path, my work is frontend. No conflicts. The `## Unreleased — 1.0.0 prep` section in CHANGELOG is shared; I append.

## 2026-05-09 23:50 · F4.1 started

- Branch: `feature/agentB-F4.1` off latest main (0d767dd, v0.9.6).
- Goal: collect every per-block CSS string and emit a single `<style is:global>` per page from `LayoutRenderer.astro`. New helper `coalesceLayoutCss(strings)` in `styleUtils.ts` groups identical `@media` queries so each breakpoint opens exactly one `@media` block instead of one per block × per bp. 30-block page goes from 30+ `<style>` tags to 1.
- Plan / mechanism:
  1. Use a shared `Astro.locals.empixelLayoutCss` string-array as the collection mechanism. `LayoutRenderer.astro` initializes it (assigns a fresh `[]`) at the top of its frontmatter, BEFORE rendering any children. Each block component (`Text.astro` / `Image.astro` / etc.) pushes its CSS string into the array in its frontmatter instead of emitting an inline `<style>`. `SectionContainer.astro` pushes its main CSS bundle plus the optional video-controls override. After the `{sections.map(...)}` expression returns, `LayoutRenderer` renders a single `<style is:global>` whose body is `coalesceLayoutCss(Astro.locals.empixelLayoutCss).
  2. Astro semantics: the children's frontmatter runs synchronously as the parent template's `{sections.map(...)}` expression evaluates. Subsequent `<style>` JSX expressions in the parent template are evaluated AFTER all map children have finished — so the array is fully populated before the parent emits the bundle.
  3. `coalesceLayoutCss(strings)`: parse each CSS string for `@media (...)` blocks, group rule bodies by query string, emit (a) all base (non-`@media`) rules first, then (b) one `@media (query) { merged-body }` per unique query. Plugin-emitted CSS is predictable — no nested at-rules other than `@media` — so a single regex split is sufficient.
  4. Reset CSS — F1.3 already emits the reset inline in the layout. Move the reset string into the same coalesced bundle (prepended) so we end up with exactly ONE `<style>` per page rather than reset + bundle. KISS.
  5. Don't break: customCss (already wrapped to `[data-epx-block]`), `:hover` / dark selectors (preserved as base rules), per-bp CSS (coalesced under one `@media (max-width: <px>)` per breakpoint).
- Tests: extend `tests/styleUtils.test.ts` with a `describe("coalesceLayoutCss (F4.1)")` block — base-only, two blocks with same `@media`, two blocks with different `@media`, mixed base + media, idempotency on empty input, preserve declaration order across grouped media. Plus a "5-block page emits exactly 1 style tag" assertion (counts `<style` occurrences in a synthetic LayoutRenderer trace string).
- Coordination: A is on F4.2 (cache LRU on `styleUtils.ts`'s `buildBlockCss` / `buildBlockChromeCss` etc.) — F4.2 wraps the existing helpers in a memoize layer; my new `coalesceLayoutCss` is a separate addition that doesn't conflict. C is on F4.3 (admin code-split) — disjoint path. CHANGELOG `## Unreleased — 1.0.0 prep` may be opened by parallel agent first; if so I append, if not I open.

## 2026-05-09 23:10 · F3.6.4 (frontend) started

- Branch: `feature/agentB-F3.6.4-fallback` off latest main (d777a5c).
- Goal: drop SectionContainer's legacy `spacingMap` + `resolveSpacing` so symbolic spacing values (`none/sm/md/lg/xl`) no longer leak into the render template. Pair with Agent A's parallel `runMigrationLegacySpacingV1` (data migration on a separate branch).
- **Decision: approach (a) inline-resolve**, NOT drop entirely. Rationale:
  1. There's a brief window between an EmDash host upgrading the plugin and Agent A's lazy-gate migration actually firing on first request (the runMigrationToStorageV1 pattern is one-shot, lazy, KV-flagged). During that window, rows with `paddingTop: "md"` would render with literal `"md"` as the CSS value (browser ignores → padding 0). That's a visible, silent regression.
  2. Inline-resolve plumbing is small: one helper `normalizeLegacySpacing(value)` in `styleUtils.ts`, applied to padding/margin keys inside `buildStyleBodyFromObject` (the single chokepoint that emits `STYLE_PROPS`). Same fix lands per-breakpoint via `BP_VISUAL_PROPS` (no padding/margin in there today, so no extra plumbing needed).
  3. `cssStr()` is the natural place to fold in legacy normalization for spacing keys — the helper already strips the `@@` custom-CSS marker, so adding a `keyHint?: string` arg to optionally normalize via the legacy map keeps the call site clean. KISS: one branch on the prop name set, no new path through the codebase.
  4. The resolver is keyed by prop name (so `paddingTop`, `paddingRight`, `marginBottom`, etc. trigger normalization, but `width`, `borderTopWidth`, etc. don't). This matches the original `resolveSpacing` behavior — the old fallback was scoped to padding only, never touching border/margin.
  5. Single source of truth: any future caller of `buildBlockCss` / `buildBlockChromeCss` / `buildBlockStyle` (admin Canvas in F3.6.3, host pages, tests) gets normalized values automatically. No need to re-implement the fallback in three places.
- Plan:
  1. Add `LEGACY_SPACING_MAP = { none:"0", sm:"32px", md:"48px", lg:"64px", xl:"96px" }` to `styleUtils.ts` (verified against the actual `SectionContainer.astro:24` spacingMap — task brief had different values; the source is canonical).
  2. Add `normalizeLegacySpacing(value)` helper. Returns the input unchanged unless it matches a legacy key.
  3. Define `LEGACY_SPACING_PROP_SET` = padding{Top,Right,Bottom,Left} + margin{Top,Right,Bottom,Left}.
  4. In `buildStyleBodyFromObject`'s `STYLE_PROPS` loop, normalize `style[prop]` through `normalizeLegacySpacing` when the prop is in the spacing set. No change to the camelCase→kebab transform.
  5. Same normalization applied in `buildBreakpointCss`'s `BP_VISUAL_PROPS` loop — even though BP_VISUAL_PROPS doesn't currently include padding/margin, gate the helper on the spacing prop set so future additions are automatically covered.
  6. Remove `spacingMap` + `resolveSpacing` from `SectionContainer.astro`. The component now spreads `style.paddingTop` etc. straight into the chrome builder via the existing `buildBlockStyle(value, opts)` call. The post-hoc `paddingCss` / `styleWithoutPadding` regex dance goes away — that whole fallback block was the legacy spacingMap's plumbing.
  7. Tests: add a fixture in `tests/styleUtils.test.ts` with `style: { paddingTop: "md", marginRight: "sm" }` and assert `padding-top:48px` + `margin-right:32px` end up in the emitted CSS. Add a test demonstrating that non-spacing keys are NOT touched (`width: "md"` stays `width:md` — only padding/margin gets the legacy map). Add a test confirming concrete values pass through unchanged (`paddingTop: "12px"` → `padding-top:12px`).

## 2026-05-09 10:05 · F1.2 started

## 2026-05-09 11:30 · F1.3 started

## 2026-05-09 12:30 · F2.2 started

## 2026-05-09 14:30 · F3.4 started

- Goal: rewrite `getBuilderLayout` to take `Astro` (or any `{ locals: { emdash?: ... } }`) as the first arg and route through EmDash's storage abstraction. Keep a read-only legacy fallback to `empixel_builder_layouts` SQLite table for one version while F3.3 migrates rows; F3.5 drops better-sqlite3 entirely.
- Plan: define a small `BuilderLayoutContext` interface (subset of Astro). Storage path uses `Astro.locals.emdash.db` (Kysely) to query `_plugin_storage` for `(plugin_id="empixel-builder", collection="layouts", data->collection, data->entryId)` — `PluginStorageRepository` isn't publicly exported from `emdash`, so the frontend reader queries the underlying table directly using the same shape. Legacy fallback dispatches to `getDb()` from `dbShared.ts`. Function becomes async; `BuilderWrapper.astro` awaits. Re-export `getBuilderLayout`, `BuilderLayoutResult`, `builderLayoutCacheTag` from `src/components/index.ts` (the F2.4 deep-import debt called out in `interfaces.md`). Keep the symbol name `getBuilderLayout` rather than introducing a new `getBuilderLayoutFromContext` — KISS, the signature change is the API break already.

- Goal: storage-agnostic media URL resolution. Stop hardcoding `/_emdash/api/media/file/${storageKey}` everywhere on the frontend. Route through `Astro.locals.emdash.getPublicMediaUrl(storageKey)` when available; legacy fallback when absent.
- Plan: new `src/components/media.ts` with sync `resolveMediaUrl(key, opts?)`. Use it in every Astro component (Image, Icon, Button, DividerSpacer, Video, SectionContainer, PortableTextImage). For `styleUtils.ts` (sync, called from many sites and must stay sync), thread the resolver through an opts bag — caller passes `Astro.locals` once and the helpers resolve any embedded `backgroundImageStorageKey` / `backgroundSlides[*].storageKey` / `backgroundVideoMediaStorageKey` upfront.

## In progress

*(empty)*

## 2026-05-09 18:30 · fix/F3.4-frontend-empty started

- Branch: `fix/F3.4-frontend-empty` off latest main (b091819).
- Goal: P0 hotfix — `getBuilderLayout` returns empty on host pages even though `_plugin_storage` has properly-shaped rows; frontend renders the host theme's static template instead of builder content.
- **Root cause** identified by reading `node_modules/emdash/dist/astro/middleware.mjs`:
  - On **anonymous frontend page renders** (no session cookie), the EmDash middleware sets `locals.emdash = { collectPageMetadata, collectPageFragments, getPublicMediaUrl }` — note: **no `db` field**. The `db` accessor is only attached on the authenticated/admin branch (line 2037).
  - F3.4's reader gates the entire storage read on `astro.locals.emdash.db` being a Kysely instance (`isMinimalKysely(handle)`), so on every public page view it short-circuits to `{ sections: null, cacheHint }`.
  - Result: the `BuilderWrapper.astro` falls through to `<slot />` (the host's static template), which is exactly the symptom on Novapera.
- **Secondary issue** in the same path: even when `db` was present (admin previews), `readFromStorage()` filtered only on `(plugin_id, collection)` and called `executeTakeFirst()` — that returns the first arbitrary plugin row, not necessarily the entry the page is asking for. The data check `parsed.collection !== collection || parsed.entryId !== entryId` then forced null. With 4 valid rows + 2 orphan rows on Novapera, the orphan path was likely hit first. The deterministic doc-id (`${collection}::${entryId}`, F3.2's `layoutDocId`) is the right key — single-row lookup, no orphan collision.
- **Fix plan**:
  1. Resolve a Kysely handle: try `Astro.locals.emdash.db` first; on miss (anonymous request), fall back to `await getDb()` from `emdash/runtime` — that's the singleton `Kysely<Database>` EmDash uses internally for everything else, exposed via the public `emdash/runtime` package export. This is the same handle the admin path gets, just resolved through the runtime accessor instead of the locals shortcut.
  2. Replace the `executeTakeFirst()` + post-filter dance with a deterministic `where("id", "=", layoutDocId(collection, entryId))` lookup. Drop `findStorageRow` (the multi-row scan was never needed once we filter on the doc id).
  3. Keep the same `BuilderLayoutResult` / `BuilderLayoutContext` public shape — no API break.
- Coordination: Agent A is fixing the related backend bug on a parallel branch (`/entries`). Doc-id format `<collection>::<entryId>` is canonical (per `src/plugin.ts:80` `layoutDocId`); A and B's fixes converge on this key. No `interfaces.md` change needed.

## Done

## 2026-05-10 00:05 · F4.10 done

- Path chosen: **2 (hand-rolled `<picture>`)**. EmDash's `<Image>` component (= `EmDashImage` from `emdash/ui`) only emits responsive `srcset` when the active media provider exposes `ImageEmbed.getSrc({ width, height, format })`. The local + plain-S3 storage adapters don't (verified by reading `node_modules/emdash/src/storage/local.ts` and `s3.ts` — both return flat `${baseUrl}/${key}` URLs with no transform layer). So routing through it would have added a `MediaValue ← ImageMediaRef` normalization pass plus a width/height lookup that's not in the persisted ref, all for zero responsive benefit on the majority of hosts. Path 2 ships responsive markup the moment a host wires a format-aware CDN — no EmDash-side cooperation required.
- New helpers (in `src/components/media.ts`):
  - `RESPONSIVE_DEFAULT_WIDTHS = [480, 800, 1200, 1920]`. Phone (480) → 4K (1920 ≈ 2x typical desktop). Four breakpoints — enough granularity for the browser's source selection without flooding `srcset` with ten entries.
  - `RESPONSIVE_DEFAULT_SIZES = "(max-width: 768px) 100vw, 50vw"`. Image fills the viewport on phone, half-width on desktop. Standard heuristic; future blocks can override.
  - `appendImageTransformParams(baseUrl, format, w)` — internal URL builder. Appends `?format=<fmt>&w=<n>` (or `&format=…` if URL already has a query). Handles undefined format (emits `?w=<n>` only — used for the original-format `<img srcset>` fallback).
  - `buildResponsiveSrcSet(baseUrl, widths, format?)` — pure string builder. Emits comma-joined `<url> <w>w` entries.
  - `isLegacyLocalRuntimeUrl(url)` — detects the `/_emdash/api/media/file/...` route. Used for opt-out (that route doesn't honor `?format=` / `?w=`).
  - `resolveResponsiveSrcSet(key, opts)` — feature-detected wrapper. Returns `{ avif, webp, fallback, src, sizes, widths }` or `null`. `null` triggers the plain-`<img>` degradation path in `Image.astro`. Triggers when: key is falsy / no adapter / adapter returns undefined / adapter resolves to legacy local-runtime URL.
- `Image.astro` updates:
  - Imports `resolveResponsiveSrcSet` alongside `resolveMediaUrl`.
  - Computes `responsive = resolveResponsiveSrcSet(image?.storageKey, { locals: Astro.locals })` once at the top of the frontmatter.
  - When `responsive` is non-null, emits `<picture>` with `<source type="image/avif" srcset=… sizes=…>`, `<source type="image/webp" srcset=… sizes=…>`, and the existing `<img>` (now with `srcset` + `sizes` for the original-format fallback). When null, emits the same plain `<img>` it shipped pre-F4.10 — byte-identical markup for hosts on local-runtime / no-adapter setups.
  - Branches in BOTH the link-wrapped path (`caption && linkHref`) and the unwrapped path. Preserves all existing chrome (`data-epx-block`, `id`, classes, alt, width/height attrs, inline `style`, `loading=lazy`, `decoding=async`, link wrap target/rel/customAttrs).
- Files changed:
  - `src/components/media.ts` — added helpers + constants + types.
  - `src/components/Image.astro` — `<picture>` markup.
  - `src/components/index.ts` — re-exports `buildResponsiveSrcSet`, `resolveResponsiveSrcSet`, `RESPONSIVE_DEFAULT_WIDTHS`, `RESPONSIVE_DEFAULT_SIZES`, type `ResponsiveImageFormat`, `ResponsiveSrcSet`, `ResolveResponsiveSrcSetOptions`.
  - `tests/media.test.ts` — added 15 cases across 4 new describe blocks.
  - `CHANGELOG.md` — appended F4.10 bullet under `## Unreleased — 1.0.0 prep` (above the F4.2 bullet — chronological order, F4.10 ships after F4.1+F4.2 merged).
  - `.claude/prd-frontend.md` — new "Responsive image pipeline (F4.10)" section, updated "Image Fields" reference to `<Image>` from emdash/ui to point at the new section's path-1-rejection rationale, marked TODO `[x]`.
  - `.claude/coordination/status/agent-b.md` — start + done entries.
- Tests added (`tests/media.test.ts`):
  - `appendImageTransformParams (F4.10)` — 3 cases: no-existing-query, with-existing-query, undefined-format.
  - `buildResponsiveSrcSet (F4.10)` — 3 cases: comma-joined output, query-string preservation, undefined-format.
  - `isLegacyLocalRuntimeUrl (F4.10)` — 2 cases: matches legacy path, doesn't match adapter URLs.
  - `resolveResponsiveSrcSet (F4.10)` — 7 cases: null on falsy key, null on no adapter, null on legacy fallback URL (the F2.2 no-regression promise — verified explicitly), null on undefined adapter return, full result with adapter-resolved URL, query-string preservation, caller-supplied widths/sizes overrides.
  - Total: 350 → 365 (+15).
- Coordination: no `interfaces.md` change. The new exports (`resolveResponsiveSrcSet`, `buildResponsiveSrcSet`, etc.) are public API surface for `empixel-builder/components` but they're plugin-internal helpers — admin previews and tests can import them, but no other agent owns code that needs to consume them. Agent C's F4.7 (BackgroundControl split) is disjoint — admin path, my work is frontend. CHANGELOG `## Unreleased — 1.0.0 prep` was already opened by F4.1 — I appended above the existing F4.2 bullet.
- Pipeline: lint + typecheck + 365/365 tests + build all green on first try.
- Anything surprising: nothing major. The legacy local-runtime opt-out (`isLegacyLocalRuntimeUrl`) was important to add explicitly — without it, a host running on the local-runtime fallback would ship `<picture>` with `<source>` URLs like `/_emdash/api/media/file/img.png?format=avif&w=480` that 404 on every breakpoint, forcing the browser into the `<img src>` fallback for every load. By explicitly opting out, hosts on local-runtime see the same plain `<img>` they did pre-F4.10. F2.2 no-regression promise preserved.

## 2026-05-09 23:55 · F4.1 done

- Mechanism shipped: `Astro.locals.empixelLayoutCss = []` shared string-array. `LayoutRenderer.astro` initialises it (and pushes the F1.3 reset CSS as the first entry); each block component (`Text.astro` / `Image.astro` / `Button.astro` / `Icon.astro` / `Video.astro` / `Html.astro` / `DividerSpacer.astro` / `TextEditor.astro` / `SectionContainer.astro`) pushes its computed CSS string in its frontmatter; LayoutRenderer drains via `coalesceLayoutCss` and emits exactly ONE `<style is:global>` per page after the iteration. Astro creates a fresh `Astro.locals` per request so the array is naturally request-scoped — no cleanup needed.
- New helper `coalesceLayoutCss(strings: ReadonlyArray<string>): string` in `src/components/styleUtils.ts`. Walks the concatenated buffer at top-level brace depth (so `:hover` braces inside `@media` bodies don't confuse the boundary detector), splits into bare rules + `@media (...) { … }` blocks, buckets `@media` blocks by trimmed query string. Output is base rules first (input order) then one `@media${query}{merged-body}` per unique query in first-seen order. Whitespace-tolerant (`@media(max-width:992px)` and `@media (max-width: 992px) ` group together). Plugin emits flat rules with at most one level of `@media` nesting (no `@supports` / `@layer` / `@container`), so a regex-driven scan is sufficient — no full CSS parser. KISS.
- Performance: 5-block page emits exactly 1 `<style>` (was 5+); 30-block page emits 1 (was 30+). Each unique breakpoint opens exactly one `@media` block instead of one per block × per bp.
- Files changed:
  - `src/components/styleUtils.ts` — added `coalesceLayoutCss` plus comment block (algorithm + plugin-emitted-CSS predictability rationale).
  - `src/components/LayoutRenderer.astro` — initialise array; push reset CSS as first entry; render single `<style is:global>` from coalesced bundle after the iteration. F1.3 reset moved into the bundle (was its own `<style>` tag) so total emit is one tag, not two.
  - `src/components/Text.astro`, `Image.astro`, `Button.astro`, `Icon.astro`, `Video.astro`, `Html.astro`, `DividerSpacer.astro`, `TextEditor.astro`, `SectionContainer.astro` — each pushes its full CSS bundle into `Astro.locals.empixelLayoutCss` instead of emitting `<style is:global>` at template position. SectionContainer additionally folds its HTML5-video controls override (was a SECOND `<style>` tag pre-F4.1) into the same push.
  - `tests/styleUtils.test.ts` — added `import { coalesceLayoutCss }` and a `describe("coalesceLayoutCss (F4.1)")` block: 10 cases covering empty input, fast path (no @media), same-query merge, different-query separation, base-before-media ordering, three-block × two-query merge, nested-brace tolerance for `:hover` rules inside `@media`, whitespace-tolerant query grouping, dark `:is(...)` selector preservation, end-to-end "5-block page emits exactly 1 `<style>` tag" assertion.
- PRDs updated:
  - `prd-frontend.md` — new "CSS coalescing — single `<style>` per page (F4.1)" section under LayoutRenderer documenting the collection mechanism, Astro semantics, and the `coalesceLayoutCss` algorithm. F1.3 reset section reworded to clarify it's now folded into the F4.1 bundle (not a separate tag). Block Component Pattern code example updated to show the push pattern. Style Utilities table got a `coalesceLayoutCss` row. Rules section updated to say block components no longer emit their own `<style>`.
  - `prd-breakpoints.md` — Frontend Rendering paragraph updated: per-bp CSS strings now flow through the F4.1 collection mechanism, and identical `@media (max-width: <px>)` queries from different blocks merge into one wrapper (cross-references the new `prd-frontend.md` section).
- CHANGELOG: opened `## Unreleased — 1.0.0 prep` section with a single F4.1 bullet (parallel agents A on F4.2 / C on F4.3 will append below mine — chronological order).
- Coordination: no `interfaces.md` change. `coalesceLayoutCss` is exported but a plugin-internal helper (LayoutRenderer is the only caller) — not a cross-agent contract. The Astro.locals key `empixelLayoutCss` is plugin-scoped + frontmatter-only — host code never touches it. Concurrent A on F4.2 (memoize layer over the existing chrome helpers) is orthogonal — F4.2's wrapping doesn't change the strings the helpers return, just adds a cache; coalescing operates on those strings unchanged. Concurrent C on F4.3 (admin code-split) doesn't touch any frontend file.
- Tests: 316 → 326 (+10 net).
- Pipeline: lint + typecheck + 326/326 tests + build all green on first try after the one `prefer-const` lint fix.
- Anything surprising: nothing. Astro's lazy frontmatter execution and the `Astro.locals` per-request lifecycle map cleanly onto the collect-then-emit pattern — no need for slot tricks or render-string capture. The brace-depth walker is simple because plugin-emitted CSS never nests at-rules beyond `@media`.

## 2026-05-09 23:35 · F3.6.4 (frontend) done

- Approach (a) inline-resolve. Implementation:
  - `styleUtils.ts` — added `LEGACY_SPACING_MAP` (`none:"0"`, `sm:"32px"`, `md:"48px"`, `lg:"64px"`, `xl:"96px"` — verified against the pre-F3.6.4 spacingMap in `SectionContainer.astro:24`), `LEGACY_SPACING_PROP_SET` (8 padding+margin keys), public export `normalizeLegacySpacing(value)`, internal `spacingCssStr(v)`. `buildStyleBodyFromObject`'s STYLE_PROPS loop now branches on the prop set: spacing keys go through `spacingCssStr` (`cssStr` + legacy normalisation), everything else stays on the unchanged `cssStr` path. Same gate added to `buildBreakpointCss`'s BP_VISUAL_PROPS loop as a forward-compat measure (BP_VISUAL_PROPS doesn't currently include padding/margin, so today the branch is a no-op — but if a future change moves spacing into per-breakpoint visuals the fallback travels with it).
  - `SectionContainer.astro` — removed the local `spacingMap` table, `resolveSpacing` helper, the `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` resolution block, the `paddingCss` / `styleWithoutPadding` regex post-hoc dance. Frontmatter now just calls `buildBlockStyle(value, { resolveMediaUrl: resolver })` once and assigns the result to `inlineStyle`. Net delta: -29 lines / +6 lines (a comment block explaining where the fallback moved to). Single source of truth for spacing CSS lives in `styleUtils.ts`.
- Tests added (`tests/styleUtils.test.ts`):
  - `normalizeLegacySpacing (F3.6.4)` describe — 3 cases: exact-map for all five legacy keys, pass-through for concrete CSS values (`12px`, `1.5rem`, `0`, ``, `clamp(...)`), no false-positive on near-matches (`medium`, `xlarge`).
  - `buildBlockCss — F3.6.4 legacy spacing inline-resolve` describe — 4 cases: symbolic padding (all 4 sides, all 4 legacy values), symbolic margin (all 4 sides + `none`), concrete values pass through, scoping check (only padding+margin keys are normalised — `width:md` / `borderTopWidth:sm` stay literal while `paddingTop:md` becomes `48px`).
  - `buildBreakpointCss — F3.6.4 legacy spacing inline-resolve` describe — 1 forward-compat case (typography keys at the breakpoint level emit unchanged, demonstrating the no-op path).
  - Total: 242 → 250 (+8 net).
- PRDs updated:
  - `prd-frontend.md` — `SectionContainer.astro` bullet rewritten (no more "legacy named-spacing fallback" claim — that lives in `styleUtils.ts` now). New section "Legacy symbolic-spacing inline resolve (F3.6.4)" documents the decision (a) over (b), the migration coordination with Agent A, the mechanism (`LEGACY_SPACING_MAP` / `LEGACY_SPACING_PROP_SET` / `normalizeLegacySpacing` / `spacingCssStr`), and the SectionContainer cleanup.
  - `prd-breakpoints.md` — Frontend Rendering section appended a paragraph linking the per-breakpoint inline-resolve to the desktop path, noting BP_VISUAL_PROPS doesn't currently carry spacing keys (forward-compat gate only).
- CHANGELOG: bullet under `## Unreleased — 0.9.6 prep` (appended ABOVE the F3.6.2 bullet — chronological order).
- Coordination: no `interfaces.md` change. `normalizeLegacySpacing` is exported but not a cross-agent contract — it's an implementation detail inside `styleUtils.ts`. Agent A's data migration (`runMigrationLegacySpacingV1` on a separate branch) and this frontend half are independent commits that converge on the same `LEGACY_SPACING_MAP` values; if A's migration uses different px (the task brief had `8/16/24/32px` for sm/md/lg/xl — but those don't match the actual source `spacingMap`'s `32/48/64/96px`), the orchestrator is on point to reconcile. The `SectionContainer.astro:24` pre-F3.6.4 spacingMap is the canonical source — that's what shipped to users, that's what stored values reflect, that's what the migration must match.
- Pipeline: lint + typecheck + 250/250 tests + build all green on first try.
- Anything surprising: the task brief's claimed legacy values (`sm:"8px"`, `md:"16px"`, `lg:"24px"`, `xl:"32px"`) didn't match the actual code (`sm:"32px"`, `md:"48px"`, `lg:"64px"`, `xl:"96px"`). Used the actual source values per spec footnote ("verify against `SectionContainer.astro`'s actual spacingMap; match exactly"). Flagging here so the orchestrator can sync with Agent A — the migration must use the same px or stored data and rendered output diverge.

## 2026-05-09 18:55 · fix/F3.4-frontend-empty done

- Bug fixed: 5 (P0). Builder-enabled host pages now render builder content from `_plugin_storage` instead of falling back to the host theme's static template.
- Files changed: `src/components/db.ts`, `tests/getBuilderLayout.test.ts`, `CHANGELOG.md`, `.claude/prd-frontend.md`, `.claude/coordination/status/agent-b.md`.
- Two-pronged fix:
  1. **Kysely handle resolution.** New `resolveKyselyHandle(astro)` helper. Tries `Astro.locals.emdash.db` first (admin path). On miss, falls back to `await getDb()` from `emdash/runtime` — the public accessor for the same singleton EmDash uses internally. The EmDash middleware exposes `db` on `locals.emdash` only on authenticated/admin requests; anonymous public page renders (the actual host pages the builder targets) get the short-circuited `{ collectPageMetadata, collectPageFragments, getPublicMediaUrl }` payload. Without the runtime fallback, every public render of a builder-enabled page hit `null` sections.
  2. **Doc-id symmetry.** Replaced the `(plugin_id, collection)` filter + `executeTakeFirst()` + post-fetch JSON guard with a deterministic `where("id", "=", layoutDocId(collection, entryId))` lookup. The doc id `${collection}::${entryId}` is the canonical write key (`src/plugin.ts § layoutDocId`); mirrored locally to keep the frontend bundle clean. Dropped `findStorageRow` (the multi-row scan was a workaround that was no longer needed). Dropped the unused `MinimalSelectBuilder.execute()` cast from earlier.
- Tests:
  - Updated all six existing storage-present cases to use `id: docId(collection, entryId)` (was a single-colon `${collection}:${entryId}`).
  - Two new regression cases under "doc-id symmetry":
    - "finds the correct row when multiple plugin rows coexist (Novapera scenario)" — three rows in the stub: one orphan keyed on the bare ULID, one different `posts::ULID_B` row, the target `posts::ULID_A` row. Pre-fix the reader would land on the orphan first and force null. Post-fix, the doc-id filter selects the right row.
    - "returns null when only orphan rows (id != composite doc id) exist for the entry" — documents the orphan-only short-circuit so a future regression can't silently regress to scanning the JSON payload.
  - Total 200 tests (was 198, +2 net).
- PRD: `.claude/prd-frontend.md` § "Database Query (db.ts) — getBuilderLayout" updated to describe the new handle-resolution order and the doc-id symmetry. Added a paragraph on why the runtime fallback is required (the middleware behavior on anonymous renders).
- CHANGELOG: hotfix bullet under `## Unreleased — 0.9.5 prep`.
- Coordination: no `interfaces.md` change. Doc-id format `<collection>::<entryId>` is canonical, matching `layoutDocId` in `plugin.ts`. Agent A's parallel `/entries` fix converges on this same key.
- Pipeline: lint + typecheck + 200/200 tests + build all green on first try.
- Verified manually that the SQL filter chain is symmetric with what `PluginStorageRepository.get` does (`node_modules/emdash/dist/search-DkN-BqsS.mjs:582`): `selectFrom("_plugin_storage").select("data").where("plugin_id", "=", pluginId).where("collection", "=", collection).where("id", "=", id).executeTakeFirst()` — same shape modulo the column list.

## 2026-05-09 14:55 · F3.4 done

- `getBuilderLayout` rewrite shipped. New signature: `getBuilderLayout(astro, collection, entryId, enabled?) => Promise<BuilderLayoutResult>` — async, takes Astro (or any `BuilderLayoutContext = { locals?: { emdash?: { db?, getPublicMediaUrl? } } }`) as the first arg. Kept the symbol name `getBuilderLayout` (no separate `getBuilderLayoutFromContext`) — KISS, the signature break is the API change.
- Read order: storage path first (Kysely against the shared `_plugin_storage` table partitioned under `plugin_id="empixel-builder", collection="layouts"` — same partitioning EmDash's `PluginStorageRepository` uses internally; `PluginStorageRepository` itself is not exported from `emdash` 0.9, so the frontend reader queries the table directly via the public Kysely surface on `Astro.locals.emdash.db`); on miss, legacy `empixel_builder_layouts` SQLite fallback via `getDb()` from `dbShared.ts`. Fallback dispatches at `src/components/db.ts:275` (`readFromLegacyTable`). F3.5 drops both the fallback and the better-sqlite3 peer.
- `BuilderWrapper.astro` now accepts three shapes on `sections`: resolved `BuilderLayoutResult`, unawaited `Promise<BuilderLayoutResult>` (resolves it itself — keeps host frontmatter terse), and the legacy `SectionBlock[] | null` shape from older `npx empixel-builder add` scaffolds. Auto-plumbs `Astro.cache.set(cacheHint)` for both new shapes; legacy shape keeps the no-op behavior.
- `src/components/index.ts` re-exports `getBuilderLayout`, `BuilderLayoutResult`, `BuilderCacheHint`, `BuilderLayoutContext`, and `builderLayoutCacheTag` — lifts the F2.4 deep-import debt that was deferred while Agent A was locked out of `index.ts`.
- Tests: extended `tests/getBuilderLayout.test.ts` to cover both paths with a hand-rolled minimal-Kysely stub. New cases: storage-present enabled / disabled / boolean-coerced enabled / wrong-collection filter / storage-miss → legacy-fallback; legacy-only paths preserved (slug→ULID, disabled-row hint, missing row). Total 118 tests (was 113; +5 net from updated suite).
- PRDs / coordination docs aligned: `prd-frontend.md` (signature, data flow, `BuilderWrapper` shapes), `prd-backend.md` (rendering data flow + F3 roadmap), `interfaces.md` (`getBuilderLayout` row stable, F2.4 proposal `[resolved]`, removed the placeholder `getBuilderLayoutFromContext` row by absorbing it into the main entry), `ownership.md` (`src/components/db.ts` row moved from A to B).
- Files: src/components/db.ts (full rewrite), src/components/BuilderWrapper.astro, src/components/index.ts, tests/getBuilderLayout.test.ts, CHANGELOG.md, .claude/prd-frontend.md, .claude/prd-backend.md, .claude/coordination/interfaces.md, .claude/coordination/ownership.md, .claude/coordination/status/agent-b.md.
- Pipeline: lint + typecheck + 118/118 tests + build all green on first try.

## 2026-05-09 10:08 · F1.2 done

- darkBlockSelector now emits a single compound selector via `:is(...)` covering Tailwind (`html.dark`), `html[data-theme="dark"]`, ancestor `[data-theme="dark"]`, EmDash admin `[data-mode="dark"]`, and self `[data-epx-block][data-theme="dark"]`. Plugin's `styleDark` variants apply regardless of host theme convention.
- Files: src/components/styleUtils.ts, tests/styleUtils.test.ts, .claude/prd-frontend.md, .claude/coordination/status/agent-b.md
- Pipeline: green (lint, typecheck, 74/74 tests, build)

## 2026-05-09 13:50 · F2.2 done

- New `src/components/media.ts` exports `resolveMediaUrl(key, { locals })`. Sync (matches `Astro.locals.emdash.getPublicMediaUrl?: (storageKey) => string`). Returns `null` only when key is falsy; otherwise adapter-resolved URL or legacy `/_emdash/api/media/file/<encodeURIComponent(key)>` fallback. Re-exported from `src/components/index.ts` alongside `MediaUrlResolver` and `ResolveMediaUrlOptions` types.
- Replaced every hardcoded `/_emdash/api/media/file/${storageKey}` pattern in `src/components/`:
  - Direct call sites in Image / Icon / Button / DividerSpacer / Video / SectionContainer / PortableTextImage now call `resolveMediaUrl(key, { locals: Astro.locals })`.
  - Background / video helpers in `styleUtils.ts` (`buildBackgroundCss`, `getVideoBackground`, `getVideoInfo`) accept an optional sync `resolveMediaUrl` callback via a shared `MediaUrlOptions` opts bag. Threaded through `buildBlockStyle`, `buildDarkBlockStyle`, `buildBlockCss`, `buildHoverCss`, `buildBlockChromeCss`. Astro components build the closure once from `Astro.locals` and pass it via `buildBlockChromeCss(cfg, blockId, { resolveMediaUrl: resolver })`.
- `styleUtils.ts` chrome helpers stayed **sync** (Option (b) per the F2.2 spec). KISS rationale documented in `prd-frontend.md`: making them async would cascade through the canvas (admin) which calls the same helpers inside a synchronous React render. Threading a callback is one extra param; converting half the codebase to async would not be.
- `Image.astro` still uses raw `<img>` driven by `resolveMediaUrl`, NOT `<Image image={...} />` from `emdash/ui`. Reason: layout JSON persists `ImageMediaRef` (`{ id, storageKey, alt?, filename? }`), but `emdash/ui`'s `Image` expects `MediaValue` (`{ id, src?, meta?, … }`). Swapping would require a normalization pass for every persisted block — out of scope for F2.2 and orthogonal to the URL-resolution bug. Documented in `prd-frontend.md`.
- Tests: new `tests/media.test.ts` covers null key / fallback / encoded-key fallback / adapter-resolved / adapter-undefined / partial-shape / empty-locals (7 cases). Two new `buildBlockChromeCss` cases in `tests/styleUtils.test.ts` exercise the resolver-supplied vs resolver-absent paths.
- Files: src/components/media.ts (new), src/components/Image.astro, src/components/Icon.astro, src/components/Button.astro, src/components/DividerSpacer.astro, src/components/Video.astro, src/components/SectionContainer.astro, src/components/PortableTextImage.astro, src/components/Text.astro, src/components/TextEditor.astro, src/components/Html.astro, src/components/styleUtils.ts, src/components/index.ts, tests/media.test.ts (new), tests/styleUtils.test.ts, CHANGELOG.md (opened 0.8.0 section), .claude/prd-frontend.md, .claude/coordination/interfaces.md, .claude/coordination/status/agent-b.md.
- Pipeline: full green. lint + typecheck + 88/88 tests (was 79; +9 new) + build all green on first try.
- Out-of-scope hardcodes flagged for orchestrator (not edited — admin is Agent C):
  - `src/admin/controls/BackgroundControl.tsx:189`, `:431`, `:832`
  - `src/admin/controls/MediaPicker.tsx:53`, `:106`, `:119`, `:315`
  - `src/admin/controls/ImagePreviewCard.tsx:51`
  - `src/admin/previews/ContainerPreview.tsx:31`, `:44`
  - `src/admin/previews/VideoPreview.tsx:23`
  - `src/admin/previews/IconPreview.tsx:11`
  - `src/admin/previews/ButtonPreview.tsx:12`
  - `src/admin/previews/DividerSpacerPreview.tsx:118`
  - `src/admin/previews/TextEditorPreview.tsx:60`
  - `src/admin/previews/ImagePreview.tsx:98`
  Helper is exported from `empixel-builder/components` so admin can import it directly when Agent C migrates.

## 2026-05-09 11:35 · F1.3 done

- LayoutRenderer.astro now emits a single global `<style>` block at the top of the rendered output containing the minimal plugin-scoped reset:
  - `[data-epx-block]{box-sizing:border-box;margin:0;}`
  - `[data-epx-block] *,[data-epx-block] *::before,[data-epx-block] *::after{box-sizing:border-box;}`
- Reset lives in the layout root (one rule per page), not in each block component (would have shipped N copies). Skipped when `sections.length === 0` so empty layouts stay zero-emit.
- No pre-existing reset found anywhere in `src/components/*.astro` (grep'd for `box-sizing` — only matches were on internal helpers like `iframeOverrideCss` in `Html.astro` and admin builder CSS, which is fine and orthogonal).
- Files: src/components/LayoutRenderer.astro, CHANGELOG.md, .claude/prd-frontend.md, .claude/coordination/status/agent-b.md
- Pipeline: lint green, tests green (74/74), build/typecheck red **only on the pre-existing F1.1 capability mismatch** (`PluginCapability` type union in installed `emdash` peer doesn't yet include `content:read`) — the same failure occurs on the unmodified branch tip. F1.3 introduces zero new failures. Orchestrator to track via Agent A's F1.4.

## 2026-05-09 22:35 · fix/F3.4-backcompat-3arg done

- Bug fixed (P0 round 2): `getBuilderLayout` is now polymorphic over the legacy 3-arg `(collection, entryId, enabled?)` and the F3.4 4-arg `(astro, collection, entryId, enabled?)` signatures. Theme code (Novapera, other host sites) stays untouched per the hard constraint; both call shapes render builder content correctly.
- Files changed: `src/components/db.ts`, `tests/getBuilderLayout.test.ts`, `CHANGELOG.md`, `.claude/prd-frontend.md`, `.claude/coordination/status/agent-b.md`.
- Implementation:
  - TypeScript overloads at the public `export async function getBuilderLayout` declaration: signature 1 is `(collection, entryId, enabled?)`, signature 2 is `(astro, collection, entryId, enabled?)`. Implementation accepts a union rest-args and dispatches at runtime on `typeof args[0] === "string"` — string → legacy slot pattern, object → 4-arg slot pattern.
  - Extracted two helpers from the legacy implementation. `loadLayoutResult(handle, collection, entryId, cacheHint)` is the shared row-fetch + cache-hint stamping, called by both code paths once a Kysely handle is in hand. `resolveKyselyHandleViaRuntime()` is the runtime-only handle resolver used by the 3-arg path (no `Astro.locals` to consult — the function falls straight through to `getDb()` from `emdash/runtime`). The 4-arg path keeps the existing `resolveKyselyHandle(astro)` helper which still tries `Astro.locals.emdash.db` first then the runtime accessor.
  - The legacy 3-arg path can ONLY plumb the `cacheHint` into `Astro.cache.set` if the host migrates to the 4-arg shape — `BuilderWrapper.astro` only owns an `Astro` reference when it's rendered with one. Documented in `prd-frontend.md` § "Migration story". KISS: returning the same `BuilderLayoutResult` shape from both paths keeps the wrapper logic untouched (`BuilderWrapper.astro` already accepts the unawaited promise and the `cacheHint`-stamping is a no-op when the consumer isn't an Astro page).
- Tests: 5 new cases under "legacy 3-arg call shape (regression — fix/F3.4-backcompat-3arg)":
  1. The actual Novapera-shape ULID `01KPBDEV2JHJ4BT2KNEXA18CS3` (uppercase Crockford) does NOT trip the `COLLECTION_RE` short-circuit in the 3-arg path. Pre-fix this was the failing case — `astro = "posts"`, `collection = "01KPBDEV..."`, regex rejects, null sections, builder fell through to host theme.
  2. `enabled=false` in the 3-arg shape → null sections without DB lookup.
  3. Invalid collection name (`PaGeS!!`) in the 3-arg shape still hits the regex check at position 0 — null sections, hint intact.
  4. `enabled=undefined` in the 3-arg shape (the most common Novapera call: `getBuilderLayout("posts", post.data.id, post.data.empixel_builder)` where the flag is undefined for entries that have never been toggled) → routes correctly past the regex; runtime fallback fails in vitest → null sections.
  5. End-to-end runtime-singleton round-trip: the legacy 3-arg call lands on a real Kysely handle when `emdash/runtime` is `vi.doMock`-ed to return the storage stub. Verifies sections + `lastModified` plumb correctly through the runtime fallback path.
- Total tests: 213 → 215. Suite: 12 → 17 cases for `getBuilderLayout.test.ts`.
- PRD: `.claude/prd-frontend.md` § "getBuilderLayout" updated with the polymorphic signature block, both call shapes' Kysely handle resolution paths, the migration story (no host edit required for v0.8 → v0.9), and a Props Flow example demonstrating the legacy 3-arg shape alongside the recommended 4-arg form.
- CHANGELOG: new bullet under `## Unreleased — 0.9.5 prep` (appended ABOVE the prior `/entries` and `getBuilderLayout` hotfix bullets — chronological order). The earlier `fix/F3.4-frontend-empty` bullet is preserved untouched.
- Coordination: no `interfaces.md` change. The 4-arg signature row remains the documented stable interface; the legacy 3-arg shape is a compatibility overload, not a separate stable contract. `BuilderWrapper.astro` was not modified — it already handled `Promise<BuilderLayoutResult>` and `BuilderLayoutResult` shapes that flow out of either path.
- Pipeline: lint + typecheck + 215/215 tests + build all green on first try.

## 2026-05-09 22:10 · fix/F3.4-backcompat-3arg started

- Branch: `fix/F3.4-backcompat-3arg` off latest main (70843fd).
- Goal: `fix/F3.4-frontend-empty` (commit 70843fd) addressed handle resolution + doc-id symmetry, but Novapera retest shows the bug **persists**. The earlier fix changed the public signature to 4-arg `(astro, collection, entryId, enabled?)` while host pages scaffolded by `npx empixel-builder add` (and Novapera, pinned to v0.8/pre-F3.4) still call the **legacy 3-arg** `(collection, entryId, enabled?)`. When the 3-arg call hits the new function, args slot in as: `astro = "posts"` (string), `collection = post.data.id` (uppercase ULID), `entryId = boolean | undefined`, `enabled = undefined`. The first `COLLECTION_RE.test(collection)` line on line 263 of `db.ts` then rejects the uppercase ULID — `null` sections, `BuilderWrapper` falls through to the host theme `<slot />`. Per the hard constraint, theme code (Novapera) is OFF-LIMITS — the plugin must therefore accept both signatures.
- Plan: make `getBuilderLayout` polymorphic. Detect on the first arg: string → legacy 3-arg path (resolves the Kysely handle exclusively via `getDb()` from `emdash/runtime` since no `Astro.locals` is reachable); object → 4-arg path (existing logic, unchanged). Same `Promise<BuilderLayoutResult>` return on both paths — `BuilderWrapper.astro` already accepts the unawaited promise so no further wrapper change is needed. Tests: 3-arg + enabled=true with matching row → row, 3-arg + enabled=false → null, 3-arg + enabled=undefined → row, 3-arg + non-existent → null, 3-arg with the actual Novapera-shape ULID `"01KPBDEV2JHJ4BT2KNEXA18CS3"` → does NOT short-circuit on the regex (regex applies only to `collection`).

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
