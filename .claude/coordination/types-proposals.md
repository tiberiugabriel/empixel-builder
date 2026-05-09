# `src/types.ts` change proposals (append-only)

`src/types.ts` is orchestrator-owned. Agents never modify it directly. To request a change, append a new entry at the bottom of this log. The orchestrator reviews, applies the change in a dedicated `chore: types — <summary>` PR, and notifies all consumers to rebase.

## Format

```
## YYYY-MM-DD · agent-{a|b|c} · <short title>

**Reason**: 1–3 sentences on why the change is needed and which task it unblocks.

**Proposed diff** (or signature):
\`\`\`ts
// before
...
// after
...
\`\`\`

**Consumers affected**: list of files/agents that import from `src/types.ts` and will need to rebase or adapt.

**Status**: open | accepted YYYY-MM-DD | rejected YYYY-MM-DD (reason)
```

## Proposals

## 2026-05-09 · agent-c · Add "field-binding" to BlockType

**Reason**: F4.4 introduces a new block kind that reads its content from
`entry.data[config.field]` instead of carrying its own content. Per Q7
in the master report, `field-binding` is the new block type the
LeftPanel "Bound to this entry" palette section creates. Without
extending the union the new BlockDef cannot register (`BlockDef.type:
BlockType`) and `stripUnknownBlocks` (used by both `plugin.ts` save
path and `db.ts` reader at L267 / L565) would silently drop instances
on read. Investigated the local-extension path first per the brief —
not viable: `BlockType` is a string-literal type alias, not extensible
via declaration merging, and `BLOCK_TYPES` / `isKnownBlockType` are
runtime gates that need the new entry too.

**Proposed diff**:
```ts
// before — src/types.ts
export type BlockType =
  | "container"
  | "text"
  | "image"
  | "text-editor"
  | "video"
  | "button"
  | "icon"
  | "html"
  | "divider-spacer";
// ...
export const BLOCK_TYPES: ReadonlySet<string> = new Set<BlockType>([
  "container",
  "text",
  "image",
  "text-editor",
  "video",
  "button",
  "icon",
  "html",
  "divider-spacer",
]);

// after
export type BlockType =
  | "container"
  | "text"
  | "image"
  | "text-editor"
  | "video"
  | "button"
  | "icon"
  | "html"
  | "divider-spacer"
  | "field-binding";
// ...
export const BLOCK_TYPES: ReadonlySet<string> = new Set<BlockType>([
  "container",
  "text",
  "image",
  "text-editor",
  "video",
  "button",
  "icon",
  "html",
  "divider-spacer",
  "field-binding",
]);
```

No change to `CONTAINER_TYPES` (field-binding holds no children) and no
change to `ROOT_ALLOWED_TYPES` (field-binding is a leaf — must live
inside a container, like text/image).

**Consumers affected**:
- C — `src/admin/blockDefinitions.ts` adds the new BlockDef entry,
  `src/admin/previews/index.ts` adds the `field-binding` key (the
  `Record<BlockType, …>` map will fail to compile until both the union
  is extended and the entry is added — they need to land together).
- C — `src/admin/LeftPanel.tsx` adds the "Bound to this entry" palette
  section that drag-creates `field-binding` blocks.
- B — `src/components/index.ts` registers `FieldBinding` in
  `blockComponents`; `src/components/BlockRenderer.astro` adds the
  dispatch case (cross-domain edits documented as an F4.4 exception
  per the multi-agent allocation table in the report).
- A — `src/plugin.ts` save validation runs `stripUnknownBlocks`; once
  the union/runtime set is extended, the new type passes through
  without code change.

**Status**: open
