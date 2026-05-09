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

## 2026-05-09 19:50 · F3.5.5 started

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

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
