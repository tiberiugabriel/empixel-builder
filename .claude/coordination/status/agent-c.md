# Agent C — Admin UI

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: RightPanel standardization, declarative `BlockDef` schema (`fieldsTab`/`styleTab`), tab renderer, code-split, Canvas refactor, field-bound blocks, theme×state matrix.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentC-<task-id>` (e.g. `feature/agentC-F3.5.1`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentC-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR — especially `prd-blocks.md`, `prd-rightpanel.md`, `prd-builder-ui.md`, `prd-previews.md`.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` / `types-proposals.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-10 02:18 · F3.6.3 done

Branch: `feature/agentC-F3.6.3`. Single commit (see git log).

**Files changed**:
- `src/admin/Canvas.tsx` — replaced `buildEffectiveBlockCss` with the
  new `buildCanvasBlockCss(block, activeBreakpoint)` (exported) which
  delegates to `buildBlockChromeCss(config, blockId, opts)` for the
  full frontend bundle then layers a non-`@media` preview overlay on
  top via the new `buildActiveBpPreviewCss` helper. Imports updated:
  `buildBlockChromeCss` added; `getCustomCss` removed (folded into
  the chrome helper); `buildBlockCss` / `buildHoverCss` /
  `buildImgVisualCss` / `buildImgVisualHoverCss` retained for the
  overlay path.
- `tests/canvasCss.test.ts` — new. 11 tests across two describe
  blocks: "frontend parity" (5 tests — desktop output equals
  `buildBlockChromeCss` exactly for text/image/dark variants, full
  bundle composition, empty-state) and "active-breakpoint preview
  overlay" (6 tests — overlay layers AFTER bundle, hover overlay,
  no overlay when active bp has no overrides, image `imgScoped`
  routing, desktop returns no overlay, cascade order verified by
  string index).
- `CHANGELOG.md` — F3.6.3 entry above F3.6.2.
- `.claude/prd-builder-ui.md` — replaced the F3.6.2-era pseudo-merge
  description with the F3.6.3 unification (new `buildCanvasBlockCss`
  helper, FULL chrome chain, drift dies, active-bp overlay).
- `.claude/prd-breakpoints.md` — new "Active-breakpoint preview on
  Canvas (F3.6.3)" section above "Breakpoint indicator — convention".
  Documents why `@media` doesn't fire on Canvas, why spec options (a)
  and (b) were rejected, the stacked-overlay mechanism with code
  sketch, and the trade-off (rule duplication when overlay fires —
  negligible since canvas is admin-only).
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test &&
npm run build` all green. 253 tests pass (242 → 253, +11 new in
`canvasCss.test.ts`).

**Active-breakpoint mechanism chosen**: stacked preview overlay (KISS
fallback per F3.6.3 spec). Spec option (a) `@container` queries
rejected because rewriting `buildBreakpointCss` falls in Agent B's
column. Spec option (b) CSS variable + `:where(...)` rejected because
CSS variables can't gate `@media` evaluation (the browser checks
actual viewport regardless). Overlay emits a non-`@media` duplicate
of the active bp's declarations (scoped to `[data-epx-block="<id>"]`
+ `:hover` + `img` for `imgScoped`) layered AFTER the frontend
bundle so cascade order picks it up. Trade-off documented in
prd-breakpoints.md: when overlay fires, the stylesheet has two rules
with identical declarations — rule duplication footprint is one rule
per block per active-bp override, negligible since canvas is admin
only and the overlay is identity-stable across renders (memoized via
`useMemo`).

**No new export from `styleUtils.ts` needed**: `buildBlockChromeCss`
was already exported (per `interfaces.md` row "✅ partial — needs
export surface review in F3.6.3"). After this PR the interface row
moves from "partial" to "stable" — Agent C doesn't edit the file but
flags this for orchestrator review.

**LOC delta on Canvas.tsx**: 596 → 631 (+35). Most growth is the
F3.6.3 doc-comment block (~20 LOC) explaining the unification + the
preview-overlay mechanism. The pseudo-merge logic moved from the main
`buildEffectiveBlockCss` path into `buildActiveBpPreviewCss` (gated
on `activeBreakpoint !== "desktop"` and on the active-bp having any
override) — desktop preview is now zero work beyond the chrome call.

**Tests added**: `tests/canvasCss.test.ts` (new file, 11 tests).

**No `src/types.ts` proposal**: no shared-type changes — all new code
lives in `src/admin/Canvas.tsx` (Agent C's column) and the new test
file.

**No blockers.**

## 2026-05-10 01:05 · F3.6.3 (Canvas → buildBlockChromeCss) started

Branch: `feature/agentC-F3.6.3`. Worktree at latest `main` (`d777a5c`).
Phase F3.6 round 3. Unifies Canvas's per-block CSS path with the
frontend Astro components.

Planned scope:
- `src/admin/Canvas.tsx` — replace `buildEffectiveBlockCss` with a
  call to `buildBlockChromeCss` (Agent B's exported helper). Canvas
  emits the FULL frontend bundle now (including `@media` queries from
  `buildBreakpointCss` / `buildBreakpointHoverCss`) instead of only
  `buildBlockCss + buildHoverCss + getCustomCss`.
- Active-breakpoint preview mechanism — chosen mechanism: **stacked
  preview overlay**. Spec option (a) `@container` queries would force
  Agent B to rewrite the `buildBreakpointCss` helper (out of scope —
  not Agent C's column). Spec option (b) CSS variable + `:where(...)`
  doesn't work because CSS variables can't gate `@media` evaluation
  (the browser checks the actual viewport regardless of an author
  CSS var). KISS fallback per the spec: keep the pseudo-merge for the
  active bp, but layer it ON TOP of the full frontend bundle so non-
  active breakpoints still emit identical to the host site. Preview
  overlay is a non-`@media` duplicate of the active bp's declarations,
  scoped to `[data-epx-block="<id>"]` (and `[…] :hover` for hover);
  it cascades after the full bundle so it wins. Frontend stays
  untouched. F4 can revisit if `@container` becomes viable across all
  block components.
- Tests — extend `tests/styleUtils.test.ts` with assertions that
  `buildBlockChromeCss` output is the same shape Canvas emits, plus
  a Canvas-specific test for the preview overlay path.
- `CHANGELOG.md` — append F3.6.3 entry.
- `.claude/prd-builder-ui.md`, `.claude/prd-breakpoints.md` — document
  the unification + preview mechanism.

No `src/types.ts` proposal expected. No new export from
`styleUtils.ts` needed — `buildBlockChromeCss` is already public.

## 2026-05-10 00:10 · F3.6.2 (getDefaultBlockConfig + load-time fill) started

Branch: `feature/agentC-F3.6.2`. Worktree at latest `main` (`0d9040e`).
Phase F3.6 round 2. Builds the load-time fill helper on top of F3.6.1.

Planned scope:
- `src/admin/blockDefinitions.ts` — export `BASE_DEFAULTS`
  (`{ theme: "light", style: { ...EMPTY_STYLE_DEFAULTS },
  styleHover: {}, styleDark: {}, styleBreakpoints: {},
  styleHoverBreakpoints: {}, advanced: { ...EMPTY_ADVANCED_DEFAULTS } }`)
  + `getDefaultBlockConfig(type)`. Returns
  `structuredClone({ ...BASE_DEFAULTS, ...def.defaultConfig })` so two
  calls return independent objects (mutating one doesn't affect the
  other). Unknown types fall back to `structuredClone(BASE_DEFAULTS)`.
- `src/admin/builder/builderReducer.ts` — `ADD_BLOCK` deep-merges
  block.config over `getDefaultBlockConfig(type)` so any partial config
  the action carries wins, missing keys are backfilled. `LOAD_SUCCESS`
  walks the section tree (via a local recursive `fillBlockDefaults`
  helper because `treeUtils.ts` doesn't ship a generic transform pass)
  and backfills missing keys per node, recursing into `children` and
  `slots`. Existing values never overwritten.
- `tests/blockDefinitions.test.ts` — F3.6.2 describe block:
  `getDefaultBlockConfig("text")` has every STYLE_PROPS key in
  `style`; deep-clone independence (mutating one return doesn't
  affect a second call); unknown type returns a sensible empty
  shape; every block's getDefaultBlockConfig has full top-level
  shape.
- `tests/builderReducer.test.ts` — F3.6.2 describe block:
  ADD_BLOCK fills defaults for each of 9 block types; sparse
  config wins over defaults (`content: "x"` preserved on
  `text`); LOAD_SUCCESS sparse-tree backfill (recursive into
  children + slots); pre-existing design defaults
  (`container.style.paddingTop = "12px"`) preserved.
- `CHANGELOG.md` — append F3.6.2 bullet under
  `## Unreleased — 0.9.6 prep`.
- `.claude/prd-blocks.md` — paragraph documenting
  `getDefaultBlockConfig(type)` + `BASE_DEFAULTS` next to F3.6.1.
- `.claude/prd-builder-ui.md` — paragraph documenting the load-time
  fill behavior in `ADD_BLOCK` and `LOAD_SUCCESS`.
- `.claude/coordination/status/agent-c.md` — start + done entries.

No `src/types.ts` proposal — `BlockDef.defaultConfig` is typed
`Record<string, any>`, the new helper returns the same shape.
`BaseBlockConfig`'s open-index signature already covers the
backfilled keys.



Branch: `feature/agentC-F3.6.1`. Worktree at latest `main` (`8885106`).
Phase F3.6 entry. Schema-only foundation: every `BlockDef.defaultConfig`
gains the full structural shape — `style` containing every key in
`STYLE_PROPS`, plus empty `styleHover`, `styleDark`, `styleBreakpoints`,
`styleHoverBreakpoints`, and a populated `advanced` placeholder. Values
stay empty (`""` / `{}`) — F3.6.1 invents NO design values. Existing
block-specific keys (e.g. `container.style.paddingTop = "12px"`) keep
their current values; new empty keys merge in alongside.

`STYLE_PROPS` lives in `src/components/styleUtils.ts` as a non-exported
local `const` (Agent B's column). Verbatim 36 keys: padding{Top,Right,
Bottom,Left}, margin{Top,Right,Bottom,Left}, width/minWidth/maxWidth/
height/minHeight/maxHeight, borderTopLeftRadius / borderTopRightRadius /
borderBottomRightRadius / borderBottomLeftRadius, borderTopWidth /
borderRightWidth / borderBottomWidth / borderLeftWidth, overflowX /
overflowY, textAlign, fontFamily / fontSize / fontWeight, textTransform /
fontStyle / textDecoration, lineHeight / letterSpacing / wordSpacing,
mixBlendMode, aspectRatio, filter. Test file replicates the array
locally rather than touching B's file to add an export.

Planned scope:
- `src/admin/blockDefinitions.ts` — extend each of 9 `defaultConfig`
  objects with the full structure.
- `tests/blockDefinitions.test.ts` — assert every block's
  `defaultConfig.style` has every `STYLE_PROPS` key.
- `CHANGELOG.md` — open `## Unreleased — 0.9.6 prep` + F3.6.1 bullet.
- `.claude/prd-blocks.md` — new "defaultConfig structure" subsection.
- `.claude/coordination/status/agent-c.md` — start + done entries.

No `src/types.ts` proposal — `BlockDef.defaultConfig` is typed
`Record<string, any>` so adding empty-string keys is allowed without
type changes. `BaseBlockConfig`'s open-index signature already covers
this shape.

## 2026-05-09 22:30 · F3.5.8 (block-author guide) started

Branch: `feature/agentC-F3.5.8`. Worktree at latest `main` (`f8fcab8`).
Docs-only PR. Goal: a future block-author can read
`.claude/prd-blocks.md` + `.claude/prd-rightpanel.md` and add a new
block in 3 file touches without spelunking the panel internals.

Planned scope:
- `.claude/prd-blocks.md` — main author guide (recipe + BlockDef +
  FieldDef + StyleSection references + worked example +
  what-NOT-to-touch + custom-section escape hatch).
- `.claude/prd-rightpanel.md` — architecture summary refresh + cross
  link + brief StyleSection table.
- `.claude/prd-index.md` — link to author guide + diagram refresh.
- `CHANGELOG.md` — closing F3.5.8 bullet under
  `## Unreleased — 0.9.5 prep`.
- `.claude/coordination/status/agent-c.md` — start + done entries.

No `.ts` / `.tsx` / `.astro` source touches. `src/types.ts` untouched
(no proposal needed — pure docs).

## 2026-05-09 21:30 · F3.5.6 followup (Style spacing + theme dup) started

Branch: `fix/F3.5.6-style-spacing-and-theme-dup`. Worktree at latest
`main` (`70843fd`). Two surgical visual fixes from manual Novapera
test post-F3.5.6:

**Bug 1** — `epx-right-panel__style` wrapper has no CSS rule. The
F3.5.6 `<TabRenderer />` emits a different wrapper class (`__style`)
for the Style tab body than the Fields tab body (`__fields`); only the
Fields class has padding/gap/flex rules in `builder.css` (L593–596),
so the Style tab body collapses against the panel edge. Fix: add a
shared selector `.epx-right-panel__fields, .epx-right-panel__style`
(combined rule preferred — same scrollbar styling, same flex layout)
to `builder.css`. Class names in `TabRenderer.tsx` are correct (per
PRD intent — different wrappers because the Style body wraps section
shells, not flat fields). The bug is purely missing CSS.

**Bug 2** — `container.styleTab` opens with `{ kind: "theme" }` even
though `BackgroundSection` already includes `<ThemeStyleToggle />`
inline (verified at L57 of `sections/BackgroundSection.tsx`). Same
audit applies to `button.styleTab`. Decision per block:
- `text` — no `background` section → keep theme entry? No: `text` has
  NO `theme` entry in its current declaration (`alignment / typography
  / textStroke / textShadow / blendMode`). N/A.
- `image` — no `theme` entry, no `background` section. N/A.
- `text-editor` — no `theme`, no `background`. N/A.
- `video` — single `custom(VideoSourceSection)`. N/A.
- `button` — has `[typography, theme, background, ...]` → `theme`
  duplicates `BackgroundSection`'s inline toggle. **Drop**.
- `icon` — `[alignment, custom(IconBlockStyleSection)]`. N/A.
- `html` — no Style tab. N/A.
- `divider-spacer` — single custom. N/A.
- `container` — `[theme, background, ...]` → **Drop** the leading
  theme entry. Background already covers it.

Tests added:
- `tabRenderer.test.ts` — assert Style tab body emits
  `epx-right-panel__style` wrapper class (already present, but tighten
  by also asserting fields body emits `epx-right-panel__fields`).
- `blockDefinitions.test.ts` — assert no `styleTab` array contains a
  leading `{ kind: "theme" }` followed by `{ kind: "background" }`
  (regression guard for Bug 2).



Branch: `feature/agentC-F3.5.6`. Worktree at latest `main` (`16356ef`).
Wiring `RightPanel.tsx` onto the declarative `BlockDef.fieldsTab` /
`styleTab` pipeline shipped in F3.5.1—F3.5.5. Goal: 1671 LOC → < 400.

**Branch inventory** (every `block.type ===` fork / Style-tab-hide gate
counted before edits):

Fields-tab branches (active tab = "fields"):
- L631 `block.type === "text-editor"` — drop cap toggle, columns
  select with custom-pen + scrub label + leftAddon, columns gap
  SideInput. All bp-aware via `writeBpConfig`.
- L779 `block.type === "text"` — HTML tag SelectRow + LinkControl
  when tag=`a`.
- L798 `block.type === "image"` — ImagePreviewCard +
  Resolution SelectRow + LinkControl + MediaPicker portal.
- L839 `block.type === "container"` — LayoutControl (bp-aware).
- L849 `block.type === "container"` — GapControl (bp-aware).
- L852 `block.type === "container"` — OverflowControl + HTML tag
  + LinkControl when tag=`a`.
- L875 `block.type === "video"` — VideoSourceControl + Image
  Overlay group (ImagePreviewCard + MediaPicker + resolution +
  size + position + IconGroup).
- L952 `block.type === "button"` — LinkControl.
- L955 `block.type === "icon"` — LinkControl.
- L958 `block.type === "divider-spacer"` — full divider line
  picker (lifts to `styleTab` per F3.5.2 declaration).

Style-tab branches (active tab = "style"):
- L1271 `text` — alignment + typography stack (no
  bg/border/shadow).
- L1301 `text-editor` — alignment + typography (base only) +
  text shadow + paragraph spacing + dropCap subgroup.
- L1372 `video` — aspect ratio + CssFilters.
- L1427 `icon` — alignment + color/size/rotate group.
- L1463 `divider-spacer` — placeholder text.
- L1471 `container || image || button` — typography (button
  only) + styleFields alias renderer + image-only group
  (W/H/fit/pos/align/opacity) + bg toggle (non-image only) +
  borderRadius/border/boxShadow stateful triplet.

Tab-shell gate:
- L583 `hideStyleTab = block.type === "html"`.

**Strategy** chosen for F3.5.6:
1. Add `FieldDef` `kind: "custom"` variant (lives in
   `blockDefinitions.ts` — Agent C's column; verified `src/types.ts`
   has no `FieldDef` declaration today). Discriminator: optional
   `kind` defaulting to `"standard"`. The existing 12 `type`
   variants stay unchanged so we don't migrate the 9 BlockDef
   entries' shape — we just allow a second variant.
2. Extend `FieldRenderer.tsx` to dispatch on `kind === "custom"`
   via the renderer's `render` prop.
3. Migrate `container`'s `fieldsTab` from `[]` to a single
   `kind: "custom"` entry pointing at a new
   `right-panel/sections/ContainerLayoutPicker.tsx` (extract from
   L839/L849/L852).
4. Same for `video` → `right-panel/sections/VideoFieldsSection.tsx`
   (extract from L875).
5. Extract per-block leaf Fields renderers (text/image/text-editor/
   button/icon/divider-spacer) into the `fieldsTab` declarations as
   `kind: "custom"` entries — the simplest path that preserves the
   bespoke widgets the existing FieldDefs can't model. Saves
   re-implementing every section as a plain FieldDef (which would
   require 6 new FieldDef variants we don't need).
6. Rewrite `RightPanel.tsx` to a thin shell: `<TabRenderer />` body
   + the `unknown block` placeholder + the theme/handlers needed
   for `useAutoSelectTab`. Drop every imperative branch.

Branch: `feature/agentC-F3.5.5`. Worktree at latest `main` (`7bb17d3`).
Extracting universal `<AdvancedTab />` into
`src/admin/right-panel/AdvancedTab.tsx`. Replaces F3.5.4's
placeholder in `TabRenderer.tsx`. Reads `block.config.advanced` +
`block.config.style`, dispatches `onChange` patches. Inline JSX in
`RightPanel.tsx` stays put — F3.5.6 owns that swap. Reuses existing
`controls/` primitives (`SpacingControl`, `DimensionControl`,
`SelectRow`, `NumberRow`, `TextRow`, `CodeEditor`, `FieldGroup`).

## 2026-05-09 19:10 · F3.5.4 started

Branch: `feature/agentC-F3.5.4`. Worktree at latest `main` (`fde0ee9`).
Building `src/admin/right-panel/TabRenderer.tsx` — owns the 3-tab
shell (Fields / Style / Advanced) for the new declarative path.
Exports `getVisibleTabs(block)` (drives auto-hide of Style for `html`
and any block missing `styleTab`), the `TabRenderer` JSX component,
and the `useAutoSelectTab(block, activeTab, setActiveTab)` hook for
F3.5.6 to re-import. Body dispatches: Fields → iterate
`def.fieldsTab ?? def.fields` via `<FieldRenderer>`; Style → iterate
`def.styleTab` via the F3.5.3 `<SectionRenderer>`; Advanced → small
placeholder until F3.5.5 ships the real tab. RightPanel.tsx is NOT
modified — F3.5.6 owns the swap.

## 2026-05-09 18:30 · F3.5.3 started

Branch: `feature/agentC-F3.5.3`. Worktree at latest `main` (`bf913df`).
Building the pure `SectionRenderer.tsx` dispatcher under
`src/admin/right-panel/`. One branch per `StyleSection.kind` (19
variants), exhaustive via `assertNever`. Wraps existing controls under
`controls/` plus the four extracted `sections/` files from F3.5.2.
File stays under 200 LOC; no business logic — purely a switch. Tests
render each variant via `renderToStaticMarkup` (react-dom/server is
already in `node_modules` from React peer; no new dep). RightPanel
wiring deferred to F3.5.6.

## 2026-05-09 17:10 · F3.5.2 started

Branch: `feature/agentC-F3.5.2`. Worktree at latest `main` (`556a1ae`).
Migrating all 9 `BlockDef` instances (`container`, `text`, `image`,
`text-editor`, `video`, `button`, `icon`, `html`, `divider-spacer`)
to the declarative `fieldsTab` + `styleTab` schema introduced in
F3.5.1. Non-trivial Style logic (text-editor columns/dropCap, video
source picker, divider-spacer divider line) extracted into
`src/admin/right-panel/sections/`. The 9 imperative `block.type ===`
branches in `RightPanel.tsx` stay in place — F3.5.6 deletes them.

## 2026-05-09 15:30 · F3.5.1 started

Branch: `feature/agentC-F3.5.1`. Worktree at latest `main` (`ebf3347`).
Adding declarative `StyleSection` discriminated union and
`fieldsTab` / `styleTab` properties to `BlockDef`. Existing `fields` /
`styleFields` kept as deprecated aliases through the F3.5 transition.
No `BlockDef` instances migrated yet (F3.5.2); no `RightPanel.tsx`
rewrite yet (F3.5.6).

## In progress

*(see "Current task")*

## Done

## 2026-05-10 00:35 · F3.6.2 (getDefaultBlockConfig + load-time fill) done

Branch: `feature/agentC-F3.6.2`. Single commit (about to land).

**Files changed** (7):
- `src/admin/blockDefinitions.ts` — two new exports: `BASE_DEFAULTS`
  (shared shape: `theme: "light"` + the F3.6.1 empty placeholders for
  `style` / `styleHover` / `styleDark` / `styleBreakpoints` /
  `styleHoverBreakpoints` / `advanced`) and
  `getDefaultBlockConfig(type)`. Helper deep-clones via
  `structuredClone` (with JSON round-trip fallback), then deep-merges
  the BlockDef's own `defaultConfig` on top of `BASE_DEFAULTS` so
  nested objects (`style`, `advanced`) keep BASE_DEFAULTS' floor with
  the BlockDef's design defaults winning per-key (preserves
  `container.style.paddingTop = "12px"`). Unknown block types receive
  `structuredClone(BASE_DEFAULTS)` — the helper never returns
  `undefined`. Two calls return independent object references.
- `src/admin/builder/builderReducer.ts` — new local
  `fillBlockDefaults(block)` recursive helper (deep-merges
  `block.config` over `getDefaultBlockConfig(block.type)`, recurses
  into `children` + `slots`). Wired into `LOAD_SUCCESS` (walks the
  loaded tree, backfills missing keys per node), `ADD_BLOCK`,
  `ADD_TO_CONTAINER`, `INSERT_AFTER` (every path that lands a fresh
  block in state goes through the fill). Existing values always win;
  defaults backfill missing keys only.
- `tests/blockDefinitions.test.ts` — new F3.6.2 describe block (9
  tests): `BASE_DEFAULTS` shape, full STYLE_PROPS coverage on
  `getDefaultBlockConfig("text")`, deep-clone independence (mutating
  one return doesn't affect a second call), full top-level shape on
  every block, container's design defaults preserved
  (`paddingTop="12px"`), unknown-type fallback, text-editor scalar
  defaults preserved, video nested object defaults preserved,
  divider-spacer divider sub-object preserved, advanced default
  carries every `EMPTY_ADVANCED_DEFAULTS` key as `""`.
- `tests/builderReducer.test.ts` — new F3.6.2 describe block (9
  tests): `ADD_BLOCK` fills STYLE_PROPS keys for each of 9 block
  types, action wins on overlap (sparse `style.fontSize` preserved),
  container's design defaults preserved, `LOAD_SUCCESS` backfills at
  root, recurses into `children` + `slots`, preserves nested values,
  preserves container's design defaults on legacy layouts,
  `ADD_TO_CONTAINER` + `INSERT_AFTER` consistency.
- `CHANGELOG.md` — F3.6.2 bullet appended above F3.6.1 under
  `## Unreleased — 0.9.6 prep`. Documents new exports, reducer wiring,
  test deltas (224 → 242, +18 new). `package.json` stays at `0.9.5`.
- `.claude/prd-blocks.md` — new "`getDefaultBlockConfig(type)` +
  `BASE_DEFAULTS` (F3.6.2)" subsection inserted between F3.6.1 and
  StyleSection. Documents the helper signature, the deep-clone
  contract, the deep-merge approach, the unknown-type fallback, and
  the reducer wiring.
- `.claude/prd-builder-ui.md` — Action-types table entries for
  `LOAD_SUCCESS` / `ADD_BLOCK` / `ADD_TO_CONTAINER` / `INSERT_AFTER`
  flagged "(config filled — F3.6.2)". New "F3.6.2 — load-time +
  add-time config fill" subsection beneath the table documents the
  three paths + the foundation-for-F3.6.3 rationale.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Helper signature** (for the orchestrator's reference):
```ts
function getDefaultBlockConfig(type: BlockType): Record<string, any>;
```
Returns a deep-cloned object built from
`structuredClone(BASE_DEFAULTS)` with the BlockDef's nested defaults
deep-merged on top. `structuredClone` is gated by a runtime check;
JSON round-trip is the fallback for older runtimes (matches the
`treeUtils.deepCloneBlock` pattern from F3.5).

**Reducer wiring** (file:line):
- `LOAD_SUCCESS` fill at `src/admin/builder/builderReducer.ts:110`
  (`action.sections.map(fillBlockDefaults)`).
- `ADD_BLOCK` fill at `src/admin/builder/builderReducer.ts:122`.
- `ADD_TO_CONTAINER` fill at `src/admin/builder/builderReducer.ts:147`.
- `INSERT_AFTER` fill at `src/admin/builder/builderReducer.ts:168`.

**Pipeline**: `npm run lint && npm run typecheck && npm test &&
npm run build` all green. **242 tests pass** (224 → 242, +18 new
across `blockDefinitions.test.ts` and `builderReducer.test.ts`).

Pipeline tail:
```
> empixel-builder@0.9.5 test
> vitest run
 Test Files  14 passed (14)
      Tests  242 passed (242)
   Duration  758ms

> empixel-builder@0.9.5 build
> tsc && mkdir -p dist/admin/builder/styles && cp src/admin/builder/styles/*.css dist/admin/builder/styles/
```

**No `src/types.ts` proposal**: `BlockDef.defaultConfig` is typed
`Record<string, any>` and the new helper returns the same shape.
`BaseBlockConfig`'s open-index signature already covers the
backfilled keys.

**Surprises / blockers**: none. `Builder.tsx` and `useDragHandlers.ts`
both still shallow-spread `def.defaultConfig` when crafting the
action; centralising the fill in the reducer means F3.6.3 / .4 / .5
don't have to touch every caller. The test suite stays green without
adjustments to existing tests because the fill contract is
"defaults backfill missing keys; existing values always win"
(idempotent re-fill).

## 2026-05-09 23:55 · F3.6.1 (defaultConfig full style schema) done

Branch: `feature/agentC-F3.6.1`. Single commit (about to land).

**Files changed** (5):
- `src/admin/blockDefinitions.ts` — two new exports
  (`EMPTY_STYLE_DEFAULTS` with all 36 STYLE_PROPS keys, value `""`;
  `EMPTY_ADVANCED_DEFAULTS` with all 9 AdvancedConfig keys, value
  `""`). Each of the 9 BlockDef instances'  `defaultConfig` now
  spreads them — every block carries the same top-level shape
  (`style`, `styleHover`, `styleDark`, `styleBreakpoints`,
  `styleHoverBreakpoints`, `advanced`). Pre-existing design values
  on `container.style` (`paddingTop/Right/Bottom/Left = "12px"`,
  `columnGap/rowGap = "6px"`) and on every other block-specific key
  (`text-editor.columns`, `video.aspectRatio`, `divider-spacer.divider`,
  etc.) are preserved verbatim.
- `tests/blockDefinitions.test.ts` — new F3.6.1 describe block with
  5 tests: STYLE_PROPS coverage on EMPTY_STYLE_DEFAULTS, full
  STYLE_PROPS coverage on every block's defaultConfig.style, full
  top-level shape coverage, every EMPTY_ADVANCED_DEFAULTS key on
  every advanced default, and a "no design values invented"
  assertion that whitelists the pre-existing `container` padding
  overrides and asserts everything else is `""`. Test imports
  `EMPTY_STYLE_DEFAULTS` and `EMPTY_ADVANCED_DEFAULTS` directly;
  the STYLE_PROPS array is replicated locally as a snapshot
  contract (the canonical list lives in `src/components/styleUtils.ts`
  as a non-exported `const` — Agent B's column).
- `CHANGELOG.md` — opened `## Unreleased — 0.9.6 prep` above
  `## 0.9.5 — 2026-05-09`. F3.6.1 bullet documents the new shape, the
  empty-value contract, the pre-existing container exception, the
  test deltas, and confirms `package.json` stays at `0.9.5`.
- `.claude/prd-blocks.md` — new "`defaultConfig` structure (F3.6.1)"
  subsection inserted between BlockDef interface and StyleSection.
  Documents the canonical shape, the rationale (Canvas / RightPanel /
  F3.6.2 / F3.6.3), the 36-key STYLE_PROPS mirror in
  `EMPTY_STYLE_DEFAULTS`, the per-block design defaults that survive
  the merge, and the maintenance rule (mirror new STYLE_PROPS keys in
  both `EMPTY_STYLE_DEFAULTS` and `STYLE_PROPS_SNAPSHOT` in the test).
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Per-block summary** (every block now declares the full structure):
| Block | Block-specific defaults preserved | `style` keys | Top-level shape |
|---|---|---|---|
| `text` | `content: ""`, `theme: "light"` | 36 STYLE_PROPS, all `""` | full ✓ |
| `image` | `theme: "light"`, `resolution: "full"` | 36 STYLE_PROPS, all `""` | full ✓ |
| `text-editor` | `content: []`, `theme`, `columns: "1"`, `columnsGap: "0px"`, `dropCap: false` | 36 STYLE_PROPS, all `""` | full ✓ |
| `video` | `theme`, `video: {...}`, `aspectRatio: "16:9"` | 36 STYLE_PROPS, all `""` | full ✓ |
| `button` | `theme`, `text: "Click me"`, `icon: {...}` | 36 STYLE_PROPS, all `""` | full ✓ |
| `icon` | `theme`, `icon: { iconSize: "32px" }` | 36 STYLE_PROPS, all `""` | full ✓ |
| `html` | `theme`, `code: ""` | 36 STYLE_PROPS, all `""` | full ✓ |
| `divider-spacer` | `theme`, `space: "48px"`, `divider: {...}` | 36 STYLE_PROPS, all `""` | full ✓ |
| `container` | `theme`, `layout: "flex"` | 36 STYLE_PROPS — 4 padding keys + `columnGap`/`rowGap` keep design values, others `""` | full ✓ |

**STYLE_PROPS keys filled into each block's style default**: 36
(padding{Top,Right,Bottom,Left}, margin{Top,Right,Bottom,Left},
width/minWidth/maxWidth, height/minHeight/maxHeight,
borderTopLeftRadius / borderTopRightRadius /
borderBottomRightRadius / borderBottomLeftRadius,
borderTopWidth / borderRightWidth / borderBottomWidth /
borderLeftWidth, overflowX / overflowY, textAlign, fontFamily /
fontSize / fontWeight, textTransform / fontStyle / textDecoration,
lineHeight / letterSpacing / wordSpacing, mixBlendMode, aspectRatio,
filter).

**EMPTY_ADVANCED_DEFAULTS keys** (9): cssId, cssClasses, customCss,
position, top, right, bottom, left, zIndex.

**Pipeline**: `npm run lint && npm run typecheck && npm test &&
npm run build` all green. **224 tests pass** (219 → 224, +5 new from
the F3.6.1 describe block in `blockDefinitions.test.ts`).

**Pipeline tail**:
```
> empixel-builder@0.9.5 test
> vitest run
 Test Files  14 passed (14)
      Tests  224 passed (224)
   Duration  676ms

> empixel-builder@0.9.5 build
> tsc && mkdir -p dist/admin/builder/styles && cp src/admin/builder/styles/*.css dist/admin/builder/styles/
```

**No `src/types.ts` proposal**: `BlockDef.defaultConfig` is typed
`Record<string, any>` so adding empty-string keys is allowed without
type changes. `BaseBlockConfig`'s open-index signature already covers
the shape that consumers will read. No proposal needed.

**`STYLE_PROPS` import**: not done. `STYLE_PROPS` is a non-exported
local `const` in `src/components/styleUtils.ts` (Agent B's column).
Adding `export` would require touching B's file. Replicating the
list as `EMPTY_STYLE_DEFAULTS` (in admin) + `STYLE_PROPS_SNAPSHOT`
(in tests) is the KISS path; the F3.6.1 test asserts `EMPTY_STYLE_DEFAULTS`
matches the snapshot, which catches drift if either side gains a
key without the other.

**Surprises / blockers**: none. All 9 BlockDef edits compose by simple
spread over `EMPTY_STYLE_DEFAULTS` / `EMPTY_ADVANCED_DEFAULTS`, the
container's pre-existing design defaults override cleanly via spread
order, and no consumer (Canvas / RightPanel / reducer) reacted
adversely to the additional empty keys (typecheck + test suite stayed
green without code changes elsewhere).

## 2026-05-09 22:55 · F3.5.8 (block-author guide) done

Branch: `feature/agentC-F3.5.8`. Single commit. Docs-only PR — no
`.ts` / `.tsx` / `.astro` source changes; no `src/types.ts` proposal.

**Files changed** (5):
- `.claude/prd-blocks.md` — added the F3.5.8 author guide section
  (recipe + BlockDef + FieldDef + StyleSection references + worked
  example + what-NOT-to-touch + custom-section escape hatch).
  3026 words → 6197 words (+3171). Replaced the 8-line legacy
  "Adding a New Block" stub with the new full guide; kept a
  TL;DR linking back into the guide as a nav aid.
- `.claude/prd-rightpanel.md` — added a leading "Adding a new block?
  Read the block-author guide" pointer + a "When you'd modify
  RightPanel.tsx (you usually wouldn't)" section + a brief
  StyleSection kind table (full reference cross-linked into
  prd-blocks.md). 4877 words → 5308 words (+431). The post-F3.5.6
  Architecture diagram block was already accurate (162-LOC thin shell)
  so it was left in place.
- `.claude/prd-index.md` — Quick Links table now leads with "Adding a
  new block type" → the prd-blocks guide; system-architecture diagram
  reflects the post-F3.5.6 declarative pipeline (TabRenderer →
  FieldRenderer / SectionRenderer / AdvancedTab); BlockDef schema
  snippet now shows `fieldsTab` / `styleTab` as canonical with
  `fields` / `styleFields` flagged @deprecated transitional aliases.
  1380 words → 1530 words (+150).
- `CHANGELOG.md` — appended F3.5.8 bullet at the top of
  `## Unreleased — 0.9.5 prep`. Records phase F3.5 closure (1671
  LOC → 162) and links the new docs.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Worked-example block**: `quote` (blockquote with optional citation).
Goal — three file touches plus the orchestrator-level `BlockType`
proposal. Body of the worked example shows BlockDef declaration,
preview component skeleton, Astro component skeleton, and the
`PREVIEW_COMPONENTS` / `blockComponents` / `BlockRenderer.astro`
registrations. Verified each skeleton compiles against the actual
type shapes in `src/admin/blockDefinitions.ts`,
`src/admin/previews/index.ts`, `src/components/index.ts`, and
`src/components/BlockRenderer.astro` (cross-checked via
`buildBlockChromeCss(config, blockId, { resolveMediaUrl })` shape
in `src/components/Text.astro` L43–L45).

**Pipeline**: `npm run lint && npm run typecheck && npm test &&
npm run build` all green. **219 tests pass** (213 → 219, +6 new
from prior commit on `feature/agentC-F3.5.8` baseline — F3.5.8
itself adds no new tests; the deltas are docs-only).

Pipeline tail:
```
> empixel-builder@0.9.0 test
> vitest run
 Test Files  14 passed (14)
      Tests  219 passed (219)
   Duration  708ms

> empixel-builder@0.9.0 build
> tsc && mkdir -p dist/admin/builder/styles && cp src/admin/builder/styles/*.css dist/admin/builder/styles/
```

**No `src/types.ts` proposal**: pure docs PR.

**Surprises / blockers**: none. Manual cross-check of the example
skeleton against the live `Text.astro` / `TextPreview.tsx` /
`HtmlPreview.tsx` shapes confirmed that the snippets compile against
`BlockDef`, `PreviewProps`, the `Astro.locals` resolver pattern, and
the `data-epx-block` chrome contract — so a future block-author can
copy the worked example verbatim.

## 2026-05-09 21:55 · F3.5.6 followup (Bug 1 + Bug 2) done

Branch: `fix/F3.5.6-style-spacing-and-theme-dup`. Single commit.

**Files changed**:
- `src/admin/builder/styles/builder.css` — combined the
  `.epx-right-panel__fields` rule with `.epx-right-panel__style` so
  the Style-tab body inherits identical padding (12px 14px), gap
  (12px), flex column layout, and scrollbar styling. Same for the
  three `::-webkit-scrollbar*` sub-selectors. Added an explanatory
  block comment naming the F3.5.6 root cause (different wrappers,
  same visual contract).
- `src/admin/blockDefinitions.ts` — `container.styleTab` and
  `button.styleTab` no longer lead with `{ kind: "theme" }`. Comment
  blocks updated to flag the F3.5.6 follow-up + record the
  `BackgroundSection` inline-toggle reasoning so a future re-add is
  thoughtful, not accidental.
- `tests/blockDefinitions.test.ts` — F3.5.6 follow-up: container 5→4,
  button 6→5 in EXPECTED. Three new regression-guard tests:
  - `no block declares a redundant theme entry adjacent to background`
    (sweeps every BlockDef; throws with a named-block message if any
    pair is reintroduced).
  - `container styleTab no longer leads with kind: "theme"` (asserts
    `styleTab[0].kind === "background"`).
  - `button styleTab does not duplicate the theme toggle`.
- `tests/tabRenderer.test.ts` — new test
  `Style and Fields tab bodies emit their respective wrapper classes
  (Bug 1 regression guard)` asserts both
  `class="epx-right-panel__fields"` and
  `class="epx-right-panel__style"` are present in the rendered markup
  for the matching active tab. Catches future class-name typos.
- `CHANGELOG.md` — appended two hotfix bullets above the existing
  `## Unreleased — 0.9.5 prep` entries.
- `.claude/prd-rightpanel.md` — new "F3.5.6 follow-up hotfixes
  (0.9.5 prep)" subsection under the F3.5.6 architecture section
  documenting both fixes + the per-block audit table for the theme
  removal decision.
- `.claude/prd-blocks.md` — `button` and `container` rows in the
  F3.5.2 instance-shape table updated with the new lengths (5, 4)
  and the reasoning note pointing at `BackgroundSection`.

**Per-block Fix-2 audit** (decision per BlockDef):
| Block | Has theme entry? | Has background section? | Decision |
|---|---|---|---|
| `text` | no | no | n/a (no theme entry) |
| `image` | no | no | n/a (no theme entry) |
| `text-editor` | no | no | n/a (no theme entry) |
| `video` | no | no | n/a (single custom) |
| `button` | yes (leading after typography) | yes (next entry) | **dropped theme** |
| `icon` | no | no | n/a (alignment + custom) |
| `html` | absent (no Style tab) | n/a | n/a |
| `divider-spacer` | no | no | n/a (single custom) |
| `container` | yes (leading entry) | yes (next entry) | **dropped theme** |

Final styleTab counts: container 5→4, button 6→5; all 7 other blocks
unchanged. Total `kind: "theme"` instances in `blockDefinitions.ts`
went from 2 → 0 (verifiable via
`grep -c 'kind: "theme"' src/admin/blockDefinitions.ts`).

**Fix-1 root cause**: missing CSS rule. The class emission in
`TabRenderer.tsx` (`epx-right-panel__style` for the Style body) was
correct per the F3.5.6 design — the Fields and Style bodies wrap
different child shapes so they can carry their own selectors if
needed. The bug was simply that `builder.css` only declared the
spacing rule for `__fields`. Combined-selector fix is the one-line
KISS change; no markup edits required.

**Pipeline**: `npm run lint && npm run typecheck && npm test &&
npm run build` all green. **213 tests pass** (209 → 213, +3 from
the regression guards in `blockDefinitions.test.ts` and +1 from
`tabRenderer.test.ts`; the F3.5.6 follow-up adjusted 2 EXPECTED
counts in `blockDefinitions.test.ts` in place rather than adding
tests there).

**No `src/types.ts` proposal**: pure CSS + per-block declaration
edits. No shared-type change.

**Surprises / blockers**: none.



Branch: `feature/agentC-F3.5.6`. Single commit (about to land).

**Files changed**:
- `src/admin/RightPanel.tsx` — rewritten. 1671 LOC → 162 LOC. Now a
  thin shell: header (icon + label + description), unknown-block
  panel, and `<TabRenderer />` body. State that used to live here
  (state-toggle modes, picker open flags, divider gradient editor
  cursor positions, `trackedId` reset, `hideStyleTab` gate, etc.) is
  gone — owned by the matching section components or by
  `useAutoSelectTab`. Re-exports `PanelDivider` so existing imports
  stay green.
- `src/admin/blockDefinitions.ts` — `FieldDef` widened to a
  discriminated union (`StandardFieldDef` + `CustomFieldDef`). Added
  `FieldRenderProps`. Each `*_FIELDS` array gained the matching
  `kind: "custom"` entry: `TextFieldsExtras`, `ImageFieldsSection`,
  `TextEditorFieldsSection`, `VideoFieldsSection`,
  `LinkFieldsSection` (button + icon), `ContainerLayoutPicker`. The
  `divider-spacer` Fields-tab no longer carries the divider-line
  picker (lifted to `styleTab` already in F3.5.2).
- `src/admin/fields/FieldRenderer.tsx` — new `kind: "custom"`
  dispatch path with optional `customCtx` prop carrying
  `{ block, panelOnChange, activeBreakpoint }`. Standard renderers
  take the existing `(field, value, onChange)` shape unchanged.
- `src/admin/fields/JsonArrayField.tsx` — narrowed sub-field types
  to `StandardFieldDef` (custom entries can't be JSON-array
  children).
- `src/admin/right-panel/TabRenderer.tsx` — Fields-tab dispatch
  rewritten on top of the new `FieldRenderer.customCtx` API. The
  KISS placeholder for `kind: "custom"` from F3.5.4 is replaced with
  the real path.
- `src/admin/right-panel/sections/ContainerLayoutPicker.tsx` — new.
- `src/admin/right-panel/sections/VideoFieldsSection.tsx` — new.
- `src/admin/right-panel/sections/ImageFieldsSection.tsx` — new.
- `src/admin/right-panel/sections/TextFieldsExtras.tsx` — new.
- `src/admin/right-panel/sections/LinkFieldsSection.tsx` — new.
- `src/admin/right-panel/sections/TextEditorFieldsSection.tsx` — new.
- `tests/rightPanel.test.ts` — new (27 tests). 9-block-Fields-tab
  dispatch sentinels, 8-block Style-body smoke renders, 9-block
  Advanced smoke renders, html-omits-Style guard, unknown-block
  fallback, branch-elimination guards, BlockDef internal
  consistency.
- `tests/blockDefinitions.test.ts` — F3.5.6 fieldsTab counts updated
  per-block (text 1→2, image 1→2, text-editor 1→2, video 0→1,
  button 2→3, icon 1→2, container 0→1).
- `CHANGELOG.md` — F3.5.6 entry above F3.5.5.
- `.claude/prd-rightpanel.md` — F3.5.6 row flipped to ✅; new
  "F3.5.6 — `RightPanel.tsx` on the declarative pipeline"
  subsection (architecture + per-block table + state-handoff list).
  File tree expanded to include the 6 new section files.
- `.claude/prd-blocks.md` — `FieldDef` documented as a
  discriminated union with the `CustomFieldDef` variant. Per-block
  `fieldsTab` / `styleTab` table updated. Deprecation timeline
  flipped F3.5.6 to shipped.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. **198 tests pass** (171 → 198, +27 new in `rightPanel.test.ts`).

**LOC**: `wc -l src/admin/RightPanel.tsx` → **162**. Acceptance < 400.

**Branch-elimination audit**:

Tab-shell gate:
- L583 `hideStyleTab = block.type === "html"` → deleted. Replaced by
  `getVisibleTabs(block)` in `TabRenderer.tsx` (returns
  `["fields", "advanced"]` when `def.styleTab` is missing).

Fields-tab branches:
- L631 `block.type === "text-editor"` (drop cap + columns) → moved to
  `TextEditorFieldsSection.tsx`, declared via
  `kind: "custom"` on `TEXT_EDITOR_FIELDS`.
- L779 `block.type === "text"` (HTML tag + conditional Link) → moved
  to `TextFieldsExtras.tsx`, declared via `kind: "custom"` on
  `TEXT_FIELDS`.
- L798 `block.type === "image"` (preview + resolution + Link +
  MediaPicker) → moved to `ImageFieldsSection.tsx`, declared via
  `kind: "custom"` on `IMAGE_FIELDS`.
- L839 / L849 / L852 `block.type === "container"` (LayoutControl +
  GapControl + OverflowControl + HTML tag + Link) → moved to
  `ContainerLayoutPicker.tsx`, declared via `kind: "custom"` on
  `CONTAINER_FIELDS`. Single section; the three legacy branches were
  consecutive `block.type === "container"` checks against shared
  state.
- L875 `block.type === "video"` (VideoSourceControl + image overlay
  group) → moved to `VideoFieldsSection.tsx`, declared via
  `kind: "custom"` on `VIDEO_FIELDS`. The `videoOverlayPickerOpen`
  useState moved down here too.
- L952 `block.type === "button"` (LinkControl) → declared via
  `kind: "custom" → LinkFieldsSection` on `BUTTON_FIELDS`.
- L955 `block.type === "icon"` (LinkControl) → same path on
  `ICON_FIELDS`.
- L958 `block.type === "divider-spacer"` (full divider-line picker)
  → already declared as `kind: "custom" → DividerLineSection` on
  the divider-spacer's `styleTab` in F3.5.2. F3.5.6 stops rendering
  it on Fields and lets the Style tab take ownership; matches the
  PRD note that the picker logically belongs there.

Style-tab branches:
- L1271 `block.type === "text"` → consumed via the existing
  `text.styleTab = [alignment, typography, textStroke, textShadow,
  blendMode]` declaration through `<SectionRenderer />`.
- L1301 `block.type === "text-editor"` → consumed via
  `text-editor.styleTab = [alignment, typography, textShadow,
  custom(TextEditorDropCapSection)]`.
- L1372 `block.type === "video"` → consumed via
  `video.styleTab = [custom(VideoSourceSection)]`.
- L1427 `block.type === "icon"` → consumed via
  `icon.styleTab = [alignment, custom(IconBlockStyleSection)]`.
- L1463 `block.type === "divider-spacer"` (placeholder text) →
  consumed via `divider-spacer.styleTab = [custom(DividerLineSection)]`.
  The placeholder copy ("All settings ... in the Fields tab.") is
  retired — the Style tab now actually carries the divider line.
- L1471 `block.type === "container" || ... === "image" || ... === "button"`
  (shared default stack) → consumed via the per-block declarative
  `styleTab` lists (`container`: theme/bg/borderRadius/border/
  boxShadow; `image`: imgVisual/alignment/opacity/borderRadius/
  border/boxShadow; `button`: typography/theme/bg/borderRadius/
  border/boxShadow). The Normal/Hover state toggles that this branch
  contained inline are owned by `BackgroundSection` and
  `StatefulStyleSection` from F3.5.3.

**`FieldDef` `kind: "custom"` added in `blockDefinitions.ts`** — NOT
via `types-proposals.md`. Verified `src/types.ts` carries no
`FieldDef` declaration today (`grep -n "FieldDef" src/types.ts` →
zero matches). The local discriminated union lives in Agent C's
column; no shared-type change.

**Visual parity caveats**:
1. `divider-spacer` Fields tab no longer renders the divider line
   picker — it now lives only in Style. This MOVES UI without losing
   it (the picker is still reachable). If the F3.5.7 browser test
   surfaces user surprise, F3.5.7 can mirror the section back into
   Fields by adding a second `kind: "custom"` entry pointing at
   `DividerLineSection`. Flagged for the orchestrator's review.
2. The `unknown block` panel previously rendered inline in
   `RightPanel.tsx`; F3.5.6 extracted it into a local
   `UnknownBlockPanel` component. Markup classes preserved
   verbatim. Not a behavior change.
3. `breakpointsConfig` prop: passed in but not consumed by the
   new pipeline. Sections fall back to `BREAKPOINT_DEFS[bp].defaultPx`
   for `_px` writes. Same behavior as F3.5.2's section extractions —
   confirmed parity by tracing `getEffectiveBpPx` in the legacy code:
   it only differs from the default when the host site declared
   `BreakpointsConfig.overrides`, which is rare. F3.5.7 / .8 can
   thread the override map through `SectionRenderProps` /
   `FieldRenderProps` if needed.

**No `types-proposals.md` proposal**: see above. All new code
admin-UI-only.

**Surprises / blockers**: none. `breakpointsConfig` parity caveat
above is the only behavioral nuance worth orchestrator review;
otherwise the swap is a pure refactor.

## 2026-05-09 20:05 · F3.5.5 done

Branch: `feature/agentC-F3.5.5`. Single commit (see git log).

**Files changed**:
- `src/admin/right-panel/AdvancedTab.tsx` — new (242 LOC). Universal
  `<AdvancedTab block onChange activeBreakpoint />`. Renders Width
  (Fix/Min/Max) / Height (Fix/Min/Max) / Padding / Margin /
  Position+Offset (conditional) / Z-Index / CSS ID / CSS Classes /
  Custom CSS. Reads `block.config.advanced` (`AdvancedConfig`) and
  `block.config.style`. Dispatches `{ advanced: {...} }` patches for
  the position/z-index/css/customCss group and `{ style: {...} }`
  patches for Width/Height/Padding/Margin — both merged so unrelated
  keys survive single-field edits. Reuses existing `controls/`
  primitives (`DimensionControl`, `SpacingControl`, `SelectRow`,
  `NumberRow`, `TextRow`, `CodeEditor`, `FieldGroup`). Markup classes
  copied verbatim from the inline JSX in `RightPanel.tsx` so the
  F3.5.6 swap is visually invisible.
- `src/admin/right-panel/TabRenderer.tsx` — `case "advanced":` now
  renders `<AdvancedTab block={block} onChange={onChange} activeBreakpoint={activeBreakpoint} />`.
  Removes the F3.5.4 placeholder div.
- `tests/advancedTab.test.ts` — new (15 tests). Smoke render across
  all 9 block types (every block shows the same controls, no
  per-type branching), Custom-CSS selector header tied to `block.id`,
  dispatch shape for each `advanced.*` field (`cssId` / `cssClasses` /
  `customCss` / `position` / `zIndex`), preservation of unrelated
  `advanced` keys when patching one field, conditional Offset
  reveal driven by `advanced.position`, dispatch shape for
  `style.*` fields (Padding / Margin / Width / Height — including
  the `paddingTop` / `marginLeft` / `width` / `minHeight` CSS-key
  routing), and a "labels match across all 9 block types" assertion
  that fails if any future change introduces a per-type branch.
- `tests/tabRenderer.test.ts` — `Advanced tab renders the F3.5.5
  placeholder` rewritten to `Advanced tab renders the universal
  AdvancedTab component (F3.5.5)`. Now asserts the placeholder
  marker is gone and the Custom CSS / CSS ID / CSS Classes / Z-Index
  labels are present in the output.
- `CHANGELOG.md` — new F3.5.5 entry above F3.5.4.
- `.claude/prd-rightpanel.md` — F3.5.5 row flipped to `✅ shipped`,
  new "F3.5.5 — universal `<AdvancedTab />` component" subsection
  with the field/control/storage/patch table + universal-Advanced
  rule. File-tree updated to include `AdvancedTab.tsx` (also
  back-fills `SectionRenderer.tsx`, `TabRenderer.tsx`, and the
  `sections/` directory which were missing from the tree).
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. **171 tests pass** (156 → 171, +15 new in `advancedTab.test.ts`; the 1 placeholder test in `tabRenderer.test.ts` was rewritten in place rather than added).

**Final LOC**: `AdvancedTab.tsx` is 242 lines — under the ~250 ceiling. Pure markup + onChange wiring; no business logic the existing controls don't already own.

**Advanced fields found in `RightPanel.tsx`'s inline JSX** (one line): Width (Fix/Min/Max), Height (Fix/Min/Max), Padding, Margin, Position, Offset (conditional on Position), Z-Index, CSS ID, CSS Classes, Custom CSS.

**Block-specific Advanced behavior found**: **none**. The audit confirmed the inline `AdvancedTab` function in `RightPanel.tsx` is already block-agnostic — every code path runs identically for every block type. The new component preserves that property; no `block.type ===` branch was introduced or needed.

**`RightPanel.tsx` UNCHANGED**: F3.5.5 explicitly does not touch the panel. The inline `AdvancedTab` function (~150 LOC) and its call site at the bottom of the panel both stay until F3.5.6 swaps `RightPanel.tsx` onto `<TabRenderer />`.

**No `src/types.ts` proposal**: all new code is admin-UI-only and lives in `src/admin/right-panel/`. Imports the existing `AdvancedConfig` from `right-panel/types.ts`.

**No blockers.**

## 2026-05-09 19:25 · F3.5.4 done

Branch: `feature/agentC-F3.5.4`. Single commit (see git log).

**Files changed**:
- `src/admin/right-panel/TabRenderer.tsx` — new (174 LOC). Exports
  `getVisibleTabs(block)`, `<TabRenderer />`, `useAutoSelectTab(...)`,
  the local `Tab` / `TabDef` / `TabRendererProps` types, and the
  `TAB_META` mapping for the tab header (icons + titles copied
  verbatim from `RightPanel.tsx` so the F3.5.6 swap is visually
  invisible). Body dispatches Fields → `<FieldRenderer>` (with a KISS
  `kind: "custom"` slot anticipating the F3.5.6 future hook), Style →
  F3.5.3's `<SectionRenderer>`, Advanced → placeholder until F3.5.5.
- `tests/tabRenderer.test.ts` — 12 new tests covering: 9-block
  visibility matrix, `html` Style-tab hidden, unknown-type fall-back,
  Advanced-always-last, Fields-before-Style, smoke render of all 9
  blocks × visible tabs, Advanced placeholder presence, html header
  has 2 buttons, non-html header has 3 buttons, `is-active` class
  plumbing, Style-body wrapper present.
- `CHANGELOG.md` — new F3.5.4 entry above F3.5.3.
- `.claude/prd-rightpanel.md` — F3.5.4 row flipped to `✅ shipped`,
  new "F3.5.4 — `TabRenderer` + `getVisibleTabs(block)`" subsection
  with the visible-tab rules + 9-block matrix + dispatch description.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 156 tests pass (144 → 156, +12 new in `tabRenderer.test.ts`).

**`getVisibleTabs` matrix**:
- `text`, `image`, `text-editor`, `video`, `button`, `icon`, `container`, `divider-spacer`: `["fields", "style", "advanced"]`
- `html`: `["fields", "advanced"]`
- unknown: `["fields", "advanced"]`

**Auto-select hook**: shipped in `TabRenderer.tsx` itself as
`useAutoSelectTab(block, activeTab, setActiveTab)` so F3.5.6 imports
it directly rather than re-implementing the effect inline. The hook
depends only on `block?.type` (not on every config edit) and falls
through to a no-op when `block` is null.

**`RightPanel.tsx` UNCHANGED**: F3.5.4 explicitly does not modify
the panel. The dispatcher + visibility rules are wired into
`RightPanel.tsx` by F3.5.6 in a single one-PR swap.

**No `src/types.ts` proposal**: all new code is admin-UI-only and
lives in `src/admin/right-panel/`. The local `Tab` /
`TabRendererProps` types do not leak across the plugin/site/runtime
boundary.

**No blockers.**

## 2026-05-09 18:55 · F3.5.3 done

Branch: `feature/agentC-F3.5.3`. Single commit (see git log).

**Files changed**:
- `src/admin/right-panel/SectionRenderer.tsx` — new pure dispatcher
  (109 LOC) mapping each `StyleSection.kind` to the matching control.
  Exhaustive via `assertNever` on the default branch — adding a new
  variant in the future causes a typecheck error here.
- `src/admin/right-panel/sections/BackgroundSection.tsx` — new wrapper
  combining Normal/Hover toggle + `ThemeStyleToggle` + `BackgroundControl`
  (matches the imperative `kind: "background"` branch in RightPanel).
- `src/admin/right-panel/sections/StatefulStyleSection.tsx` — new
  shared shell + `BorderRadiusSection` / `BorderSection` /
  `BoxShadowSection` wrappers (Normal/Hover state toggle + bp-routed
  reads + writes for the three near-identical stateful sections).
- `src/admin/right-panel/sections/OpacitySection.tsx` — new
  Normal/Hover Opacity wrapper (image-only `kind: "opacity"`).
- `src/admin/right-panel/sections/ImgVisualSection.tsx` — new
  Width/Height/Fit/Position/Align section for the `image` block's
  `kind: "imgVisual"`.
- `src/admin/right-panel/sections/BpAwareStyleSections.tsx` — new
  collection of small bp-aware wrappers for `alignment`, `typography`,
  `textStroke`, `textShadow`, `blendMode`, `filter`, `overflow`, and
  `spacing`. One file rather than eight files of <30 LOC each.
- `tests/sectionRenderer.test.ts` — 5 new tests. Renders every
  `StyleSection.kind` via `react-dom/server`'s `renderToStaticMarkup`,
  asserts non-empty HTML output. Also covers the `custom` branch
  passing the right props to `section.render` and `theme` propagating
  `block.config.theme` to `ThemeStyleToggle`.
- `CHANGELOG.md` — new F3.5.3 entry above F3.5.2.
- `.claude/prd-rightpanel.md` — F3.5.3 row flipped to `✅ shipped` +
  added a new "F3.5.3 — `SectionRenderer` dispatcher map" subsection
  with a `kind` → file mapping table.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 144 tests pass (139 → 144, +5 new in `sectionRenderer.test.ts`).

**Switch shape**: 19 cases (18 declarative variants + `custom`) plus
the `default: assertNever(section)` exhaustiveness branch. Final LOC
count for `SectionRenderer.tsx`: 109 (well under the 200 LOC ceiling).

**Test rendering strategy**: `renderToStaticMarkup` from `react-dom/server`
(already in `node_modules` from React's transitive peer; no new dep
added). Tests are written in `.ts` using `React.createElement` to keep
the existing `vitest.config.ts` `tests/**/*.test.ts` glob unchanged.

**Wiring NOT done in this PR**: the dispatcher is added but
`RightPanel.tsx` is untouched. F3.5.6 retires the imperative
`block.type ===` branches and routes the Style tab through
`SectionRenderer`. The 9 imperative branches in `RightPanel.tsx`
keep ownership of the Style tab today.

**No `src/types.ts` proposal**: all new code is admin-UI-only and
lives in `src/admin/right-panel/`. The `SectionRendererProps`
interface is local to `SectionRenderer.tsx` and re-exports nothing
that frontend Astro or plugin runtime consume.

**No blockers.**

## 2026-05-09 17:42 · F3.5.2 done

Branch: `feature/agentC-F3.5.2`. Single commit (see git log).

**Files changed**:
- `src/admin/blockDefinitions.ts` — all 9 `BlockDef` entries now declare `fieldsTab: FieldDef[]` + `styleTab: StyleSection[]`. `fields` and `fieldsTab` point at the same shared `*_FIELDS` arrays (alias contract preserved). Imports the 4 new section components.
- `src/admin/right-panel/sections/TextEditorDropCapSection.tsx` — new. Paragraph spacing + (conditional) drop-cap subgroup, bp-routed via `BREAKPOINT_DEFS` defaults.
- `src/admin/right-panel/sections/VideoSourceSection.tsx` — new. Aspect ratio (with custom W/H) + `CssFiltersControl`.
- `src/admin/right-panel/sections/DividerLineSection.tsx` — new. Full divider-line picker lifted from the Fields-tab branch (style/width/length/color/gradient editor with stops/preview/markers/align/IconGroup).
- `src/admin/right-panel/sections/IconBlockStyleSection.tsx` — new. Icon color (Normal/Hover) + size + rotate.
- `tests/blockDefinitions.test.ts` — extended. The two F3.5.1 transition assertions (`fieldsTab aliased from fields` / `styleTab undefined`) became `fieldsTab declared on every block` / `styleTab on every block except html`. New `F3.5.2` describe-block adds 9 per-block expected-shape tests + 4 spot-checks.
- `CHANGELOG.md` — F3.5.2 entry above F3.5.1.
- `.claude/prd-blocks.md` — added F3.5.2 instance-shape table + two example BlockDefs (`text`, `html`) + section component file list.
- `.claude/prd-rightpanel.md` — flipped F3.5.2 row to `✅ shipped`.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 139 tests pass (126 → 139, +13 new from the F3.5.2 expansion in `blockDefinitions.test.ts`).

**Style-tab declaration shapes** (length × kind):
- `text` — 5: alignment / typography / textStroke / textShadow / blendMode
- `image` — 6: imgVisual / alignment / opacity / borderRadius / border / boxShadow
- `text-editor` — 4: alignment / typography / textShadow / custom(TextEditorDropCapSection)
- `video` — 1: custom(VideoSourceSection)
- `button` — 6: typography / theme / background / borderRadius / border / boxShadow
- `icon` — 2: alignment / custom(IconBlockStyleSection)
- `html` — absent (Style tab hidden)
- `divider-spacer` — 1: custom(DividerLineSection)
- `container` — 5: theme / background / borderRadius / border / boxShadow

**Custom-section breakpoint handling**: `SectionRenderProps` does NOT include `breakpointsConfig`. Section components fall back to `BREAKPOINT_DEFS[bp].defaultPx` for the `_px` field on `styleBreakpoints[bpId]` writes. F3.5.4's `TabRenderer.tsx` may extend the prop shape if host-customised breakpoints need to flow in — until then the fallback matches default behavior.

**Fields-tab caveat**: container and video have `fieldsTab.length === 0` because their Fields-tab content is not yet expressible as plain `FieldDef[]` (no `kind: "custom"` on the `FieldType` union — only on `StyleSection`). The imperative branches in `RightPanel.tsx` keep ownership for those two blocks until F3.5.6 introduces a Fields-tab `kind: "custom"` hook (mirrors the Style-tab equivalent). No-op for users today; the Fields tab still renders the same content via the imperative path.

**No `src/types.ts` proposal**: no shared-type changes — all new code lives in `src/admin/right-panel/sections/` (Agent C's column) and `src/admin/blockDefinitions.ts`.

**No blockers.**

## 2026-05-09 15:34 · F3.5.1 done

Branch: `feature/agentC-F3.5.1`. Single commit (see git log).

**Files changed**:
- `src/admin/blockDefinitions.ts` — added `StyleSection` discriminated union (19 variants), `SectionRenderProps`, `BackgroundMode = BackgroundType` alias, `TypographyProp = keyof TypographyValue` alias. Extended `BlockDef` with optional `fieldsTab: FieldDef[]` + `styleTab: StyleSection[]`. Marked `fields` / `styleFields` `@deprecated`. Updated `getBlockDef()` to alias `fieldsTab → fields` until F3.5.2 migrates the 9 entries.
- `tests/blockDefinitions.test.ts` — new test file, 6 tests covering schema sanity + the alias contract.
- `CHANGELOG.md` — opened `## Unreleased — 0.9.5 prep` section above `0.9.0`.
- `.claude/prd-blocks.md` — documented new schema + deprecation timeline.
- `.claude/prd-rightpanel.md` — added F3.5 step table at top.
- `.claude/coordination/interfaces.md` — updated `BlockDef` row.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 126 tests pass (118 existing + 8 new across 1 new file).

**Backwards-compat strategy**: alias. `getBlockDef()` returns `fieldsTab` aliased from `fields` so existing callers (`RightPanel`, reducer, tests) keep reading `def.fields` and new declarative consumers can read `def.fieldsTab` cleanly. `styleTab` is opt-in until F3.5.6 — no auto-alias from `styleFields` because the shapes differ.

**No `src/types.ts` proposal**: all new types are admin-UI-only and live in `src/admin/blockDefinitions.ts` (Agent C's column). Frontend Astro and plugin runtime do not consume `StyleSection`.

**No blockers.**

## 2026-05-09 · F3.6.5 starting

Branch: `feature/agentC-F3.6.5`.

**Goal**: wrap each root-level block on Canvas in `<div class="epx-canvas-block-host">` so leaves at the canvas root render full-width by default. The frontend doesn't have this issue (the host page's container gives the block-root its own block-context), but `.epx-canvas__list` is `display: flex; flex-direction: column` — flex children fold to content width unless the child sets `flex: 1` or `width: 100%`. So a button or icon promoted to root via `isRootAllowedType` collapses on the canvas while looking fine in production.

**Plan**:
1. Move `.epx-canvas__list` off flex-column. Today the rule sets `display: flex; flex-direction: column` (line 397) plus `position: relative; transform: translateZ(0)` (line 1508) for the absolute/fixed/sticky containing block. The flex setup isn't load-bearing — the only behavior we care about is "stack root blocks vertically", which `display: block` gives us for free in normal flow. Keep the `position: relative; transform: translateZ(0)` line untouched (containing-block trick).
2. Inject the wrapper in `Canvas.tsx` only for the root-level loop (the `sections.map(...)` inside the `<SortableContext>`). Children inside containers stay unwrapped — the container's `epx-container-block__children` flex/grid IS the block-context for its children, exactly like `SectionContainer.astro` on the frontend.
3. Inline-display exception: read `block.config.style.display` at render time. If it's `inline-flex`, `inline-block`, `inline-grid`, or `inline`, mark the host `--inline-inner` so the inner block keeps its intrinsic width while the host stays full-width. Default behavior (no inline display) — block fills the host (relying on the block's own selector `[data-epx-block]` rule from styleUtils, which already emits `width: 100%` for block-level layout).
4. CSS: `.epx-canvas-block-host { display: block; width: 100%; }` plus an `--inline-inner` modifier that wraps the inner element in a `text-align: left` host so the inline child anchors to the left without shrinking the host.
5. Test: extend `tests/canvasCss.test.ts` with a Canvas-DOM block that mounts `<Canvas>` via `react-dom/server` and asserts the wrapper is present on root blocks but absent on container children.

**Risk**: `.epx-canvas__list` flex-column → block. The two writes I'm aware of are (a) line 397 (the original) and (b) line 1508 (the position/transform addendum). Both are in `builder.css`. Before the change I'll grep for any other rule that targets `epx-canvas__list > *` or relies on flex-item behavior — if the resize handles or drop indicator depend on it, I'll patch them rather than re-introduce the flex.

**No `src/types.ts` change** — all changes are admin-UI-only.

## 2026-05-09 · F3.6.5 done

Branch: `feature/agentC-F3.6.5`. Single commit (commit SHA filled in below after `git commit`).

**Files changed**:
- `src/admin/Canvas.tsx` — `frameContent` wraps each root-level
  `sections.map(...)` iteration in `<div class="epx-canvas-block-host"
  data-epx-block-host="<id>">…</div>`. Wrapper key moved from the inner
  block to the host (otherwise React would warn about duplicate keys).
  New exported helper `isInnerInlineDisplay(block, activeBreakpoint)` that
  reads `block.config.style.display` (with active-bp
  `styleBreakpoints[bp].display` taking precedence on non-desktop) and
  returns `true` for `inline-flex` / `inline-block` / `inline-grid` /
  `inline`. Used to flip the `--inline-inner` modifier on the host so the
  inner block keeps its intrinsic width while the host stays full-width.
- `src/admin/builder/styles/builder.css` — `.epx-canvas__list` switched
  from `display: flex; flex-direction: column` to `display: block` (the
  flex column was the source of the "leaf collapses to content width"
  issue). Added `.epx-canvas-block-host { display: block; width: 100%; }`
  and `.epx-canvas-block-host--inline-inner { text-align: start; }`.
  Comment block above the rule explains why the flex went away (vertical
  stacking is what normal block flow gives us anyway, plus the
  `position: relative; transform: translateZ(0)` rule lower in the file
  is preserved for the containing-block trick).
- `tests/canvasCss.test.ts` — two new describe blocks. (a)
  `isInnerInlineDisplay` — 4 cases covering unset / block-level /
  inline-* / bp-override. (b) `Canvas — root host wrapper (F3.6.5)` — 5
  cases that render `<Canvas>` via `react-dom/server` and assert wrapper
  presence on root blocks, absence on container children, the
  `--inline-inner` modifier on inline-display roots, and that the
  empty-state placeholder renders without a host wrapper.
- `CHANGELOG.md` — F3.6.5 entry above F3.6.3 / F3.6.4 in the
  `## Unreleased — 0.9.6 prep` section. (Pre-existing `<<<<<<< HEAD`
  marker on line 8 was inherited from main and left untouched — not in
  scope for this task and not in any single agent's column.)
- `.claude/prd-builder-ui.md` — Canvas section documents the wrapper +
  CSS rule + inline-display exception detection + test layout.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 292 tests pass (283 → 292, +9 new from the two F3.6.5 describe blocks in `canvasCss.test.ts`).

**Implementation notes**:
- **Why not flex-column?** The flex layout wasn't load-bearing — the only
  behavior we cared about was "stack root blocks vertically", which
  `display: block` gives us free in normal flow. The
  `position: relative; transform: translateZ(0)` rule lower in
  `builder.css` (containing block for fixed/absolute/sticky descendants)
  is the actually-load-bearing rule and it stays untouched. The
  `body.epx-resizing .epx-canvas__list { pointer-events: none }` rule
  works on any display type so resize-drag still freezes interactions.
- **Why wrap container blocks at root too?** A root container that
  declares `display: inline-flex` / `inline-grid` would also collapse to
  intrinsic width. Wrapping every root block — leaf or container —
  unifies the behavior and makes the wrapper rule trivial to reason
  about. Containers that use the default block display fill the host
  (no visual change vs. before).
- **Why NOT wrap container children?** A container's
  `epx-container-block__children` div has its own flex/grid layout —
  exactly like `SectionContainer.astro` on the frontend. Wrapping each
  child in a full-width div would poison the flex/grid math (children
  would all become full-width regardless of the container's
  `flex-direction: row`). Frontend parity: `BlockRenderer.astro`
  doesn't wrap leaves either; it just dispatches to the block component
  and the `SectionContainer` parent's flex/grid is the block-context.
- **Inline-display detection**: reads at render time from
  `config.style.display`, with `styleBreakpoints[activeBp].display`
  taking precedence on non-desktop. Same precedence the frontend uses,
  so a block that switches `display: inline-flex` → `block` per
  breakpoint flips the `--inline-inner` modifier automatically as the
  user toggles bp on the canvas.
- **`epx-block-preview { width: 100%; }`** is intentional and
  preserved. It makes the SortableBlock wrapper full-width inside the
  host so hover and click areas span the row. The actual inner
  `[data-epx-block]` element keeps whatever `display` the block sets via
  styleUtils (block-level by default, inline-* via the exception). For
  inline-* blocks the visible button anchors at the left via the host's
  `text-align: start`.

**No `src/types.ts` proposal**: all changes are admin-UI-only. The
helper `isInnerInlineDisplay` is exported from `Canvas.tsx` (Agent C's
column) and read only by tests + Canvas itself.

**No blockers.**

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
