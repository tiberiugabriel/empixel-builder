import type { SectionBlock } from "../../types.js";
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
    case "LOAD_SUCCESS":
      return { ...state, isLoading: false, sections: action.sections, isDirty: false };
    case "LOAD_ERROR":
      return { ...state, isLoading: false, error: action.error };
    case "ADD_BLOCK":
      return { ...state, sections: [...state.sections, action.block], selectedId: action.block.id, isDirty: true };
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
      const next = addToContainer(action.containerId, action.slotIndex ?? null, action.block, state.sections);
      return { ...state, sections: next, selectedId: action.block.id, isDirty: true };
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
      const path = findPath(action.afterId, state.sections);
      let next: SectionBlock[];
      if (!path) {
        next = [...state.sections, action.block];
      } else if (path.level === "top") {
        next = [...state.sections];
        next.splice(path.index + 1, 0, action.block);
      } else {
        next = insertAtPath(action.block, {
          level: "container",
          containerId: path.containerId,
          slotIndex: path.slotIndex,
          index: path.index + 1,
        }, state.sections);
      }
      return { ...state, sections: next, selectedId: action.block.id, isDirty: true };
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
