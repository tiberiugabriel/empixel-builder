import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDndContext,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { epxVars } from "./epxVars.js";
import type { SectionBlock, PageLayout, BlockType, BreakpointId, BreakpointsConfig, BreakpointDef } from "../types.js";
import { isContainerType, BREAKPOINT_DEFS, DEFAULT_BREAKPOINTS_CONFIG } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { LeftPanel } from "./LeftPanel.js";
import { Canvas, CANVAS_DROP_ID, type BlockDragData, type EmptyZoneData } from "./Canvas.js";
import { RightPanel } from "./RightPanel.js";
import { StructurePanel, type StructureDropTarget } from "./StructurePanel.js";
import {
  findBlockById,
  removeFromTree,
  updateBlockInTree,
  addToContainer,
  reorderInContainer,
  findPath,
  insertAtPath,
  isDescendant,
} from "./treeUtils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entry = {
  id: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
  builder_enabled: boolean;
};

// ─── Builder State ────────────────────────────────────────────────────────────

type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};

type Action =
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
  | { type: "INSERT_AFTER"; afterId: string; block: SectionBlock };

function reducer(state: State, action: Action): State {
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
    default:
      return state;
  }
}

const initialState: State = {
  sections: [],
  selectedId: null,
  isDirty: false,
  isSaving: false,
  isLoading: true,
  error: null,
  saveError: null,
};

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

const EMDASH_THEME_KEY = "emdash-theme";
type Theme = "light" | "dark" | "system";
const THEME_ORDER: Theme[] = ["system", "light", "dark"];

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
  </svg>
);

const MonitorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z" />
  </svg>
);

function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() =>
    (localStorage.getItem(EMDASH_THEME_KEY) as Theme | null) ?? "system"
  );

  const apply = (next: Theme) => {
    const resolved = next === "system" ? getSystemTheme() : next;
    localStorage.setItem(EMDASH_THEME_KEY, next);
    document.documentElement.setAttribute("data-mode", resolved);
    setThemeState(next);
  };

  const cycle = () => {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
    apply(next);
  };

  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <button
      className="epx-theme-toggle"
      onClick={cycle}
      title={`Theme: ${label}`}
      aria-label={`Toggle theme (current: ${label})`}
      type="button"
    >
      {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <MonitorIcon />}
    </button>
  );
}

// ─── BreakpointSwitcher ───────────────────────────────────────────────────────

const BpIconDesktop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="2" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5.5 14H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 11V14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const BpIconWidescreen = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="3" width="15" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 13.5H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 11V13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const BpIconLaptop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2.5" width="12" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M0.5 13.5H15.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M5.5 13.5L6 11H10L10.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

const BpIconTabletLandscape = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="13.5" cy="8.5" r="0.8" fill="currentColor"/>
  </svg>
);

const BpIconTabletPortrait = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="1" width="8" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8" cy="13" r="0.8" fill="currentColor"/>
  </svg>
);

const BpIconMobileLandscape = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="5" width="14" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="13.3" cy="8.5" r="0.7" fill="currentColor"/>
  </svg>
);

const BpIconMobilePortrait = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="1" width="6" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8" cy="13.2" r="0.7" fill="currentColor"/>
  </svg>
);

const BP_ICONS: Record<string, React.ReactNode> = {
  desktop:          <BpIconDesktop />,
  widescreen:       <BpIconWidescreen />,
  laptop:           <BpIconLaptop />,
  "tablet-landscape": <BpIconTabletLandscape />,
  "tablet-portrait":  <BpIconTabletPortrait />,
  "mobile-landscape": <BpIconMobileLandscape />,
  "mobile-portrait":  <BpIconMobilePortrait />,
};

function BreakpointSwitcher({
  breakpoints,
  active,
  onChange,
}: {
  breakpoints: BreakpointDef[];
  active: BreakpointId;
  onChange: (id: BreakpointId) => void;
}) {
  return (
    <div className="epx-bp-switcher">
      {breakpoints.map((bp) => (
        <button
          key={bp.id}
          type="button"
          className={`epx-bp-btn${active === bp.id ? " is-active" : ""}`}
          title={bp.label + (bp.defaultPx ? ` (${bp.defaultPx}px)` : "")}
          onClick={() => onChange(bp.id)}
        >
          {BP_ICONS[bp.id]}
        </button>
      ))}
    </div>
  );
}

// ─── DragGhost ────────────────────────────────────────────────────────────────
// Reads from dnd-kit's own context to avoid React state timing issues

function DragGhost({ sections }: { sections: SectionBlock[] }) {
  const { active } = useDndContext();
  if (!active) return null;

  const data = active.data.current as { kind?: string; blockType?: BlockType } | undefined;
  let def;

  if (data?.kind === "new-block" && data.blockType) {
    def = getBlockDef(data.blockType);
  } else {
    const block = findBlockById(String(active.id), sections);
    if (block) def = getBlockDef(block.type);
  }

  if (!def) return null;

  return (
    <div className="epx-drag-overlay-ghost">
      <span className="epx-drag-overlay-ghost__icon">{def.icon}</span>
      <span className="epx-drag-overlay-ghost__label">{def.label}</span>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastMsg = { id: number; message: string; kind: "success" | "error" };

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: number) => void }) {
  return (
    <div className="epx-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`epx-toast epx-toast--${t.kind}`} onClick={() => onDismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Page Selector ────────────────────────────────────────────────────────────

type CollectionTab = { slug: string; label: string };

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

let _toastId = 0;

function PageSelector({ onSelect }: { onSelect: (id: string, title: string, collection: string) => void }) {
  const [collections, setCollections] = useState<CollectionTab[]>([]);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  function addToast(msg: Omit<ToastMsg, "id">) {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { ...msg, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  // Load enabled collections from plugin
  useEffect(() => {
    apiFetch("/_emdash/api/plugins/empixel-builder/collections")
      .then((res) => parseApiResponse<{ data: string[] }>(res, "Failed to load collections"))
      .then(({ data }) => {
        const tabs = (data ?? []).map((slug) => ({
          slug,
          label: slug.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        }));
        setCollections(tabs);
        if (tabs.length > 0) setCollection(tabs[0].slug);
      })
      .catch((err: unknown) => {
        console.error("[empixel-builder] collections error:", err);
        setCollectionsError(String(err));
      });
  }, []);

  useEffect(() => {
    if (!collection) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${collection}`)
      .then((res) => parseApiResponse<{ data: Entry[] }>(res, "Failed to load entries"))
      .then(({ data }) => {
        setEntries(data ?? []);
      })
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [collection]);

  async function handleToggleEntry(entry: Entry, checked: boolean) {
    setToggling((prev) => new Set(prev).add(entry.id));
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: entry.id, collection, enabled: checked }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, builder_enabled: checked } : e));
      addToast({ message: checked ? "Builder enabled" : "Builder disabled", kind: "success" });
    } catch {
      addToast({ message: "Failed to update builder status", kind: "error" });
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(entry.id); return s; });
    }
  }

  return (
    <div className="epx-selector">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
      <div className="epx-selector__header">
        <div className="epx-selector__header-top">
          <span className="epx-topbar__logo">EmPixel Builder</span>
          <a className="epx-selector__settings-link" href="/_emdash/admin/plugins/empixel-builder/settings">⚙ Settings</a>
        </div>
        <p className="epx-selector__subtitle">Select a page or post to edit its layout</p>
        {collections.length > 0 && (
          <div className="epx-selector__tabs">
            {collections.map((c) => (
              <button
                key={c.slug}
                className={`epx-selector__tab${collection === c.slug ? " is-active" : ""}`}
                onClick={() => setCollection(c.slug)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="epx-selector__body">
        {collectionsError && (
          <p className="epx-error">Collections error: {collectionsError}</p>
        )}
        {!collectionsError && collections.length === 0 && (
          <p className="epx-selector__empty">
            No collections enabled. Go to <a href="/_emdash/admin/plugins/empixel-builder/settings">Settings</a> to enable the builder on a collection.
          </p>
        )}
        {collections.length > 0 && loading && <div className="epx-selector__loading"><div className="epx-spinner" />Loading…</div>}
        {collections.length > 0 && error && <p className="epx-error">Error: {error}</p>}
        {collections.length > 0 && !loading && !error && entries.length === 0 && (
          <p className="epx-selector__empty">No entries found in "{collection}".</p>
        )}
        {collections.length > 0 && !loading && !error && entries.length > 0 && (
          <div className="epx-selector__table-wrap"><table className="epx-selector__table">
            <thead>
              <tr>
                <th className="epx-selector__th">Name &amp; ID</th>
                <th className="epx-selector__th">Date created</th>
                <th className="epx-selector__th">Last modified</th>
                <th className="epx-selector__th epx-selector__th--center">Enable Builder</th>
                <th className="epx-selector__th epx-selector__th--center">View</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="epx-selector__row">
                  <td
                    className="epx-selector__td epx-selector__td--name"
                    onClick={() => onSelect(entry.id, entry.title, collection)}
                  >
                    <span className="epx-selector__entry-title">{entry.title}</span>
                    <span className="epx-selector__entry-id">{entry.id}</span>
                  </td>
                  <td className="epx-selector__td">{formatDate(entry.created_at)}</td>
                  <td className="epx-selector__td">{formatDate(entry.updated_at)}</td>
                  <td className="epx-selector__td epx-selector__td--center">
                    <input
                      type="checkbox"
                      className="epx-selector__toggle"
                      checked={entry.builder_enabled}
                      disabled={toggling.has(entry.id)}
                      onChange={(e) => handleToggleEntry(entry, e.currentTarget.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="epx-selector__td epx-selector__td--center">
                    <a
                      className="epx-selector__view-link"
                      href={`/${collection}/${entry.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="View page"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 256 256" fill="currentColor">
                        <path d="M224,104a8,8,0,0,1-16,0V59.32l-82.34,82.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ─── Builder ──────────────────────────────────────────────────────────────────

function Builder({ pageId, pageTitle, collection, onBack }: { pageId: string; pageTitle: string; collection: string; onBack: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showBackWarning, setShowBackWarning] = useState(false);
  const backUrl = new URLSearchParams(window.location.search).get("back") ?? null;

  // Keep a ref to sections to avoid stale closure in drag handlers
  const sectionsRef = useRef(state.sections);
  useLayoutEffect(() => { sectionsRef.current = state.sections; });

  // Drag state
  const [overBlockId, setOverBlockId] = useState<string | null>(null);
  const [structureDropTarget, _setStructureDropTarget] = useState<StructureDropTarget>(null);
  const structureDropTargetRef = useRef<StructureDropTarget>(null);
  const setStructureDropTarget = useCallback((val: StructureDropTarget) => {
    structureDropTargetRef.current = val;
    _setStructureDropTarget(val);
  }, []);

  // Panel resize
  const [leftWidth, setLeftWidth] = useState(220);
  const [rightWidth, setRightWidth] = useState(280);

  // Structure panel state
  const [structureHeight, setStructureHeight] = useState(240);
  const [structureCollapsed, setStructureCollapsed] = useState(false);

  // Breakpoints
  const [activeBreakpoint, setActiveBreakpoint] = useState<BreakpointId>("desktop");
  const [breakpointsConfig, setBreakpointsConfig] = useState<BreakpointsConfig>(DEFAULT_BREAKPOINTS_CONFIG);
  const [isBreakpointsDirty, setIsBreakpointsDirty] = useState(false);

  const handleBreakpointsChange = useCallback((config: BreakpointsConfig) => {
    setBreakpointsConfig(config);
    setIsBreakpointsDirty(true);
  }, []);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(160, Math.min(420, startWidth + (ev.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftWidth]);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => setRightWidth(Math.max(200, Math.min(520, startWidth - (ev.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightWidth]);

  const handleStructureResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = structureHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) =>
      setStructureHeight(Math.max(120, Math.min(600, startH + (startY - ev.clientY))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [structureHeight]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    apiFetch(`/_emdash/api/plugins/empixel-builder/layout?pageId=${encodeURIComponent(pageId)}&collection=${encodeURIComponent(collection)}`)
      .then((res) => parseApiResponse<{ data: PageLayout | null }>(res, "Failed to load layout"))
      .then(({ data }) => dispatch({ type: "LOAD_SUCCESS", sections: data?.sections ?? [] }))
      .catch((err: unknown) => dispatch({ type: "LOAD_ERROR", error: String(err) }));
  }, [pageId, collection]);

  useEffect(() => {
    apiFetch("/_emdash/api/plugins/empixel-builder/breakpoints")
      .then((res) => parseApiResponse<{ data: BreakpointsConfig }>(res, "Failed to load breakpoints"))
      .then(({ data }) => {
        if (data) {
          setBreakpointsConfig({
            enabled: Array.isArray(data.enabled) ? data.enabled : DEFAULT_BREAKPOINTS_CONFIG.enabled,
            overrides: Array.isArray(data.overrides) ? data.overrides : [],
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleDragStart = useCallback((_: DragStartEvent) => {
    // ghost is rendered via DragGhost which reads from useDndContext directly
  }, []);

  const handleDragOver = useCallback(({ active, over, delta, activatorEvent }: DragOverEvent) => {
    const data = active.data.current as { kind: string } | undefined;

    if (data?.kind === "structure-block") {
      if (!over) { setStructureDropTarget(null); return; }
      const overData = over.data.current as { kind?: string; blockId?: string; isContainer?: boolean } | undefined;
      if (overData?.kind !== "struct-row") { setStructureDropTarget(null); return; }
      const sourceBlockId = (data as { blockId?: string }).blockId;
      // never set self as target
      if (overData.blockId === sourceBlockId) { setStructureDropTarget(null); return; }
      const overRect = over.rect;
      const pointerY = (activatorEvent as MouseEvent).clientY + delta.y;
      const relY = (pointerY - overRect.top) / overRect.height;
      const position = overData.isContainer
        ? (relY < 0.28 ? "before" : relY > 0.72 ? "after" : "inside")
        : (relY < 0.5 ? "before" : "after");
      setStructureDropTarget({ id: overData.blockId!, position });
      return;
    }

    if (data?.kind === "new-block") {
      const overData = over?.data.current as { kind: string } | undefined;
      setOverBlockId(over && overData?.kind === "block" ? String(over.id) : null);
    }
  }, [setStructureDropTarget]);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setOverBlockId(null);

    const sections = sectionsRef.current;
    const activeData = active.data.current as BlockDragData | { kind: "new-block"; blockType: BlockType } | { kind: "structure-block"; blockId: string } | undefined;

    // ── Structure panel drag ──
    if (activeData?.kind === "structure-block") {
      const target = structureDropTargetRef.current;
      setStructureDropTarget(null);
      if (!target) return;
      const sourceId = (activeData as { kind: "structure-block"; blockId: string }).blockId;
      const { id: targetId, position } = target;
      if (sourceId === targetId) return;
      if (isDescendant(sourceId, targetId, sections)) return;

      if (position === "before" || position === "after") {
        const path = findPath(targetId, sections);
        if (!path) return;
        dispatch({ type: "MOVE_BLOCK", sourceId,
          targetContainerId: path.level === "container" ? path.containerId : null,
          targetSlotIndex: path.level === "container" ? path.slotIndex : null,
          targetIndex: position === "before" ? path.index : path.index + 1,
        });
      } else {
        const container = findBlockById(targetId, sections);
        dispatch({ type: "MOVE_BLOCK", sourceId,
          targetContainerId: targetId, targetSlotIndex: null,
          targetIndex: container?.children?.length ?? 0,
        });
      }
      return;
    }

    // ── New block dragged from sidebar ──
    if (activeData?.kind === "new-block") {
      const { blockType } = activeData as { kind: "new-block"; blockType: BlockType };
      const def = getBlockDef(blockType);
      if (!def) return;
      const newBlock: SectionBlock = { id: crypto.randomUUID(), type: blockType, config: { ...def.defaultConfig } };

      if (!over) return;
      const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

      // Dropped on canvas background → only containers allowed at top level
      if (over.id === CANVAS_DROP_ID) {
        if (!isContainerType(blockType)) return;
        dispatch({ type: "ADD_BLOCK", block: newBlock });
        return;
      }
      // Dropped on empty zone inside container
      if (overData?.kind === "empty-zone") {
        const ezd = overData as EmptyZoneData;
        dispatch({ type: "ADD_TO_CONTAINER", containerId: ezd.containerId, slotIndex: ezd.slotIndex ?? undefined, block: newBlock });
        return;
      }
      // Dropped on a container block itself → add inside it
      if ((overData as BlockDragData)?.isContainer) {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: String(over.id), block: newBlock });
        return;
      }
      // Dropped on a specific block → insert after it
      dispatch({ type: "INSERT_AFTER", afterId: String(over.id), block: newBlock });
      return;
    }

    // ── Canvas block reorder / move ──
    if (activeData?.kind !== "block") return;
    if (active.id === over?.id) return;
    if (!over) return;

    const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

    // Dropped on empty zone → move to container slot
    if (overData?.kind === "empty-zone") {
      const ezd = overData as EmptyZoneData;
      dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: ezd.containerId, targetSlotIndex: ezd.slotIndex, targetIndex: 0 });
      return;
    }

    const activeBlockData = activeData as BlockDragData;
    const overBlockData = overData as BlockDragData | undefined;
    const activeContainerId = activeBlockData.containerId;
    const activeSlotIndex = activeBlockData.slotIndex ?? null;
    const overContainerId = overBlockData?.containerId ?? null;
    const overSlotIndex = overBlockData?.slotIndex ?? null;

    // Dropped directly on a container block → move inside it (append)
    if (overBlockData?.isContainer && !activeBlockData.isContainer) {
      const container = findBlockById(String(over.id), sections);
      const targetIndex = container?.children?.length ?? 0;
      dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: String(over.id), targetSlotIndex: null, targetIndex });
      return;
    }

    // Same container (or both top-level) → reorder
    if (activeContainerId === overContainerId && activeSlotIndex === overSlotIndex) {
      if (activeContainerId === null) {
        // Top-level reorder
        const oldIdx = sections.findIndex((s) => s.id === active.id);
        const newIdx = sections.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const next = [...sections];
          const [removed] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, removed);
          dispatch({ type: "REORDER", sections: next });
        }
      } else {
        // Reorder within container/slot
        const container = findBlockById(activeContainerId, sections);
        if (!container) return;
        const items = activeSlotIndex !== null
          ? (container.slots?.[activeSlotIndex] ?? [])
          : (container.children ?? []);
        const oldIdx = items.findIndex((s) => s.id === active.id);
        const newIdx = items.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const next = [...items];
          const [removed] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, removed);
          dispatch({ type: "REORDER_IN_CONTAINER", containerId: activeContainerId, slotIndex: activeSlotIndex, newOrder: next });
        }
      }
      return;
    }

    // Different containers → move
    const path = findPath(String(over.id), sections);
    const targetIndex = path ? path.index : 0;
    dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: overContainerId, targetSlotIndex: overSlotIndex, targetIndex });
  }, [setStructureDropTarget]);

  const addBlock = useCallback((type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };

    if (state.selectedId) {
      const selected = findBlockById(state.selectedId, state.sections);

      // Selected block is a container → add inside it
      if (selected && isContainerType(selected.type)) {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: selected.id, slotIndex: undefined, block });
        return;
      }

      // Selected block is a leaf inside a container → add to that same container
      const path = findPath(state.selectedId, state.sections);
      if (path?.level === "container") {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: path.containerId, slotIndex: path.slotIndex ?? undefined, block });
        return;
      }
    }

    // No container context for non-containers → can't add at top level
    if (!isContainerType(type)) return;

    dispatch({ type: "ADD_BLOCK", block });
  }, [state.selectedId, state.sections]);

  const addToContainerByType = useCallback((containerId: string, slotIndex: number | null, type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };
    dispatch({ type: "ADD_TO_CONTAINER", containerId, slotIndex: slotIndex ?? undefined, block });
  }, []);

  const addAfterBlock = useCallback((afterId: string, type: BlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const block: SectionBlock = { id: crypto.randomUUID(), type, config: { ...def.defaultConfig } };
    dispatch({ type: "INSERT_AFTER", afterId, block });
  }, []);

  const updateBlock = useCallback((id: string, config: Record<string, unknown>) => {
    dispatch({ type: "UPDATE_BLOCK", id, config });
  }, []);

  const removeBlock = useCallback((id: string) => {
    dispatch({ type: "REMOVE_BLOCK", id });
  }, []);

  const selectBlock = useCallback((id: string | null) => {
    dispatch({ type: "SELECT", id });
  }, []);

  const save = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    try {
      const res = await apiFetch("/_emdash/api/plugins/empixel-builder/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, collection, sections: state.sections }),
      });
      if (!res.ok) {
        dispatch({ type: "SAVE_ERROR", error: await res.text() || "Save failed" });
        return;
      }
      if (isBreakpointsDirty) {
        const bpRes = await apiFetch("/_emdash/api/plugins/empixel-builder/breakpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(breakpointsConfig),
        });
        if (!bpRes.ok) {
          dispatch({ type: "SAVE_ERROR", error: await bpRes.text() || "Save failed" });
          return;
        }
        setIsBreakpointsDirty(false);
      }
      dispatch({ type: "SAVE_SUCCESS" });
    } catch (err) {
      dispatch({ type: "SAVE_ERROR", error: String(err) });
    }
  }, [pageId, collection, state.sections, isBreakpointsDirty, breakpointsConfig]);

  useEffect(() => {
    if (!state.isDirty && !isBreakpointsDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.isDirty, isBreakpointsDirty]);

  const doNavigateBack = useCallback(() => {
    if (backUrl) { window.location.href = backUrl; } else { onBack(); }
  }, [backUrl, onBack]);

  const handleBackClick = useCallback(() => {
    if (state.isDirty || isBreakpointsDirty) { setShowBackWarning(true); } else { doNavigateBack(); }
  }, [state.isDirty, isBreakpointsDirty, doNavigateBack]);

  const handleSaveAndBack = useCallback(async () => {
    await save();
    doNavigateBack();
  }, [save, doNavigateBack]);

  const selectedBlock = state.selectedId ? findBlockById(state.selectedId, state.sections) : null;

  const enabledBreakpoints = BREAKPOINT_DEFS.filter((d) => (breakpointsConfig.enabled ?? DEFAULT_BREAKPOINTS_CONFIG.enabled).includes(d.id));

  const previewWidth: number | null = (() => {
    if (activeBreakpoint === "desktop") return null;
    const override = (breakpointsConfig.overrides ?? []).find((o) => o.id === activeBreakpoint);
    const def = BREAKPOINT_DEFS.find((d) => d.id === activeBreakpoint)!;
    return override?.px ?? def.defaultPx;
  })();

  // Resize bounds: null for desktop/widescreen; [nextSmaller, currentMax] for others
  const resizeBounds: { min: number; max: number } | null = (() => {
    if (activeBreakpoint === "desktop" || activeBreakpoint === "widescreen") return null;
    const enabledWithPx = BREAKPOINT_DEFS
      .filter((d) => d.defaultPx !== null && (breakpointsConfig.enabled ?? DEFAULT_BREAKPOINTS_CONFIG.enabled).includes(d.id))
      .map((d) => ({
        id: d.id,
        px: (breakpointsConfig.overrides ?? []).find((o) => o.id === d.id)?.px ?? d.defaultPx!,
      }))
      .sort((a, b) => b.px - a.px); // largest to smallest
    const currentIdx = enabledWithPx.findIndex((d) => d.id === activeBreakpoint);
    const max = currentIdx >= 0 ? enabledWithPx[currentIdx].px : previewWidth ?? 992;
    const nextSmaller = enabledWithPx[currentIdx + 1];
    const min = nextSmaller ? nextSmaller.px : 320;
    return { min, max };
  })();

  if (state.isLoading) {
    return (
      <div className="epx-builder epx-builder--loading">
        <div className="epx-spinner" />
        <p>Loading layout…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="epx-builder epx-builder--error">
        <p className="epx-error">Failed to load layout: {state.error}</p>
        <button className="epx-btn epx-btn--ghost" onClick={onBack} type="button">← Back</button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="epx-builder">
        <header className="epx-topbar">
          <div className="epx-topbar__left">
            <button className="epx-btn epx-btn--ghost" onClick={handleBackClick} type="button">
              ← Back
            </button>
            <ThemeToggle />
            <span className="epx-topbar__page-id">{pageTitle}</span>
          </div>
          <div className="epx-topbar__center">
            {(state.isDirty || isBreakpointsDirty) && <span className="epx-topbar__unsaved">Unsaved changes</span>}
            {state.saveError && <span className="epx-topbar__error">Error: {state.saveError}</span>}
          </div>
          <div className="epx-topbar__right">
            <BreakpointSwitcher
              breakpoints={enabledBreakpoints}
              active={activeBreakpoint}
              onChange={setActiveBreakpoint}
            />
            <button
              className="epx-btn epx-btn--primary"
              onClick={save}
              disabled={state.isSaving || (!state.isDirty && !isBreakpointsDirty)}
            >
              {state.isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </header>

        <div className="epx-builder__panels" style={{ gridTemplateColumns: `${leftWidth}px 4px 1fr 4px ${rightWidth}px` }}>
          <LeftPanel
            onAddBlock={addBlock}
            breakpointsConfig={breakpointsConfig}
            onBreakpointsChange={handleBreakpointsChange}
          />
          <div className="epx-resize-handle" onMouseDown={handleLeftResizeStart} />
          <Canvas
            sections={state.sections}
            selectedId={state.selectedId}
            onSelect={selectBlock}
            onRemove={removeBlock}
            onAddToContainer={addToContainerByType}
            dropIndicatorId={overBlockId}
            onAddAfter={addAfterBlock}
            previewWidth={previewWidth}
            resizeBounds={resizeBounds}
          />
          <div className="epx-resize-handle" onMouseDown={handleRightResizeStart} />
          <div className="epx-right-column">
            {selectedBlock && (
              <>
                <div
                  className="epx-right-column__settings"
                  style={structureCollapsed
                    ? { flex: 1 }
                    : { height: `calc(100% - ${structureHeight}px - 4px)` }
                  }
                >
                  <RightPanel
                    block={selectedBlock}
                    onChange={(config) => updateBlock(selectedBlock.id, config)}
                  />
                </div>
                {!structureCollapsed && (
                  <div
                    className="epx-resize-handle epx-resize-handle--row"
                    onMouseDown={handleStructureResizeStart}
                  />
                )}
              </>
            )}
            <StructurePanel
              sections={state.sections}
              selectedId={state.selectedId}
              onSelect={selectBlock}
              isCollapsed={structureCollapsed}
              onToggleCollapse={() => setStructureCollapsed((c) => !c)}
              dropTarget={structureDropTarget}
              style={structureCollapsed
                ? { flexShrink: 0, marginTop: "auto" }
                : selectedBlock
                  ? { height: structureHeight, flexShrink: 0 }
                  : { flex: 1 }
              }
            />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null} zIndex={99999}>
        <DragGhost sections={state.sections} />
      </DragOverlay>

      {showBackWarning && (
        <div className="epx-modal-backdrop" onClick={() => setShowBackWarning(false)}>
          <div className="epx-modal" onClick={(e) => e.stopPropagation()}>
            <button className="epx-modal__close" onClick={() => setShowBackWarning(false)} type="button" aria-label="Cancel">✕</button>
            <h2 className="epx-modal__title">Unsaved changes</h2>
            <p className="epx-modal__body">You have unsaved changes. Do you want to save before leaving?</p>
            <div className="epx-modal__actions">
              <button className="epx-btn epx-btn--primary" onClick={handleSaveAndBack} disabled={state.isSaving} type="button">
                {state.isSaving ? "Saving…" : "Save & exit"}
              </button>
              <button className="epx-btn epx-btn--ghost" onClick={doNavigateBack} type="button">
                Exit without saving
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function BuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialPageId = params.get("pageId");
  const initialCollection = params.get("collection");

  const needsResolve = !!(initialPageId && initialCollection);
  const [selected, setSelected] = useState<{ id: string; title: string; collection: string } | null>(null);
  const [resolving, setResolving] = useState(needsResolve);

  useEffect(() => {
    if (!initialPageId || !initialCollection) return;
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${initialCollection}`)
      .then(res => parseApiResponse<{ data: { id: string; title: string }[] }>(res, "Failed to load entries"))
      .then(({ data }) => {
        const entry = data?.find(e => e.id === initialPageId);
        setSelected(entry
          ? { id: entry.id, title: entry.title, collection: initialCollection }
          : { id: initialPageId, title: initialPageId, collection: initialCollection }
        );
      })
      .catch(() => {
        setSelected({ id: initialPageId, title: initialPageId, collection: initialCollection });
      })
      .finally(() => setResolving(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) {
      url.searchParams.set("pageId", selected.id);
      url.searchParams.set("collection", selected.collection);
    } else {
      url.searchParams.delete("pageId");
      url.searchParams.delete("collection");
    }
    history.replaceState(null, "", url.toString());
  }, [selected]);

  if (resolving) return <BuilderStyles />;

  return (
    <>
      {selected ? (
        <Builder
          pageId={selected.id}
          pageTitle={selected.title}
          collection={selected.collection}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PageSelector onSelect={(id, title, collection) => setSelected({ id, title, collection })} />
      )}
      <BuilderStyles />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function BuilderStyles() {
  return (
    <style>{`
      /* ── Theme variables ── */
      ${epxVars}

      /* ── Selector ── */
      .epx-selector {
        min-height: 100vh;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .epx-selector__header {
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        padding: 32px 40px 0;
      }
      .epx-selector__header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }
      .epx-selector__settings-link {
        font-size: 13px;
        color: var(--epx-text-muted);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 5px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-selector__settings-link:hover { background: var(--epx-hover-bg); color: var(--epx-text-2); }
      .epx-selector__subtitle {
        color: var(--epx-text-muted);
        font-size: 14px;
        margin: 6px 0 20px;
      }
      .epx-selector__tabs {
        display: flex;
        gap: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .epx-selector__tabs::-webkit-scrollbar { display: none; }
      .epx-selector__tab {
        padding: 10px 20px;
        border: none;
        background: none;
        font-size: 14px;
        font-weight: 500;
        color: var(--epx-text-muted);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
        white-space: nowrap;
      }
      .epx-selector__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-selector__tab:hover:not(.is-active) { color: var(--epx-text-2); }

      .epx-selector__body {
        padding: 24px 40px;
      }
      .epx-selector__loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--epx-text-muted);
        font-size: 14px;
      }
      .epx-selector__empty { color: var(--epx-text-faint); font-size: 14px; }

      .epx-selector__table-wrap {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      @media (min-width: 1000px) {
        .epx-selector__table-wrap { overflow-x: visible; }
      }
      .epx-selector__table {
        width: 100%;
        min-width: 640px;
        border-collapse: collapse;
        font-size: 14px;
      }
      .epx-selector__th {
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: var(--epx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0 12px 10px;
        border-bottom: 1px solid var(--epx-border);
      }
      .epx-selector__th--center { text-align: center; }
      .epx-selector__row:hover .epx-selector__td { background: var(--epx-hover-bg); }
      .epx-selector__td {
        padding: 12px;
        border-bottom: 1px solid var(--epx-border);
        color: var(--epx-text-muted);
        font-size: 13px;
        white-space: nowrap;
        vertical-align: middle;
      }
      .epx-selector__td--name {
        cursor: pointer;
        min-width: 200px;
      }
      .epx-selector__td--center { text-align: center; }
      .epx-selector__entry-title {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--epx-text);
        margin-bottom: 2px;
      }
      .epx-selector__entry-id {
        display: block;
        font-size: 11px;
        color: var(--epx-text-faint);
        font-family: monospace;
      }
      .epx-selector__toggle {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: var(--epx-accent);
      }
      .epx-selector__toggle:disabled { opacity: 0.4; cursor: wait; }
      .epx-selector__view-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--epx-text-faint);
        border-radius: 5px;
        padding: 4px;
        transition: color 0.15s, background 0.15s;
      }
      .epx-selector__view-link:hover { color: var(--epx-accent); background: var(--epx-hover-bg); }

      .epx-toast-container {
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      .epx-toast {
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        pointer-events: auto;
        cursor: pointer;
        animation: epx-toast-in 0.2s ease;
      }
      @keyframes epx-toast-in {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .epx-toast--success { background: #166534; color: #dcfce7; }
      .epx-toast--error   { background: #991b1b; color: #fee2e2; }

      /* ── Builder ── */
      .epx-builder {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: var(--epx-bg);
        color: var(--epx-text);
        color-scheme: light dark;
      }

      .epx-topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 7px;
        background: var(--epx-surface);
        border-bottom: 1px solid var(--epx-border);
        flex-shrink: 0;
        gap: 16px;
      }
      .epx-topbar__left { display: flex; align-items: center; gap: 12px; }
      .epx-topbar__logo { font-weight: 700; font-size: 15px; }
      .epx-topbar__page-id { color: var(--epx-text-muted); font-size: 13px; }
      .epx-topbar__center { flex: 1; text-align: center; }
      .epx-topbar__unsaved { font-size: 13px; color: #f59e0b; }
      .epx-topbar__error { font-size: 13px; color: #ef4444; }
      .epx-topbar__right { display: flex; gap: 8px; }

      .epx-theme-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        background: none;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        color: var(--epx-text-muted);
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .epx-theme-toggle:hover {
        background: var(--epx-hover-bg);
        border-color: var(--epx-border);
        color: var(--epx-text);
      }

      .epx-builder__panels {
        display: grid;
        flex: 1;
        overflow: hidden;
      }

      .epx-resize-handle {
        background: var(--epx-border);
        cursor: col-resize;
        transition: background 0.15s;
        position: relative;
        z-index: 10;
      }
      .epx-resize-handle::after {
        content: '';
        position: absolute;
        inset: 0 -3px;
      }
      .epx-resize-handle:hover {
        background: var(--epx-accent);
      }

      .epx-btn {
        padding: 7px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      }
      .epx-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .epx-btn--primary { background: var(--epx-accent); color: #fff; }
      .epx-btn--primary:not(:disabled):hover { background: var(--epx-accent-hover); }
      .epx-btn--ghost { background: transparent; color: var(--epx-text-mid); border-color: var(--epx-input-border); }
      .epx-btn--ghost:hover { background: var(--epx-hover-bg); }

      /* ── Unsaved-changes modal ── */
      .epx-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .epx-modal {
        position: relative;
        background: var(--epx-surface);
        border: 1px solid var(--epx-border);
        border-radius: 12px;
        padding: 32px 32px 28px;
        width: 380px;
        max-width: calc(100vw - 40px);
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .epx-modal__close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        color: var(--epx-text-muted);
        font-size: 14px;
        transition: background 0.1s, color 0.1s;
      }
      .epx-modal__close:hover { background: var(--epx-hover-bg); color: var(--epx-text); }
      .epx-modal__title {
        margin: 0 0 10px;
        font-size: 17px;
        font-weight: 600;
        color: var(--epx-text);
      }
      .epx-modal__body {
        margin: 0 0 24px;
        font-size: 14px;
        color: var(--epx-text-muted);
        line-height: 1.5;
      }
      .epx-modal__actions {
        display: flex;
        gap: 10px;
      }

      .epx-left-panel {
        background: var(--epx-surface);
        overflow-y: auto; display: flex; flex-direction: column;
      }
      .epx-left-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-left-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-left-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-left-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-left-panel__header { padding: 8px 12px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-left-panel__hint { font-size: 11px; color: var(--epx-text-faint); margin: 0; }
      .epx-left-panel__list { padding: 8px; display: flex; flex-direction: column; gap: 2px; }
      .epx-left-panel__empty { flex: 1; }

      .epx-block-group { display: flex; flex-direction: column; }
      .epx-block-group + .epx-block-group { margin-top: 4px; border-top: 1px solid var(--epx-border-subtle); padding-top: 4px; }
      .epx-block-group__label {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
        color: var(--epx-text-faint); padding: 6px 10px 2px;
      }
      .epx-block-card {
        display: flex; align-items: center; gap: 8px; padding: 8px 10px;
        border: 1px solid transparent; border-radius: 6px; background: none;
        cursor: grab; text-align: left; width: 100%; font-size: 13px;
        transition: background 0.1s, border-color 0.1s;
      }
      .epx-block-card:hover { background: var(--epx-card-hover-bg); border-color: #c7d2fe; }
      .epx-block-card__icon { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
      .epx-block-card__label { font-weight: 500; color: var(--epx-text-strong); }

      /* ── Canvas ── */
      .epx-canvas { overflow-y: auto; background: var(--epx-bg); }
      .epx-canvas--empty { display: flex; align-items: center; justify-content: center; }
      .epx-canvas__empty-state { text-align: center; color: var(--epx-text-faint); }
      .epx-canvas__empty-icon { font-size: 48px; margin-bottom: 12px; }
      .epx-canvas__empty-state h3 { margin: 0 0 6px; font-size: 16px; color: var(--epx-text-mid); }
      .epx-canvas__empty-state p { margin: 0; font-size: 13px; }
      .epx-canvas__list { display: flex; flex-direction: column; gap: 6px; }

      /* ── Block preview (leaf blocks) ── */
      .epx-block-preview {
        position: relative; overflow: visible;
        border: 1px solid transparent; cursor: pointer;
        transition: border-color 0.15s;
      }
      .epx-block-preview.is-selected { border-color: var(--epx-selected); }

      /* ── BlockOverlay ── */
      .epx-block-overlay {
        position: absolute; top: 0; left: 50%; transform: translateX(-50%);
        z-index: 20; display: flex; align-items: center; gap: 2px;
        background: rgba(20,20,20,0.82); border-radius: 4px; padding: 0;
        opacity: 0; pointer-events: none; transition: opacity 0.15s;
        white-space: nowrap;
      }
      .epx-block-overlay.is-visible { opacity: 1; pointer-events: auto; }
      .epx-block-overlay__btn {
        background: none; border: none; color: #fff; cursor: pointer;
        width: 22px; height: 22px; border-radius: 4px; font-size: 17px;
        display: flex; align-items: center; justify-content: center; padding: 0;
        transition: background 0.1s;
      }
      .epx-block-overlay__btn:hover { background: rgba(255,255,255,0.15); }
      .epx-block-overlay__btn--delete:hover { background: rgba(220,38,38,0.8); }
      .epx-block-overlay__handle {
        color: #ccc; cursor: grab; user-select: none;
        width: 22px; height: 22px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; transition: background 0.1s, color 0.1s;
      }
      .epx-block-overlay__handle:hover { background: rgba(255,255,255,0.15); color: #fff; }
      /* ── Container block (section) ── */
      .epx-container-block {
        background: transparent;
        position: relative; cursor: pointer;
        overflow: visible;
      }
      .epx-container-block::before {
        content: ""; position: absolute; inset: 0;
        border: 1px solid transparent; pointer-events: none;
        transition: border-color 0.15s; z-index: 5;
      }
      .epx-container-block:hover::before { border-color: var(--epx-selected); }
      .epx-container-block.is-selected::before { border-color: var(--epx-selected); }
      .epx-container-block__children {
        display: flex; flex-direction: column; min-height: 48px;
      }
      .epx-container__empty-zone {
        display: flex; align-items: center; justify-content: center; min-height: 56px;
        border-radius: 6px; transition: background 0.15s;
      }
      .epx-container__empty-zone.is-over { background: rgba(134,239,172,0.12); }

      /* ── Inner block overlay (drag handle, top-left) ── */
      .epx-inner-block-overlay {
        position: absolute; top: 0; left: 0; z-index: 20;
        opacity: 0; pointer-events: none; transition: opacity 0.15s;
      }
      .epx-inner-block-overlay.is-visible { opacity: 1; pointer-events: auto; }
      .epx-inner-block-overlay__handle {
        background: rgba(20,20,20,0.82); color: #ccc; cursor: grab; user-select: none;
        width: 22px; height: 22px; border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; transition: background 0.1s, color 0.1s;
      }
      .epx-inner-block-overlay__handle:hover { background: rgba(20,20,20,0.95); color: #fff; }

      /* ── Right column (always-visible settings + structure) ── */
      .epx-right-column {
        display: flex; flex-direction: column; overflow: hidden;
        background: var(--epx-surface);
      }
      .epx-right-column__settings {
        overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0;
      }

      /* Horizontal resize handle (between settings and structure) */
      .epx-resize-handle--row {
        cursor: row-resize; height: 4px; background: var(--epx-border);
        flex-shrink: 0; position: relative; z-index: 10; transition: background 0.15s;
      }
      .epx-resize-handle--row::after { content: ''; position: absolute; inset: -3px 0; }
      .epx-resize-handle--row:hover { background: var(--epx-accent); }

      /* ── Structure panel ── */
      .epx-structure-panel {
        display: flex; flex-direction: column; overflow: hidden;
        border-top: 1px solid var(--epx-border); background: var(--epx-surface); flex-shrink: 0;
      }
      .epx-structure-panel__header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 10px; height: 32px; flex-shrink: 0;
        border-bottom: 1px solid var(--epx-border-subtle);
      }
      .epx-structure-panel__title {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--epx-text-faint);
      }
      .epx-structure-panel__collapse-btn {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        width: 22px; height: 22px; border-radius: 4px; display: flex;
        align-items: center; justify-content: center; padding: 0; transition: background 0.1s, color 0.1s;
      }
      .epx-structure-panel__collapse-btn:hover { background: var(--epx-hover-bg); color: var(--epx-text-mid); }
      .epx-structure-panel__body {
        flex: 1; overflow-y: auto; padding: 4px 0;
        scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent;
      }
      .epx-structure-panel__body::-webkit-scrollbar { width: 4px; }
      .epx-structure-panel__body::-webkit-scrollbar-track { background: transparent; }
      .epx-structure-panel__body::-webkit-scrollbar-thumb { background: var(--epx-text-muted); border-radius: 4px; }
      .epx-structure-panel__empty {
        padding: 20px 12px; font-size: 12px; color: var(--epx-text-faint); text-align: center;
      }

      /* ── Structure rows ── */
      .epx-structure-row-wrapper { position: relative; }
      .epx-structure-row {
        display: flex; align-items: center; gap: 4px; height: 28px;
        cursor: pointer; border-radius: 4px; margin: 0 4px;
        transition: background 0.1s; user-select: none;
      }
      .epx-structure-row:hover { background: var(--epx-hover-bg); }
      .epx-structure-row.is-selected { background: var(--epx-accent-bg); }
      .epx-structure-row.is-dragging { opacity: 0.4; }
      .epx-structure-row.is-drop-inside {
        background: var(--epx-accent-bg);
        outline: 1.5px dashed var(--epx-accent);
        outline-offset: -1px;
      }
      .epx-structure-row__expand-btn {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center;
        justify-content: center; border-radius: 3px; padding: 0; transition: color 0.1s, background 0.1s;
      }
      .epx-structure-row__expand-btn:hover { color: var(--epx-text-mid); background: var(--epx-hover-bg); }
      .epx-structure-row__icon { font-size: 12px; width: 16px; text-align: center; flex-shrink: 0; }
      .epx-structure-row__label {
        font-size: 12px; color: var(--epx-text-mid); overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
        cursor: grab; touch-action: none;
      }
      .epx-structure-row__label:active { cursor: grabbing; }
      .epx-structure-row.is-selected .epx-structure-row__label { color: var(--epx-accent); font-weight: 600; }

      /* ── Structure drop line ── */
      .epx-structure-drop-line {
        height: 2px; margin-right: 8px; border-radius: 1px;
        background-image: repeating-linear-gradient(90deg, var(--epx-accent) 0px, var(--epx-accent) 5px, transparent 5px, transparent 9px);
        margin-top: 1px; margin-bottom: 1px;
      }

      /* ── Drop indicator ── */
      .epx-drop-indicator {
        position: absolute; bottom: -3px; left: 0; right: 0;
        height: 2px; background: var(--epx-selected); border-radius: 1px; z-index: 30;
        pointer-events: none;
      }

      /* ── Drag overlay ghost ── */
      .epx-drag-overlay-ghost {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px; background: var(--epx-surface);
        border: 1px solid #c7d2fe; border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        font-size: 13px; font-weight: 500; color: var(--epx-text-strong);
        pointer-events: none; white-space: nowrap;
        transform: rotate(2deg);
      }
      .epx-drag-overlay-ghost__icon { font-size: 16px; }
      .epx-drag-overlay-ghost__label { color: var(--epx-text-strong); }

      /* ── Right panel ── */
      .epx-right-panel {
        background: var(--epx-surface);
        display: flex; flex-direction: column; overflow: hidden; height: 100%;
      }
      .epx-right-panel--empty { align-items: center; justify-content: center; }
      .epx-right-panel__placeholder { text-align: center; color: var(--epx-text-faint); padding: 32px 16px; }
      .epx-right-panel__placeholder-icon { font-size: 32px; margin-bottom: 8px; }
      .epx-right-panel__placeholder p { font-size: 13px; margin: 0; }
      .epx-right-panel__header { display: flex; align-items: center; gap: 8px; padding: 14px 14px 6px; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__icon { font-size: 20px; }
      .epx-right-panel__title { font-size: 14px; font-weight: 700; margin: 0; }
      .epx-right-panel__description { font-size: 12px; color: var(--epx-text-muted); padding: 6px 14px 10px; margin: 0; border-bottom: 1px solid var(--epx-border-subtle); }
      .epx-right-panel__tabs { display: flex; border-bottom: 1px solid var(--epx-border); }
      .epx-right-panel__tab { flex: 1; padding: 9px 0; border: none; background: none; color: var(--epx-text-faint); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s, border-color 0.15s; display: flex; align-items: center; justify-content: center; }
      .epx-right-panel__tab:hover { color: var(--epx-text-mid); }
      .epx-right-panel__tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-right-panel__fields { padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; flex: 1; overflow: hidden auto; scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent; height: 100%; }
      .epx-right-panel__fields::-webkit-scrollbar { width: 4px; }
      .epx-right-panel__fields::-webkit-scrollbar-track { background: transparent; }
      .epx-right-panel__fields::-webkit-scrollbar-thumb { background: var(--epx-text-muted); border-radius: 4px; }

      .epx-field { display: flex; flex-direction: column; gap: 4px; }
      .epx-field__label { font-size: 12px; font-weight: 600; color: var(--epx-text-faint); }
      .epx-field__required { color: #ef4444; margin-left: 3px; }
      .epx-field__input, .epx-field__select, .epx-field__textarea {
        width: 100%; padding: 6px 8px; border: 1px solid var(--epx-input-border); border-radius: 5px;
        font-size: 13px; background: var(--epx-input-bg); color: var(--epx-text); box-sizing: border-box; transition: border-color 0.15s;
      }
      .epx-field__input:focus, .epx-field__select:focus, .epx-field__textarea:focus {
        outline: none; border-color: var(--epx-accent); background: var(--epx-surface);
      }
      .epx-field__textarea { resize: vertical; min-height: 72px; }
      /* ── Code editor (intentionally always dark — Catppuccin Mocha) ── */
      .epx-code-editor {
        border: 1px solid #2a2a3d; border-radius: 6px; overflow: hidden;
        font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
        font-size: 12px; line-height: 1.7; background: #1e1e2e;
      }
      .epx-code-editor__header {
        padding: 4px 8px; background: #13131f; border-bottom: 1px solid #2a2a3d;
        display: flex; align-items: center; gap: 6px; font-size: 11px; min-width: 0;
      }
      .epx-code-editor__copy-btn {
        flex-shrink: 0; background: none; border: none; cursor: pointer;
        color: #6c7086; padding: 2px; border-radius: 3px; display: flex;
        align-items: center; transition: color 0.15s;
      }
      .epx-code-editor__copy-btn:hover { color: #cba6f7; }
      .epx-code-editor__selector-scroll {
        display: flex; align-items: center; gap: 0; overflow-x: auto;
        white-space: nowrap; flex: 1; min-width: 0;
        scrollbar-width: thin; scrollbar-color: #313244 transparent;
      }
      .epx-code-editor__selector-scroll::-webkit-scrollbar { height: 3px; }
      .epx-code-editor__selector-scroll::-webkit-scrollbar-track { background: transparent; }
      .epx-code-editor__selector-scroll::-webkit-scrollbar-thumb { background: #313244; border-radius: 2px; }
      .epx-code-editor__selector-kw { color: #cba6f7; font-style: italic; }
      .epx-code-editor__selector-eq { color: #6c7086; }
      .epx-code-editor__selector-val { color: #89dceb; }
      .epx-code-editor__body {
        display: flex; min-height: 140px; overflow: auto; resize: vertical;
      }
      .epx-code-editor__line-nums {
        padding: 8px 0; min-width: 36px; text-align: right;
        background: #181825; color: #45475a; border-right: 1px solid #2a2a3d;
        overflow: hidden; flex-shrink: 0; user-select: none;
      }
      .epx-code-editor__line-num { padding: 0 8px; height: calc(1.7 * 12px); box-sizing: content-box; }
      .epx-code-editor__textarea {
        flex: 1; padding: 8px 10px; border: none; outline: none; resize: none;
        background: #1e1e2e; color: #cdd6f4; font-family: inherit; font-size: inherit;
        line-height: inherit; overflow-y: auto; box-sizing: border-box;
        caret-color: #f5c2e7;
      }
      .epx-code-editor__textarea::placeholder { color: #45475a; }
      .epx-field--toggle .epx-field__toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
      .epx-field__toggle-input { width: 16px; height: 16px; cursor: pointer; }

      /* ── LinkControl ── */
      .epx-link-ctrl__checks { display: flex; align-items: center; gap: 12px; padding: 6px 10px; border-top: 1px solid var(--epx-border-subtle); }
      .epx-link-ctrl__check { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: var(--epx-text-2); user-select: none; }
      .epx-link-ctrl__check input[type="checkbox"] { width: 13px; height: 13px; cursor: pointer; accent-color: var(--epx-accent); }
      .epx-bg-ctrl__url-row--indent { padding-left: 0; }
      .epx-link-ctrl__hint { margin: 0; padding: 5px 10px 7px; font-size: 10px; line-height: 1.6; color: var(--epx-text-faint); border-top: 1px solid var(--epx-border-subtle); }
      .epx-link-ctrl__hint code { font-family: monospace; color: #f38019; border: 1px solid var(--epx-border-subtle); border-radius: 3px; padding: 0 3px; }

      /* ── SpacingControl ── */
      .epx-spacing-ctrl { display: flex; flex-direction: column; container-type: inline-size; }
      .epx-spacing-ctrl__row { display: flex; align-items: center; gap: 2px; }
      .epx-spacing-ctrl__row .epx-side-input { border-top: none; }
      .epx-spacing-ctrl__row > .epx-spacing-ctrl__collapsed { flex: 1; min-width: 0; }
      .epx-spacing-ctrl__collapsed {
        display: flex; align-items: center; height: 28px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__collapsed > .epx-side-input {
        flex: 1; min-width: 0; border-top: none; background: transparent;
      }
      .epx-spacing-ctrl__expanded {
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible;
      }
      .epx-spacing-ctrl__exp-header {
        display: flex; align-items: center; justify-content: space-between;
        height: 27px; padding: 0; border-bottom: 1px solid var(--epx-border-subtle);
      }
      .epx-spacing-ctrl__label {
        font-size: 10px; font-weight: 700; color: var(--epx-text-faint); opacity: 0.65;
        text-transform: uppercase; letter-spacing: 0.06em; padding: 0 8px;
      }
      .epx-spacing-ctrl__caret {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint);
        font-size: 11px; padding: 0 8px; height: 28px; line-height: 28px;
        flex-shrink: 0; transition: color 0.1s;
      }
      .epx-spacing-ctrl__caret:hover { color: var(--epx-text-mid); }
      .epx-spacing-ctrl__exp-actions { display: flex; align-items: center; }
      .epx-reset-btn {
        background: none; border: none; cursor: pointer; padding: 0 4px; height: 28px;
        display: flex; align-items: center; color: var(--epx-text-faint);
        transition: color 0.1s; flex-shrink: 0;
      }
      .epx-reset-btn:hover { color: var(--epx-accent); }
      .epx-spacing-ctrl__grid { display: grid; }
      .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr 1fr; }
      .epx-spacing-ctrl__grid--col1 { grid-template-columns: 1fr; }
      .epx-spacing-ctrl__grid--col2 > .epx-side-input:nth-child(odd) {
        border-right: 2px solid var(--epx-border-subtle);
      }
      @container (max-width: 220px) {
        .epx-spacing-ctrl__grid--col2 { grid-template-columns: 1fr; }
        .epx-spacing-ctrl__grid--col2 > .epx-side-input:nth-child(odd) { border-right: none; }
      }

      /* ── SideInput ── */
      .epx-side-input {
        display: flex; align-items: center; min-height: 28px; height: auto;
        flex-wrap: wrap;
        background: transparent; position: relative;
        border-top: 1px solid var(--epx-border-subtle);
        min-width: 0;
      }
      .epx-side-input__label {
        flex-shrink: 0; width: 22px; text-align: center;
        font-size: 9px; font-weight: 700; color: var(--epx-text-faint);
        text-transform: uppercase; cursor: ew-resize; user-select: none;
        align-self: stretch; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
        border-right: 1px solid var(--epx-border-subtle);
      }
      .epx-side-input__label--full {
        flex: 1; width: auto; justify-content: flex-start; padding: 0 8px;
        font-size: 10px; letter-spacing: 0.06em; border-right: none;
      }
      .epx-side-input__label--icon { color: var(--epx-text-muted); }
      .epx-side-input__num {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 12px; padding: 0 4px;
        text-align: right; outline: none; -moz-appearance: textfield;
      }
      .epx-side-input__num::-webkit-inner-spin-button,
      .epx-side-input__num::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-side-input__num:disabled { color: var(--epx-text-faint); }
      .epx-side-input__unit-wrap { position: relative; flex-shrink: 0; }
      .epx-side-input__unit-btn {
        background: none; border: none; border-left: 1px solid var(--epx-border-subtle);
        cursor: pointer; color: var(--epx-text-faint); font-size: 10px; font-weight: 600;
        padding: 0 6px; height: 28px; min-width: 34px; text-align: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-side-input__unit-btn:hover { color: var(--epx-accent); }
      .epx-side-input__unit-btn--icon { display: flex; align-items: center; justify-content: center; }
      .epx-side-input__num--custom::placeholder { font-style: italic; }

      /* ── UnitDropdown ── */
      .epx-unit-dropdown {
        position: absolute; top: calc(100% + 3px); right: 0;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        z-index: 200; display: flex; flex-direction: column;
        min-width: 60px; padding: 3px;
      }
      .epx-unit-dropdown__item {
        background: none; border: none; cursor: pointer; color: var(--epx-text-mid);
        font-size: 11px; font-weight: 500; padding: 5px 10px;
        text-align: left; border-radius: 4px; transition: background 0.1s, color 0.1s;
      }
      .epx-unit-dropdown__item:hover { background: var(--epx-hover-bg); color: var(--epx-text); }
      .epx-unit-dropdown__item.is-active { color: var(--epx-accent); font-weight: 700; }
      .epx-unit-dropdown__sep { height: 1px; background: var(--epx-border-subtle); margin: 3px 4px; }
      .epx-unit-dropdown__item--pen { display: flex; align-items: center; justify-content: center; padding: 5px 0; }

      /* ── FieldRow ── */
      .epx-field-group {
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); overflow: visible; width: 100%;
      }
      .epx-spacing-ctrl__row > .epx-field-group { flex: 1; min-width: 0; width: auto; }
      .epx-side-input__label--row {
        flex: 0 0 auto; width: auto; justify-content: flex-start; padding: 0 8px;
        font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0;
        cursor: default; color: var(--epx-text-faint); border-right: none;
        text-align: left; line-height: 1; white-space: nowrap;
      }
      .epx-side-input__label--row:hover { color: var(--epx-text-faint); background: none; }
      .epx-side-input__label--scrub:hover { color: var(--epx-accent); }
      .epx-panel-divider { height: 1px; background: var(--epx-border); margin: 2px 0; }
      .epx-row-label--section { text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; font-weight: 700; color: var(--epx-text-faint); }
      .epx-row-label--color { color: var(--epx-text-faint); }
      /* Dirty state — label lightens toward white */
      .epx-spacing-ctrl.is-dirty .epx-side-input__label--full,
      .epx-spacing-ctrl.is-dirty .epx-spacing-ctrl__label,
      .epx-field-group.is-dirty .epx-side-input__label--row,
      .epx-field.is-dirty .epx-field__label {
        color: color-mix(in srgb, var(--epx-text-faint), white 45%);
      }
      .epx-spacing-ctrl.is-dirty .epx-side-input__label--full:hover,
      .epx-field-group.is-dirty .epx-side-input__label--scrub:hover { color: var(--epx-accent); }
      .epx-field-row__select-wrap { flex: 1; min-width: 0; position: relative; }
      .epx-field-row__select-btn {
        width: 100%; height: 28px; border: none; background: transparent;
        display: flex; align-items: center; justify-content: flex-end; gap: 5px;
        padding: 0 8px; cursor: pointer; color: var(--epx-text); font-size: 12px;
        transition: color 0.1s;
      }
      .epx-field-row__select-btn:hover { color: var(--epx-accent); }
      .epx-field-row__select-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .epx-field-row__select-btn--pen { color: var(--epx-text-muted); }
      .epx-field-row__select-caret { font-size: 9px; color: var(--epx-text-faint); flex-shrink: 0; }

      /* ── BorderControl ── */
      .epx-border-style-row {
        display: grid; grid-template-columns: 1fr 1fr;
        border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-border-style-cell {
        display: flex; align-items: center; height: 28px;
        border-right: 1px solid var(--epx-border-subtle);
      }
      .epx-border-style-cell > .epx-side-input__label--row { width: auto; flex-shrink: 0; }
      .epx-border-style-btn { width: 100%; }
      .epx-border-mixed {
        flex: 1; font-size: 11px; color: var(--epx-text-faint);
        font-style: italic; text-align: right; padding: 0 8px;
      }
      .epx-border-color-cell {
        display: flex; align-items: center; gap: 6px; height: 28px;
        padding: 0 8px; position: relative; overflow: visible;
      }
      .epx-border-color-swatch {
        width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
        border: 1px solid rgba(128,128,128,0.3); cursor: pointer;
      }
      .epx-border-color-hex {
        font-size: 10px; color: var(--epx-text-muted); font-family: monospace;
      }

      /* ── Stateful control wrapper (toggle + control grouped) ── */
      .epx-stateful-ctrl { display: flex; flex-direction: column; gap: 1px; }

      /* ── State toggle (Normal / Hover) ── */
      .epx-state-toggle {
        display: flex; gap: 2px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-ctrl-bg); overflow: visible;
        padding: 2px; margin: 0 0 3px;
      }
      .epx-state-toggle__btn {
        flex: 1; padding: 3px 0; font-size: 11px; border-radius: 4px;
        border: none; background: transparent; color: var(--epx-text-faint);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-state-toggle__btn.is-active {
        background: var(--epx-surface-2); color: var(--epx-text);
      }
      .epx-state-header {
        display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 0 0 3px;
      }
      .epx-state-header .epx-state-toggle,
      .epx-state-header .epx-blk-theme-toggle { margin: 0; }
      .epx-blk-theme-toggle {
        display: flex; gap: 2px;
        outline: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-ctrl-bg); overflow: visible;
        padding: 2px; margin: 0 0 3px;
      }
      .epx-blk-theme-toggle > * {
        flex: 1; height: 100%; font-size: 11px; border-radius: 4px;
        border: none; background: transparent; color: var(--epx-text-faint);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: color 0.1s, background 0.1s;
      }
      .epx-blk-theme-toggle > *.is-active {
        background: var(--epx-surface-2); color: var(--epx-text);
      }

      /* ── Tooltip ── */
      [data-tooltip] { position: relative; }
      .epx-icon-btn-group [data-tooltip]:last-child::after { left: auto; right: 0; transform: none; }
      [data-tooltip]::after {
        content: attr(data-tooltip);
        position: absolute; top: calc(100% + 4px); left: 50%;
        transform: translateX(-50%);
        background: var(--epx-surface-2); color: var(--epx-text);
        font-size: 10px; line-height: 1; padding: 3px 7px;
        border-radius: 4px; white-space: nowrap; pointer-events: none;
        border: 1px solid var(--epx-border);
        opacity: 0; transition: opacity 0.12s; z-index: 9999;
      }
      [data-tooltip]:hover::after { opacity: 1; }

      /* ── ColorPicker ── */
      .epx-colorpicker {
        position: fixed; width: 256px;
        background: var(--epx-surface); border: 1px solid var(--epx-border);
        border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,0.22);
        z-index: 9999; overflow: hidden;
      }
      .epx-colorpicker__field {
        position: relative; height: 150px; cursor: crosshair; user-select: none;
      }
      .epx-colorpicker__field-white {
        position: absolute; inset: 0;
        background: linear-gradient(to right, #fff, transparent);
      }
      .epx-colorpicker__field-black {
        position: absolute; inset: 0;
        background: linear-gradient(to bottom, transparent, #000);
      }
      .epx-colorpicker__field-handle {
        position: absolute; width: 12px; height: 12px; border-radius: 50%;
        border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__sliders { padding: 8px 10px 4px; display: flex; flex-direction: column; gap: 6px; }
      .epx-colorpicker__hue {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background: linear-gradient(to right,
          hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%),
          hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%));
      }
      .epx-colorpicker__alpha-track {
        position: relative; height: 10px; border-radius: 5px; cursor: pointer; user-select: none;
        background-image: linear-gradient(45deg, #aaa 25%, transparent 25%),
          linear-gradient(-45deg, #aaa 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #aaa 75%),
          linear-gradient(-45deg, transparent 75%, #aaa 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: hidden;
      }
      .epx-colorpicker__alpha-fill { position: absolute; inset: 0; }
      .epx-colorpicker__slider-thumb {
        position: absolute; top: 50%; width: 14px; height: 14px;
        background: #fff; border-radius: 50%;
        border: 2px solid rgba(0,0,0,0.25); box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .epx-colorpicker__inputs {
        display: flex; align-items: center; gap: 5px; padding: 6px 10px 10px;
      }
      .epx-colorpicker__eyedrop {
        flex-shrink: 0; width: 26px; height: 26px; border-radius: 4px;
        border: 1px solid var(--epx-border); background: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: var(--epx-text-muted); transition: color 0.1s, border-color 0.1s;
      }
      .epx-colorpicker__eyedrop:hover { color: var(--epx-text); border-color: var(--epx-text-muted); }
      .epx-colorpicker__fmt-btn {
        flex-shrink: 0; height: 26px; padding: 0 6px;
        border: 1px solid var(--epx-border); border-radius: 4px;
        background: var(--epx-input-bg); color: var(--epx-text-faint);
        font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
        text-transform: uppercase; cursor: pointer;
        transition: color 0.1s, border-color 0.1s;
      }
      .epx-colorpicker__fmt-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }
      .epx-colorpicker__fmt-inputs {
        flex: 1; min-width: 0; display: flex; align-items: stretch; height: 26px;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; overflow: hidden;
      }
      .epx-colorpicker__fmt-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; font-family: monospace;
        text-align: center; outline: none; padding: 0 2px;
        -moz-appearance: textfield;
      }
      .epx-colorpicker__fmt-input::-webkit-inner-spin-button,
      .epx-colorpicker__fmt-input::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-colorpicker__fmt-input:not(:first-child) { border-left: 1px solid var(--epx-border-subtle); }
      .epx-colorpicker__alpha-field {
        display: flex; align-items: center; flex-shrink: 0;
        background: var(--epx-input-bg); border: 1px solid var(--epx-border);
        border-radius: 4px; padding: 0 5px; height: 26px; width: 50px;
      }
      .epx-colorpicker__alpha-field span { font-size: 11px; color: var(--epx-text-faint); }
      .epx-colorpicker__alpha-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        color: var(--epx-text); font-size: 11px; text-align: right; outline: none;
        -moz-appearance: textfield;
      }
      .epx-colorpicker__alpha-input::-webkit-inner-spin-button,
      .epx-colorpicker__alpha-input::-webkit-outer-spin-button { -webkit-appearance: none; }

      .epx-json-array { display: flex; flex-direction: column; gap: 6px; }
      .epx-json-array__header { display: flex; align-items: center; justify-content: space-between; }
      .epx-json-array__count { font-size: 11px; color: var(--epx-text-faint); }
      .epx-json-array__list { display: flex; flex-direction: column; gap: 4px; }
      .epx-json-array__item { border: 1px solid var(--epx-border); border-radius: 6px; overflow: hidden; }
      .epx-json-array__item.is-expanded { border-color: var(--epx-accent-light); }
      .epx-json-array__item-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: var(--epx-surface-2); cursor: pointer; user-select: none; }
      .epx-json-array__item-header:hover { background: var(--epx-hover-bg); }
      .epx-json-array__item-label { font-size: 12px; font-weight: 600; color: var(--epx-text-2); }
      .epx-json-array__item-actions { display: flex; gap: 2px; }
      .epx-json-array__item-body { padding: 10px; display: flex; flex-direction: column; gap: 10px; background: var(--epx-surface); }

      .epx-btn-add {
        padding: 6px 12px; border: 1px dashed var(--epx-accent-light); border-radius: 6px;
        background: var(--epx-accent-bg); color: var(--epx-accent); font-size: 12px; font-weight: 600;
        cursor: pointer; text-align: center; transition: background 0.1s;
      }
      .epx-btn-add:hover { background: var(--epx-accent-bg-hover); }

      .epx-icon-btn {
        width: 24px; height: 24px; border: none; background: none; cursor: pointer;
        border-radius: 4px; display: flex; align-items: center; justify-content: center;
        font-size: 14px; padding: 0; color: var(--epx-text-mid);
      }
      .epx-icon-btn:hover:not(:disabled) { background: var(--epx-border); }
      .epx-icon-btn.is-active { background: var(--epx-border); color: var(--epx-text); }
      .epx-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .epx-icon-btn--danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
      [data-mode="dark"] .epx-icon-btn--danger:hover:not(:disabled) { background: #3b0f0f; }
      .epx-icon-btn-group {
        display: flex; gap: 1px; margin-left: auto; flex-shrink: 0;
        border-radius: 5px; padding: 2px;
      }

      /* ── BackgroundControl ── */
      .epx-bg-ctrl__card {
        outline: 1px solid var(--epx-border);
        border-radius: 5px;
        background: var(--epx-input-bg);
      }
      .epx-bg-ctrl__type-tabs {
        display: flex; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__type-tab {
        flex: 1; height: 28px; border: none; background: none; cursor: pointer;
        color: var(--epx-text-faint); display: flex; align-items: center; justify-content: center;
        border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s;
      }
      .epx-bg-ctrl__type-tab:hover { color: var(--epx-text-mid); }
      .epx-bg-ctrl__type-tab.is-active { color: var(--epx-accent); border-bottom-color: var(--epx-accent); }
      .epx-bg-ctrl__body { border-top: 1px solid var(--epx-border-subtle); }
      .epx-layout-ctrl__body .epx-side-input:first-child { border-top: none; }
      .epx-layout-ctrl__body { container-type: inline-size; }
      @container (max-width: 280px) {
        .epx-layout-ctrl__body .epx-side-input { flex-wrap: wrap; height: auto; }
        .epx-layout-ctrl__body .epx-side-input__label--row { padding: 8px; }
        .epx-layout-ctrl__body .epx-icon-btn-group {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
          width: 100%; margin-left: 0;
        }
        .epx-layout-ctrl__body .epx-icon-btn { width: 100%; }
      }

      .epx-bg-ctrl__color-row {
        display: flex; align-items: center; gap: 6px; height: 28px;
        padding: 0 8px; position: relative; overflow: visible;
      }
      .epx-bg-ctrl__alpha-label { font-size: 10px; color: var(--epx-text-faint); flex-shrink: 0; }

      .epx-bg-ctrl__swatch {
        width: 14px; height: 14px; border-radius: 2px; flex-shrink: 0;
        border: 1px solid rgba(128,128,128,0.3); cursor: pointer; padding: 0;
        background-image: linear-gradient(45deg,#aaa 25%,transparent 25%),
          linear-gradient(-45deg,#aaa 25%,transparent 25%),
          linear-gradient(45deg,transparent 75%,#aaa 75%),
          linear-gradient(-45deg,transparent 75%,#aaa 75%);
        background-size: 6px 6px;
        background-position: 0 0, 0 3px, 3px -3px, -3px 0;
        overflow: hidden;
      }
      .epx-bg-ctrl__swatch-fill { width: 100%; height: 100%; display: block; }
      .epx-bg-ctrl__hex { font-size: 10px; color: var(--epx-text-muted); font-family: monospace; flex: 1; }

      .epx-bg-ctrl__stop {
        display: flex; align-items: center; gap: 5px; height: 28px;
        padding: 0 8px; border-top: 1px solid var(--epx-border-subtle);
        position: relative; overflow: visible;
      }
      .epx-bg-ctrl__stop-label {
        font-size: 10px; font-weight: 700; color: var(--epx-text-faint);
        text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-pos {
        width: 36px; border: none; background: transparent; color: var(--epx-text);
        font-size: 12px; text-align: right; outline: none; -moz-appearance: textfield;
        flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-pos::-webkit-inner-spin-button,
      .epx-bg-ctrl__stop-pos::-webkit-outer-spin-button { -webkit-appearance: none; }
      .epx-bg-ctrl__stop-unit { font-size: 10px; color: var(--epx-text-faint); flex-shrink: 0; }
      .epx-bg-ctrl__stop-remove {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 0; display: flex; align-items: center; transition: color 0.1s; flex-shrink: 0;
      }
      .epx-bg-ctrl__stop-remove:hover:not(:disabled) { color: #dc2626; }
      .epx-bg-ctrl__stop-remove:disabled { opacity: 0.3; cursor: not-allowed; }

      .epx-bg-ctrl__add-btn {
        margin: 5px 8px; padding: 5px 0; border: 1px dashed var(--epx-accent-light);
        border-radius: 5px; background: var(--epx-accent-bg); color: var(--epx-accent);
        font-size: 11px; font-weight: 600; cursor: pointer; text-align: center;
        transition: background 0.1s; width: calc(100% - 16px);
      }
      .epx-bg-ctrl__add-btn:hover:not(:disabled) { background: var(--epx-accent-bg-hover); }
      .epx-bg-ctrl__add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .epx-bg-ctrl__add-btn--media { margin-top: 6px; }

      .epx-bg-ctrl__grad-preview {
        position: relative; height: 6px; margin: 8px 8px 14px; border-radius: 3px;
        border: 1px solid var(--epx-border-subtle); overflow: visible;
      }
      .epx-bg-ctrl__grad-marker {
        position: absolute; top: 50%; transform: translate(-50%, -50%);
        width: 10px; height: 16px; cursor: ew-resize; display: flex;
        flex-direction: column; align-items: center; gap: 1px;
        filter: drop-shadow(0 1px 2px rgba(120,120,120,0.5));
      }
      .epx-bg-ctrl__grad-marker-arrow {
        width: 0; height: 0; flex-shrink: 0;
      }
      .epx-bg-ctrl__grad-marker-arrow--top {
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-bottom: 6px solid currentColor; margin-bottom: -1px;
      }
      .epx-bg-ctrl__grad-marker-arrow--bottom {
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-top: 6px solid currentColor; margin-top: -1px;
      }

      .epx-bg-ctrl__media-row {
        display: flex; align-items: center; gap: 7px; min-height: 36px;
        padding: 4px 8px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__thumb {
        width: 25px; height: 25px; border-radius: 3px; object-fit: cover; flex-shrink: 0;
        border: 1px solid var(--epx-border);
      }
      .epx-bg-ctrl__thumb-placeholder {
        width: 25px; height: 25px; border-radius: 3px; flex-shrink: 0;
        background: var(--epx-surface-2); border: 1px dashed var(--epx-border);
        display: flex; align-items: center; justify-content: center;
        color: var(--epx-text-faint);
      }
      .epx-bg-ctrl__media-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-bg-ctrl__media-btn {
        flex-shrink: 0; padding: 3px 8px; border: 1px solid var(--epx-border);
        border-radius: 4px; background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 11px; font-weight: 600; cursor: pointer;
        transition: color 0.1s, border-color 0.1s;
      }
      .epx-bg-ctrl__media-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }

      .epx-bg-ctrl__src-toggle {
        display: flex; gap: 4px; padding: 6px 8px;
        border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__src-btn {
        flex: 1; padding: 4px 0; border: 1px solid var(--epx-border); border-radius: 4px;
        background: var(--epx-input-bg); color: var(--epx-text-faint); font-size: 11px;
        font-weight: 600; cursor: pointer; transition: all 0.1s;
      }
      .epx-bg-ctrl__src-btn.is-active {
        background: var(--epx-accent-bg); color: var(--epx-accent);
        border-color: var(--epx-accent-light);
      }

      .epx-bg-ctrl__url-row {
        display: flex; align-items: center; height: 28px;
        padding: 0 8px; gap: 6px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__url-input {
        flex: 1; border: none; background: transparent; color: var(--epx-text);
        font-size: 12px; outline: none; min-width: 0;
      }
      .epx-bg-ctrl__url-input::placeholder { color: var(--epx-text-faint); font-style: italic; }

      .epx-bg-ctrl__slides { display: flex; flex-direction: column; }
      .epx-bg-ctrl__slide {
        display: flex; align-items: center; gap: 6px; height: 36px;
        padding: 0 8px; border-top: 1px solid var(--epx-border-subtle);
      }
      .epx-bg-ctrl__slide-drag {
        color: var(--epx-text-faint); cursor: grab; flex-shrink: 0;
        display: flex; align-items: center; touch-action: none;
      }
      .epx-bg-ctrl__slide-drag:active { cursor: grabbing; }
      .epx-bg-ctrl__slide-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-bg-ctrl__slide-remove {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 0; display: flex; align-items: center; transition: color 0.1s; flex-shrink: 0;
      }
      .epx-bg-ctrl__slide-remove:hover { color: #dc2626; }

      /* ── Toggle switch ── */
      .epx-toggle { display: inline-flex; align-items: center; cursor: pointer; }
      .epx-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
      .epx-toggle__track {
        position: relative; width: 28px; height: 16px;
        background: var(--epx-border); border-radius: 999px;
        transition: background 0.15s; flex-shrink: 0;
      }
      .epx-toggle input:checked ~ .epx-toggle__track { background: var(--epx-accent); }
      .epx-toggle__thumb {
        position: absolute; top: 2px; left: 2px;
        width: 12px; height: 12px; border-radius: 50%;
        background: #fff; transition: transform 0.15s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.25);
      }
      .epx-toggle input:checked ~ .epx-toggle__track .epx-toggle__thumb { transform: translateX(12px); }

      /* ── MediaPicker modal ── */
      .epx-media-picker {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center;
      }
      .epx-media-picker__panel {
        width: 540px; max-height: 72vh; background: var(--epx-surface);
        border: 1px solid var(--epx-border); border-radius: 10px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.3);
        display: flex; flex-direction: column; overflow: hidden;
        position: relative;
      }
      .epx-media-picker__header {
        display: flex; align-items: center; gap: 8px; padding: 11px 14px;
        border-bottom: 1px solid var(--epx-border); flex-shrink: 0;
      }
      .epx-media-picker__title { font-size: 14px; font-weight: 700; color: var(--epx-text-strong); flex: 1; }
      .epx-media-picker__close {
        background: none; border: none; cursor: pointer; color: var(--epx-text-faint);
        padding: 4px; border-radius: 4px; display: flex; align-items: center;
        transition: color 0.1s;
      }
      .epx-media-picker__close:hover { color: var(--epx-text); }
      .epx-media-picker__body { flex: 1; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: var(--epx-text-muted) transparent; }
      .epx-media-picker__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .epx-media-picker__item {
        aspect-ratio: 1; border-radius: 6px; overflow: hidden; cursor: pointer;
        border: 2px solid transparent; position: relative;
        background: var(--epx-surface-2); transition: border-color 0.15s;
      }
      .epx-media-picker__item:hover { border-color: var(--epx-accent-light); }
      .epx-media-picker__item.is-selected { border-color: var(--epx-accent); }
      .epx-media-picker__item img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .epx-media-picker__item-check {
        position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
        background: var(--epx-accent); border-radius: 50%; display: flex;
        align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.15s;
      }
      .epx-media-picker__item.is-selected .epx-media-picker__item-check { opacity: 1; }
      .epx-media-picker__item-name {
        position: absolute; bottom: 0; left: 0; right: 0; padding: 4px 6px;
        background: rgba(0,0,0,0.6); color: #fff; font-size: 10px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-media-picker__empty {
        text-align: center; color: var(--epx-text-faint); padding: 40px 0; font-size: 13px;
      }
      .epx-media-picker__load-more {
        width: 100%; margin-top: 10px; padding: 8px 0;
        border: 1px solid var(--epx-border); border-radius: 6px;
        background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 12px; font-weight: 600; cursor: pointer; transition: color 0.1s;
      }
      .epx-media-picker__load-more:hover { color: var(--epx-accent); }
      .epx-media-picker__footer {
        display: flex; align-items: center; justify-content: flex-end; gap: 8px;
        padding: 10px 14px; border-top: 1px solid var(--epx-border); flex-shrink: 0;
      }
      .epx-media-picker__confirm {
        padding: 6px 14px; background: var(--epx-accent); color: #fff;
        border: none; border-radius: 6px; font-size: 13px; font-weight: 600;
        cursor: pointer; transition: background 0.1s;
      }
      .epx-media-picker__confirm:hover { background: var(--epx-accent-hover); }
      .epx-media-picker__cancel {
        padding: 6px 14px; background: none; color: var(--epx-text-mid);
        border: 1px solid var(--epx-border); border-radius: 6px; font-size: 13px;
        cursor: pointer; transition: border-color 0.1s, color 0.1s;
      }
      .epx-media-picker__cancel:hover { color: var(--epx-text); border-color: var(--epx-text-muted); }

      /* upload button in header */
      .epx-media-picker__upload-btn {
        flex-shrink: 0; display: flex; align-items: center; padding: 4px 10px;
        border: 1px solid var(--epx-border); border-radius: 5px;
        background: var(--epx-input-bg); color: var(--epx-text-mid);
        font-size: 11px; font-weight: 600; cursor: pointer; transition: color 0.1s, border-color 0.1s;
      }
      .epx-media-picker__upload-btn:hover { color: var(--epx-accent); border-color: var(--epx-accent); }

      /* drag-over state */
      .epx-media-picker__panel--drag { outline: 2px dashed var(--epx-accent); outline-offset: -3px; }
      .epx-media-picker__drop-overlay {
        position: absolute; inset: 0; z-index: 10; border-radius: 10px;
        background: rgba(var(--epx-accent-rgb, 99,102,241), 0.12);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 8px; color: var(--epx-accent); font-size: 14px; font-weight: 600;
        pointer-events: none;
      }

      /* upload progress list */
      .epx-media-picker__uploads {
        border-bottom: 1px solid var(--epx-border); padding: 6px 12px;
        display: flex; flex-direction: column; gap: 4px; flex-shrink: 0;
        max-height: 96px; overflow-y: auto;
      }
      .epx-media-picker__upload-item {
        display: flex; align-items: center; gap: 8px; min-height: 20px;
      }
      .epx-media-picker__upload-name {
        flex: 1; font-size: 11px; color: var(--epx-text-2);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .epx-media-picker__upload-bar {
        width: 80px; height: 4px; border-radius: 2px;
        background: var(--epx-border); overflow: hidden; flex-shrink: 0;
      }
      .epx-media-picker__upload-fill {
        height: 100%; border-radius: 2px;
        background: var(--epx-accent); transition: width 0.1s;
      }
      .epx-media-picker__upload-done { color: var(--epx-accent); font-size: 12px; font-weight: 700; flex-shrink: 0; }
      .epx-media-picker__upload-error { color: #dc2626; font-size: 11px; flex-shrink: 0; }

      /* video thumbnail placeholder in grid */
      .epx-media-picker__video-thumb {
        width: 100%; height: 100%;
        background: #1e293b; display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.5);
      }

      .epx-builder--loading, .epx-builder--error {
        position: fixed; inset: 0; z-index: 9999; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px; color: var(--epx-text-muted); background: var(--epx-bg);
        color-scheme: light dark;
      }
      .epx-spinner {
        width: 32px; height: 32px; border: 3px solid var(--epx-spinner-track);
        border-top-color: var(--epx-accent); border-radius: 50%;
        animation: epx-spin 0.8s linear infinite;
      }
      @keyframes epx-spin { to { transform: rotate(360deg); } }
      .epx-error { color: #ef4444; }

      /* ── Breakpoint switcher ── */
      .epx-bp-switcher {
        display: flex;
        gap: 2px;
        align-items: center;
        background: var(--epx-input-bg);
        border: 1px solid var(--epx-input-border);
        border-radius: 6px;
        padding: 2px;
      }
      .epx-bp-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 26px;
        padding: 0;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        color: var(--epx-text-muted);
        transition: background 0.1s, color 0.1s, border-color 0.1s;
        flex-shrink: 0;
      }
      .epx-bp-btn:hover {
        background: var(--epx-hover-bg);
        color: var(--epx-text);
      }
      .epx-bp-btn.is-active {
        background: var(--epx-accent);
        border-color: var(--epx-accent);
        color: #fff;
      }

      /* ── Canvas preview frame ── */
      .epx-canvas--preview {
        overflow-x: auto;
      }
      .epx-canvas__preview-frame {
        min-height: 100%;
      }

      /* ── Canvas resizable (side drag handles) ── */
      .epx-canvas--resizable {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        overflow-x: auto;
        margin: 0 auto;
      }
      .epx-canvas__side-handle {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: ew-resize;
        min-width: 18px;
        max-width: 18px;
        padding: 0 6px;
        position: relative;
        user-select: none;
      }
      .epx-canvas__side-handle--left {
        align-items: flex-end;
        border-right: 2px solid var(--epx-border);
      }
      .epx-canvas__side-handle--right {
        align-items: flex-start;
        border-left: 2px solid var(--epx-border);
      }
      .epx-canvas__side-handle:hover {
        background: var(--epx-hover-bg);
      }
      .epx-canvas__side-handle:hover .epx-canvas__side-grip {
        background: var(--epx-accent);
      }
      .epx-canvas__side-handle:hover + .epx-canvas__preview-frame,
      .epx-canvas__preview-frame + .epx-canvas__side-handle:hover {
        border-color: var(--epx-accent);
      }
      .epx-canvas__side-grip {
        width: 3px;
        height: 32px;
        background: var(--epx-border);
        border-radius: 2px;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .epx-canvas__side-label {
        font-size: 10px;
        color: var(--epx-text-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      /* ── Settings panel (left panel page tab) ── */
      .epx-settings-panel {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
        flex: 1;
      }
      .epx-settings-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .epx-settings-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--epx-text-muted);
        padding-bottom: 2px;
        border-bottom: 1px solid var(--epx-border);
      }
      .epx-bp-toggles {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .epx-bp-toggle {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12px;
        color: var(--epx-text);
        padding: 3px 0;
        cursor: pointer;
        user-select: none;
      }
      .epx-bp-toggle input[type="checkbox"] {
        accent-color: var(--epx-accent);
        width: 13px;
        height: 13px;
        cursor: pointer;
        flex-shrink: 0;
      }
      .epx-bp-values {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding-top: 4px;
        border-top: 1px solid var(--epx-border);
        margin-top: 4px;
      }
    `}</style>
  );
}
