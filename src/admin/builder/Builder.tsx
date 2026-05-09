import React, { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { SectionBlock, BlockType, BreakpointId } from "../../types.js";
import { isContainerType, isRootAllowedType, BREAKPOINT_DEFS, DEFAULT_BREAKPOINTS_CONFIG } from "../../types.js";
import { getBlockDef } from "../blockDefinitions.js";
import { LeftPanel } from "../LeftPanel.js";
import { Canvas } from "../Canvas.js";
import { StructurePanel, type StructureDropTarget } from "../StructurePanel.js";

/**
 * F4.3 — `RightPanel` is the heaviest admin component (it pulls in
 * every section renderer + every control under `controls/` + the full
 * `blockDefinitions.ts` graph). Lazy-import so the consumer bundler
 * can split it into its own chunk; the panel only mounts after a
 * block is selected, which is plenty of time for the chunk to fetch.
 *
 * Loading fallback is a dimension-matched empty placeholder
 * (`epx-right-panel epx-right-panel--loading`) — same width / shape as
 * the loaded component, so opening the panel doesn't shift adjacent
 * canvas / structure-panel layout.
 */
const RightPanel = lazy(() =>
  import("../RightPanel.js").then((m) => ({ default: m.RightPanel })),
);
import { ContextMenu } from "../ContextMenu.js";
import {
  findBlockById,
  findPath,
  deepCloneBlock,
} from "../treeUtils.js";
import { historyReducer, initialHistoryState } from "./builderReducer.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import { BreakpointSwitcher } from "../components/BreakpointSwitcher.js";
import { DragGhost } from "../components/DragGhost.js";
import { useResizeHandle } from "./hooks/useResizeHandle.js";
import { useBlockClipboard } from "./hooks/useBlockClipboard.js";
import { useBuilderPersistence } from "./hooks/useBuilderPersistence.js";
import { useDragHandlers } from "./hooks/useDragHandlers.js";

export function Builder({ pageId, pageTitle, collection, onBack }: { pageId: string; pageTitle: string; collection: string; onBack: () => void }) {
  const [historyState, dispatch] = useReducer(historyReducer, initialHistoryState);
  // `state` keeps the previous shape so existing reads stay unchanged. The
  // history wrapper lives one level up and feeds Undo / Redo.
  const state = historyState.present;
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

  // Panel resize — three near-identical drag handlers replaced by one hook.
  const left = useResizeHandle({ axis: "x", min: 160, max: 420, initial: 220, collapsible: true });
  const right = useResizeHandle({ axis: "x", invert: true, min: 200, max: 520, initial: 280, collapsible: true });
  const structure = useResizeHandle({ axis: "y", invert: true, min: 120, max: 600, initial: 240 });
  const [structureCollapsed, setStructureCollapsed] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);

  // Block clipboard (full block + settings-only) extracted into a hook.
  const clipboard = useBlockClipboard(sectionsRef);

  // Breakpoints
  const [activeBreakpoint, setActiveBreakpoint_] = useState<BreakpointId>("desktop");
  const [liveCanvasWidth, setLiveCanvasWidth] = useState<number | null>(null);
  const setActiveBreakpoint = useCallback((id: BreakpointId) => {
    setActiveBreakpoint_(id);
    setLiveCanvasWidth(null);
  }, []);
  // Layout + breakpoints persistence (load + save + beforeunload guard).
  const persistence = useBuilderPersistence({
    pageId,
    collection,
    sections: state.sections,
    isDirty: state.isDirty,
    dispatch,
  });
  const { breakpointsConfig, setBreakpointsConfig, isBreakpointsDirty, save } = persistence;
  const handleBreakpointsChange = setBreakpointsConfig;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Drag handlers — same three branches (structure / new-block / canvas) as
  // before, just relocated to the dedicated hook (audit H4 finalize).
  const { onDragStart: handleDragStart, onDragOver: handleDragOver, onDragEnd: handleDragEnd } = useDragHandlers({
    sectionsRef,
    dispatch,
    setOverBlockId,
    structureDropTargetRef,
    setStructureDropTarget,
  });

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

    // No container context — only root-allowed blocks (container / html /
    // divider-spacer) may sit at the canvas root.
    if (!isRootAllowedType(type)) return;

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

  const duplicateBlock = useCallback((id: string) => {
    dispatch({ type: "DUPLICATE_BLOCK", id });
  }, []);

  const pasteBlock = useCallback((afterId: string) => {
    if (!clipboard.clipboardBlock) return;
    const clone = deepCloneBlock(clipboard.clipboardBlock);
    dispatch({ type: "INSERT_AFTER", afterId, block: clone });
  }, [clipboard.clipboardBlock]);

  const pasteBlockSettings = useCallback((id: string) => {
    if (!clipboard.clipboardSettings) return;
    dispatch({ type: "PASTE_SETTINGS", id, config: clipboard.clipboardSettings });
  }, [clipboard.clipboardSettings]);

  const showContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, blockId });
  }, []);

  // Cmd/Ctrl+Z → UNDO; Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) → REDO.
  // Skipped when an editable element has focus, so typing inside fields
  // keeps the browser-native undo behaviour for text inputs.
  useEffect(() => {
    function isEditableTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (isEditableTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        dispatch({ type: "REDO" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Detect overflow on labels so CSS ::after can show "..." indicator.
  useEffect(() => {
    const SEL = ".epx-side-input__label--full, .epx-spacing-ctrl__label";
    const watched = new WeakMap<Element, ResizeObserver>();
    const update = (el: HTMLElement) => {
      const overflow = el.scrollWidth > el.clientWidth + 1;
      if ((el.dataset.overflow === "true") !== overflow) {
        el.dataset.overflow = overflow ? "true" : "false";
      }
    };
    const watch = (el: HTMLElement) => {
      if (watched.has(el)) return;
      update(el);
      const ro = new ResizeObserver(() => update(el));
      ro.observe(el);
      watched.set(el, ro);
    };
    const scan = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(SEL).forEach(watch);
    };
    scan(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.matches(SEL)) watch(n);
            scan(n);
          }
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); };
  }, []);

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

  // Resize bounds: null for desktop; [nextSmaller, currentMax] for others
  const resizeBounds: { min: number; max: number } | null = (() => {
    if (activeBreakpoint === "desktop") return null;
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
            <a
              className="epx-topbar__page-id"
              href={`/${collection}/${pageId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {pageTitle}
              <svg className="epx-topbar__page-id-icon" width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 1h3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M11 1 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
          <div className="epx-topbar__center">
            {(state.isDirty || isBreakpointsDirty) && <span className="epx-topbar__unsaved">Unsaved changes</span>}
            {state.saveError && <span className="epx-topbar__error">Error: {state.saveError}</span>}
          </div>
          <div className="epx-topbar__right">
            {activeBreakpoint !== "desktop" && (
              <span className="epx-canvas__size-label">
                {liveCanvasWidth ?? previewWidth}px
              </span>
            )}
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

        <div className="epx-builder__panels" style={{ gridTemplateColumns: `${left.collapsed ? 0 : left.size}px 4px 1fr 4px ${right.collapsed ? 0 : right.size}px` }}>
          <LeftPanel
            onAddBlock={addBlock}
            breakpointsConfig={breakpointsConfig}
            onBreakpointsChange={handleBreakpointsChange}
          />
          <div
            className={`epx-resize-handle${left.collapsed ? " is-collapsed" : ""}`}
            onMouseDown={left.onMouseDown}
            onDoubleClick={left.onDoubleClick}
          />
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
            onWidthChange={setLiveCanvasWidth}
            onBlockContextMenu={showContextMenu}
            activeBreakpoint={activeBreakpoint}
          />
          <div
            className={`epx-resize-handle${right.collapsed ? " is-collapsed" : ""}`}
            onMouseDown={right.onMouseDown}
            onDoubleClick={right.onDoubleClick}
          />
          <div className="epx-right-column">
            {selectedBlock && (
              <>
                <div
                  className="epx-right-column__settings"
                  style={structureCollapsed
                    ? { flex: 1 }
                    : { height: `calc(100% - ${structure.size}px - 4px)` }
                  }
                >
                  <Suspense
                    fallback={
                      <aside
                        className="epx-right-panel epx-right-panel--loading"
                        aria-busy="true"
                      />
                    }
                  >
                    <RightPanel
                      block={selectedBlock}
                      onChange={(config) => updateBlock(selectedBlock.id, config)}
                      activeBreakpoint={activeBreakpoint}
                      breakpointsConfig={breakpointsConfig}
                    />
                  </Suspense>
                </div>
                {!structureCollapsed && (
                  <div
                    className="epx-resize-handle epx-resize-handle--row"
                    onMouseDown={structure.onMouseDown}
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
              onBlockContextMenu={showContextMenu}
              style={structureCollapsed
                ? { flexShrink: 0, marginTop: "auto" }
                : selectedBlock
                  ? { height: structure.size, flexShrink: 0 }
                  : { flex: 1 }
              }
            />
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null} zIndex={99999}>
        <DragGhost sections={state.sections} />
      </DragOverlay>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canPaste={clipboard.canPaste}
          canPasteSettings={clipboard.canPasteSettings}
          onEdit={() => { selectBlock(contextMenu.blockId); setContextMenu(null); }}
          onDuplicate={() => { duplicateBlock(contextMenu.blockId); setContextMenu(null); }}
          onCopy={() => { clipboard.copyBlock(contextMenu.blockId); setContextMenu(null); }}
          onCopySettings={() => { clipboard.copySettings(contextMenu.blockId); setContextMenu(null); }}
          onPaste={() => { pasteBlock(contextMenu.blockId); setContextMenu(null); }}
          onPasteSettings={() => { pasteBlockSettings(contextMenu.blockId); setContextMenu(null); }}
          onDelete={() => { removeBlock(contextMenu.blockId); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

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
