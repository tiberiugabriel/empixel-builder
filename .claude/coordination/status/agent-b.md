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

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
