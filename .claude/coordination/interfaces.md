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
| `getBuilderLayout(collection: string, entryId: string, enabled?: boolean): BuilderLayoutResult` where `BuilderLayoutResult = { sections: SectionBlock[] \| null; cacheHint: { tags?: string[]; lastModified?: Date } }` | A (until F3.4 → B) | EmDash host site, `BuilderWrapper.astro` | `src/components/db.ts` | ✅ stable — F2.4 shipped 2026-05-09. `cacheHint.tags = ["empixel:layout:<collection>:<entryId>"]` always; `lastModified` parsed from the row's `updated_at` when the row exists. `BuilderWrapper.astro` plumbs the hint into `Astro.cache.set` automatically; manual consumers destructure and call set themselves. Public API break vs. v0.7 — older hosts that imported `getBuilderLayout` directly need to migrate. F3.4 will additionally change the signature to `(Astro, collection, entryId)`. |
| `getBuilderLayoutFromContext(Astro, collection, entryId)` | B | EmDash host site | `src/components/db.ts` | 🆕 F3.4 — replaces direct better-sqlite3 use |
| `SectionBlock`, `BlockType`, `StyleSection`, `AdvancedConfig`, breakpoint types | 🔒 Orchestrator | A, B, C | `src/types.ts` | ✅ partially exists; `StyleSection` added in F3.5 via proposal |
| `StorageLayoutsCollection` (ctx.storage shape) | A | B (frontend reader) | `src/storage-types.ts` | 🆕 F3.1 — not implemented yet |
| `BlockDef`, `FieldDef` | C | A (validation at save), B (rendering hint, optional) | `src/admin/blockDefinitions.ts` (re-export base types from `src/types.ts`) | ✅ exists; extended in F3.5 |
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

### 2026-05-09 — Agent A — re-export `BuilderLayoutResult` / `BuilderCacheHint` / `builderLayoutCacheTag` from `src/components/index.ts`

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
