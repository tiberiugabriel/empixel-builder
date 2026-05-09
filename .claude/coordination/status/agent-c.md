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
