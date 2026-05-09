# Cross-agent interfaces

Contracts between domains. The owner exposes the symbol; consumers import it. Adding a new contract or changing an existing one is a coordinator-mediated event:

1. Owner appends a proposal at the bottom of this file under "Pending changes".
2. Orchestrator pings affected consumers in `blocked/` (or via `status/`) and waits for ACK.
3. Once acknowledged, owner implements and the row in the table below moves to `Status: stable`.

`src/types.ts` changes follow the **separate** flow in `types-proposals.md` — never edit `src/types.ts` directly from an agent branch.

## Stable / planned interfaces

| Interface | Owner | Consumers | Defined in | Status |
|-----------|-------|-----------|------------|--------|
| `resolveMediaUrl(key: string \| null \| undefined, opts?: { locals?: { emdash?: { getPublicMediaUrl?: (k: string) => string \| undefined } } }) => string \| null` | B | A (admin route URL building), C (admin previews) | `src/components/media.ts` | ✅ stable — F2.2 shipped 2026-05-09 |
| `getBuilderLayout(astro: BuilderLayoutContext, collection: string, entryId: string, enabled?: boolean): Promise<BuilderLayoutResult>` where `BuilderLayoutContext = { locals?: { emdash?: { db?: unknown; getPublicMediaUrl?: (k: string) => string \| undefined } } }` and `BuilderLayoutResult = { sections: SectionBlock[] \| null; cacheHint: { tags?: string[]; lastModified?: Date } }` | B (since F3.4) | EmDash host site, `BuilderWrapper.astro` | `src/components/db.ts` | ✅ stable — F3.4 shipped 2026-05-09. Async, takes `Astro` (or any `BuilderLayoutContext`) as the first arg. Reads via `Astro.locals.emdash.db` (Kysely) against the shared `_plugin_storage` table partitioned under `plugin_id="empixel-builder", collection="layouts"`; falls back to legacy `empixel_builder_layouts` SQLite via `getDb()` from `dbShared.ts` for one version. F3.5 drops the fallback + better-sqlite3 peer. KISS — no separate `getBuilderLayoutFromContext` symbol; `getBuilderLayout` IS the context-aware helper now (the v0.8 sync overload was an internal-only shape carried over from v0.7). Public API break vs. v0.8: hosts must (1) `await` the call and (2) pass `Astro` first. `BuilderWrapper.astro` accepts the resolved value, the unawaited Promise, AND the legacy `SectionBlock[] \| null` shape. Re-exported from `empixel-builder/components` (lifted the F2.4 deep-import debt) along with `BuilderLayoutResult`, `BuilderCacheHint`, `BuilderLayoutContext`, and `builderLayoutCacheTag`. |
| `SectionBlock`, `BlockType`, `StyleSection`, `AdvancedConfig`, breakpoint types | 🔒 Orchestrator | A, B, C | `src/types.ts` | ✅ partially exists; `StyleSection` added in F3.5 via proposal |
| `StorageLayoutsCollection = StorageCollection<LayoutRow>` where `LayoutRow = { collection: string; entryId: string; enabled: 0 \| 1 \| boolean; sections: SectionBlock[]; createdAt?: string; updatedAt?: string }` | A | B (frontend reader F3.4) | `src/storage-types.ts` | ✅ stable — F3.1 shipped 2026-05-09. Plugin declares `storage.layouts` with `indexes: [["collection", "entryId"]]` + `uniqueIndexes: [["collection", "entryId"]]`. EmDash provisions the collection on `ctx.storage.layouts` via the shared `_plugin_storage` table (separate from the legacy `empixel_builder_layouts` SQL table — coexists during F3.2/F3.3 migration). Additive only in F3.1; F3.2 rewrites routes onto `ctx.storage`, F3.3 migrates rows, F3.5 drops the legacy table + better-sqlite3 peer. |
| `BlockDef`, `FieldDef`, `StyleSection`, `SectionRenderProps`, `BackgroundMode`, `TypographyProp` | C | A (validation at save), B (rendering hint, optional) | `src/admin/blockDefinitions.ts` (re-exports `BlockType` from `src/types.ts`) | ✅ extended F3.5.1 (2026-05-09): `BlockDef` now exposes optional `fieldsTab: FieldDef[]` + `styleTab: StyleSection[]`; legacy `fields` / `styleFields` kept as `@deprecated` aliases. `getBlockDef()` returns `fieldsTab` aliased from `fields` until F3.5.2 populates instances. `StyleSection` is the 19-variant discriminated union (theme/spacing/background/border/borderRadius/boxShadow/typography/textStroke/textShadow/alignment/blendMode/filter/overflow/opacity/imgVisual/videoSource/iconGroup/dividerLine/custom). `BackgroundMode` aliases `BackgroundType` from `controls/BackgroundControl.tsx`; `TypographyProp = keyof TypographyValue` from `controls/TypographyControl.tsx`. F3.5.6 retires `fields` / `styleFields`. |
| `buildBlockChromeCss(config, blockId, opts)` | B | C (Canvas uses identical helper) | `src/components/styleUtils.ts` | ✅ partial — needs export surface review in F3.6.3 |
| `buildBlockCss`, `buildHoverCss`, `buildBreakpointCss`, `buildBreakpointHoverCss`, `getCustomCss`, `getEffectiveStyle` | B | C (Canvas), B itself (Astro) | `src/components/styleUtils.ts` | ✅ exists; `buildBackgroundCss` / `buildBlockStyle` / `buildDarkBlockStyle` / `buildBlockCss` / `buildHoverCss` / `buildBlockChromeCss` / `getVideoBackground` / `getVideoInfo` opts now extend `MediaUrlOptions` (F2.2) — pass `{ resolveMediaUrl }` to route storage keys through the host's storage adapter |
| `darkBlockSelector(blockId)` | B | B internally | `src/components/styleUtils.ts` | ✅ exists; F1.2 rewrites it to cover `html.dark`, `[data-theme="dark"]`, `[data-mode="dark"]`, self |
| `BASE_DEFAULTS` + `getDefaultBlockConfig(type)` | C | C (reducer ADD_BLOCK + load), tests | `src/admin/blockDefinitions.ts` | 🆕 F3.6.2 |
| `runSpacerMigration` (existing pattern) / `runLegacySpacingMigration_v1` | A | A internally (cold start) | `src/plugin.ts` (or `src/migrations/*`) | ✅ pattern exists; new migration in F3.6.4 |
| `migration_to_storage_v1` flag (KV) | A | A | `empixel_builder_meta` KV | 🆕 F3.3 |
| Plugin options shape `empixelBuilder({ databasePath? })` | A | EmDash host site (user `astro.config.mjs`) | `src/index.ts` | 🆕 F1.5 — `databasePath` added; removed in F3.5 (drop better-sqlite3 peer) |
| `BlockErrorBoundary` placeholder UX | C | C (RightPanel for unknown block types) | `src/admin/components/BlockErrorBoundary.tsx` | ✅ exists |

## Capability changes (Agent A)

| Old | New | Phase |
|-----|-----|-------|
| `read:content` | `content:read` | F1.1 — both still aliased by EmDash, but marketplace publish requires the new form |

## Pending changes

*(Append new proposals below. Format: heading with date + agent + title, then a body explaining what, why, who's affected. Mark resolved proposals as `[resolved]` and leave them in place for history.)*

### 2026-05-09 — Agent A — re-export `BuilderLayoutResult` / `BuilderCacheHint` / `builderLayoutCacheTag` from `src/components/index.ts` [resolved by F3.4]

F2.4 added the new types and `builderLayoutCacheTag(...)` helper to
`src/components/db.ts` (Agent A's column). The public package surface
is `empixel-builder/components` which goes through
`src/components/index.ts` (Agent B's column). Today the file only
re-exports `getBuilderLayout` itself — external consumers wanting the
result type have to deep-import from `empixel-builder/components/db`,
which is awkward and not how the rest of the public API is shaped.

Proposed addition to `src/components/index.ts` (one diff hunk):

```ts
export { getBuilderLayout, builderLayoutCacheTag } from "./db.js";
export type { BuilderCacheHint, BuilderLayoutResult } from "./db.js";
```

No runtime change. Agent B owns the file; Agent A would have made the
change in F2.4 but the task scope locked the cross-domain edit to
`BuilderWrapper.astro` only. Pickup target: Agent B in the next
sweep or anytime before F3.4 (which folds into the wider B-owned
rewrite of the reader).
