# empixel-builder — Plugin for EmDash

Drag-and-drop page builder plugin. Layouts stored as JSON in SQLite, rendered via Astro components.

## Session Start — Required Reading

Read these two files at the start of every chat before doing any work:

1. **`.claude/prd-index.md`** — architecture overview, full file tree, data flow, key concepts, terminology
2. **`.claude/prd.md`** — current version (v0.5.0), completed features, what's in progress, next priorities

Then load the relevant sub-PRD based on the task:

| Task area | File |
|-----------|------|
| Block types, BlockDef, config schema | `.claude/prd-blocks.md` |
| Builder UI, reducer, Canvas, panels | `.claude/prd-builder-ui.md` |
| RightPanel controls, hover states, breakpoint writes | `.claude/prd-rightpanel.md` |
| Astro frontend components, rendering | `.claude/prd-frontend.md` |
| Preview components, PREVIEW_COMPONENTS map | `.claude/prd-previews.md` |
| API routes, database schema | `.claude/prd-backend.md` |
| Breakpoints system, canvas resize | `.claude/prd-breakpoints.md` |

Rules and coding conventions are in **`.claude/rules.md`** (always-on).

## Stack

TypeScript strict · React (admin UI) · Astro (frontend) · SQLite (`better-sqlite3`) · `@dnd-kit` · emdash plugin API

## Key Constraint

7 block types exist right now: `testimonials`, `faq`, `pricing`, `container`, `spacer`, `text`, `image`.
Only container blocks can be placed at the canvas root level — all others must be inside a container.

## Keep PRDs in Sync

The `.claude/prd-*.md` files are the source of truth for what this plugin currently does. They drift fast if not maintained.

**Whenever you change anything in the project, update the matching PRD file in the same task** — don't defer it to a follow-up. Use the table above to pick the right file. If a change spans multiple subsystems, update each affected PRD.

Examples that require a PRD update:
- Adding/removing/renaming a block type → `prd-blocks.md` + `prd-previews.md` + `prd-frontend.md` + `prd-index.md` (file tree) + `prd.md` (block inventory)
- New control or field type → `prd-rightpanel.md` + `prd-blocks.md` (if it's a `FieldDef.type`)
- New reducer action or state field → `prd-builder-ui.md`
- New API route, DB column, or hook → `prd-backend.md`
- New `styleUtils.ts` function or rendering behavior → `prd-frontend.md` (and `prd-breakpoints.md` if breakpoint-related)
- New breakpoint or change to canvas-resize logic → `prd-breakpoints.md`

When you finish a feature that completes a `TODO` in a PRD, mark it `[x]` rather than deleting it (so the history of what was planned vs. shipped stays visible). Move it to a "Done" section only when the TODO list gets long.

If you only touch styling, copy, or non-architectural details, no PRD update is needed.
