import type { BlockType, SectionBlock } from "../../types.js";
import {
  updateBlockInTree,
  removeFromTree,
  addToContainer,
  insertAtPath,
  findBlockById,
  findPath,
  reorderInContainer,
  deepCloneBlock,
} from "../treeUtils.js";
import { getDefaultBlockConfig } from "../blockDefinitions.js";

// ─── F3.6.2 — full-shape config helpers ──────────────────────────────────────
//
// `withDefaults(block)` ensures `block.config` carries every key from
// `getDefaultBlockConfig(block.type)`, with the existing config winning on
// every overlap (action wins, defaults backfill missing keys). Used by
// `ADD_BLOCK` so freshly-instantiated blocks are always full-shape, and
// recursively by `LOAD_SUCCESS` so legacy layouts that pre-date F3.6.1
// upgrade transparently the first time the panel reads them.
//
// Deep-merge depth: two levels. `style` / `styleHover` / `styleDark` /
// `advanced` are flat string-valued maps; `styleBreakpoints` /
// `styleHoverBreakpoints` are `{ [bpId]: { _px, ...keys } }` — when the
// loaded block already has a populated bp entry we keep it verbatim
// rather than zero-filling each STYLE_PROPS key per breakpoint (the bp
// entries are sparse on purpose). Defaults set the floor only.
function fillBlockDefaults(block: SectionBlock): SectionBlock {
  const defaults = getDefaultBlockConfig(block.type as BlockType);
  const existing = block.config ?? {};
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(existing)) {
    const defVal = (defaults as Record<string, unknown>)[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      defVal !== null &&
      typeof defVal === "object" &&
      !Array.isArray(defVal)
    ) {
      merged[key] = {
        ...(defVal as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      merged[key] = value;
    }
  }
  let next: SectionBlock = { ...block, config: merged };
  if (block.children) {
    next = { ...next, children: block.children.map(fillBlockDefaults) };
  }
  if (block.slots) {
    next = { ...next, slots: block.slots.map((slot) => slot.map(fillBlockDefaults)) };
  }
  return next;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Entry = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  builder_enabled: boolean;
};

export type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};

export type Action =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; sections: SectionBlock[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "ADD_BLOCK"; block: SectionBlock }
  | { type: "UPDATE_BLOCK"; id: string; config: Record<string, unknown> }
  | { type: "REMOVE_BLOCK"; id: string }
  | { type: "REORDER"; sections: SectionBlock[] }
  | { type: "SELECT"; id: string | null }
  | { type: "SAVE_START" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "ADD_TO_CONTAINER"; containerId: string; slotIndex?: number; block: SectionBlock }
  | { type: "MOVE_BLOCK"; sourceId: string; targetContainerId: string | null; targetSlotIndex: number | null; targetIndex: number }
  | { type: "REORDER_IN_CONTAINER"; containerId: string; slotIndex: number | null; newOrder: SectionBlock[] }
  | { type: "INSERT_AFTER"; afterId: string; block: SectionBlock }
  | { type: "DUPLICATE_BLOCK"; id: string }
  | { type: "PASTE_SETTINGS"; id: string; config: Record<string, unknown> };

// ─── Reducer ──────────────────────────────────────────────────────────────────

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_SUCCESS": {
      // F3.6.2 — backfill missing config keys per node so legacy layouts
      // that pre-date F3.6.1 upgrade transparently. Existing values are
      // preserved (defaults win only on missing keys).
      const filled = action.sections.map(fillBlockDefaults);
      return { ...state, isLoading: false, sections: filled, isDirty: false };
    }
    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "ADD_BLOCK": {
      // F3.6.2 — guarantee freshly-added blocks always have full-shape
      // config. Callers (Builder.tsx, useDragHandlers) shallow-spread
      // `def.defaultConfig`, which loses nested defaults on legacy
      // BlockDef updates; centralising the fill here means the reducer
      // is the single source of truth for "what does a block look like
      // when it lands in state".
      const block = fillBlockDefaults(action.block);
      return { ...state, sections: [...state.sections, block], selectedId: block.id, isDirty: true };
    }
    case "UPDATE_BLOCK":
      return { ...state, sections: updateBlockInTree(action.id, action.config, state.sections), isDirty: true };
    case "REMOVE_BLOCK":
      return {
        ...state,
        sections: removeFromTree(action.id, state.sections),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        isDirty: true,
      };
    case "REORDER":
      return { ...state, sections: action.sections, isDirty: true };
    case "SELECT":
      return { ...state, selectedId: action.id };
    case "SAVE_START":
      return { ...state, isSaving: true, saveError: null };
    case "SAVE_SUCCESS":
      return { ...state, isSaving: false, isDirty: false };
    case "SAVE_ERROR":
      return { ...state, isSaving: false, saveError: action.error };
    case "ADD_TO_CONTAINER": {
      // F3.6.2 — same fill semantics as ADD_BLOCK so blocks dropped
      // into a container land with a full-shape config.
      const block = fillBlockDefaults(action.block);
      const next = addToContainer(action.containerId, action.slotIndex ?? null, block, state.sections);
      return { ...state, sections: next, selectedId: block.id, isDirty: true };
    }
    case "MOVE_BLOCK": {
      const block = findBlockById(action.sourceId, state.sections);
      if (!block) return state;
      let next = removeFromTree(action.sourceId, state.sections);
      next = insertAtPath(block, action.targetContainerId === null
        ? { level: "top", index: action.targetIndex }
        : { level: "container", containerId: action.targetContainerId, slotIndex: action.targetSlotIndex, index: action.targetIndex },
        next
      );
      return { ...state, sections: next, isDirty: true };
    }
    case "REORDER_IN_CONTAINER":
      return { ...state, sections: reorderInContainer(action.containerId, action.slotIndex, action.newOrder, state.sections), isDirty: true };
    case "INSERT_AFTER": {
      // F3.6.2 — fill defaults so blocks inserted via the
      // INSERT_AFTER path (e.g. context menu duplicate-with-new-id) match
      // ADD_BLOCK / ADD_TO_CONTAINER semantics.
      const block = fillBlockDefaults(action.block);
      const path = findPath(action.afterId, state.sections);
      let next: SectionBlock[];
      if (!path) {
        next = [...state.sections, block];
      } else if (path.level === "top") {
        next = [...state.sections];
        next.splice(path.index + 1, 0, block);
      } else {
        next = insertAtPath(block, {
          level: "container",
          containerId: path.containerId,
          slotIndex: path.slotIndex,
          index: path.index + 1,
        }, state.sections);
      }
      return { ...state, sections: next, selectedId: block.id, isDirty: true };
    }
    case "DUPLICATE_BLOCK": {
      const orig = findBlockById(action.id, state.sections);
      if (!orig) return state;
      const clone = deepCloneBlock(orig);
      const path = findPath(action.id, state.sections);
      let next: SectionBlock[];
      if (!path) {
        next = [...state.sections, clone];
      } else if (path.level === "top") {
        next = [...state.sections];
        next.splice(path.index + 1, 0, clone);
      } else {
        next = insertAtPath(clone, {
          level: "container",
          containerId: path.containerId,
          slotIndex: path.slotIndex,
          index: path.index + 1,
        }, state.sections);
      }
      return { ...state, sections: next, selectedId: clone.id, isDirty: true };
    }
    case "PASTE_SETTINGS":
      return { ...state, sections: updateBlockInTree(action.id, action.config, state.sections), isDirty: true };
    default:
      return state;
  }
}

export const initialState: State = {
  sections: [],
  selectedId: null,
  isDirty: false,
  isSaving: false,
  isLoading: true,
  error: null,
  saveError: null,
};

// ─── Undo / Redo (meta-reducer) ──────────────────────────────────────────────
//
// Keeps the existing `State` shape untouched. A meta-reducer wraps the
// existing reducer and tracks `past` + `future` snapshots of `sections`.
// Outside callers use `historyState.present` exactly like the previous
// `state`. Snapshots taken on every mutating action; transient ones (select,
// load/save lifecycle, the undo/redo flips themselves) are passed through
// without touching history.

const HISTORY_LIMIT = 50;

const NON_HISTORIC_ACTIONS: ReadonlySet<Action["type"]> = new Set<Action["type"]>([
  "SELECT",
  "LOAD_START",
  "LOAD_SUCCESS",
  "LOAD_ERROR",
  "SAVE_START",
  "SAVE_SUCCESS",
  "SAVE_ERROR",
]);

export interface HistoryState {
  past: SectionBlock[][];
  present: State;
  future: SectionBlock[][];
}

export type HistoryAction = Action | { type: "UNDO" } | { type: "REDO" };

export const initialHistoryState: HistoryState = {
  past: [],
  present: initialState,
  future: [],
};

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  if (action.type === "UNDO") {
    if (state.past.length === 0) return state;
    const prev = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: { ...state.present, sections: prev, isDirty: true },
      future: [state.present.sections, ...state.future].slice(0, HISTORY_LIMIT),
    };
  }
  if (action.type === "REDO") {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past: [...state.past, state.present.sections].slice(-HISTORY_LIMIT),
      present: { ...state.present, sections: next, isDirty: true },
      future: state.future.slice(1),
    };
  }

  const nextPresent = reducer(state.present, action);
  if (nextPresent === state.present) return state;

  // Non-historic actions (selection, load / save lifecycle) update present
  // without touching history. LOAD_SUCCESS additionally clears history,
  // because pre-load history snapshots refer to a different page entirely.
  if (NON_HISTORIC_ACTIONS.has(action.type)) {
    if (action.type === "LOAD_SUCCESS") {
      return { past: [], present: nextPresent, future: [] };
    }
    return { ...state, present: nextPresent };
  }

  // Mutating action — only snapshot when sections actually changed.
  if (nextPresent.sections === state.present.sections) {
    return { ...state, present: nextPresent };
  }

  return {
    past: [...state.past, state.present.sections].slice(-HISTORY_LIMIT),
    present: nextPresent,
    future: [],
  };
}
