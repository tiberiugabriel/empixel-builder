import React, { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import type { SectionBlock, BlockType, BreakpointId, BreakpointsConfig, PageLayout } from "../../types.js";
import { isContainerType, BREAKPOINT_DEFS, DEFAULT_BREAKPOINTS_CONFIG } from "../../types.js";
import { getBlockDef } from "../blockDefinitions.js";
import { LeftPanel } from "../LeftPanel.js";
import { Canvas, CANVAS_DROP_ID, type BlockDragData, type EmptyZoneData } from "../Canvas.js";
import { RightPanel } from "../RightPanel.js";
import { StructurePanel, type StructureDropTarget } from "../StructurePanel.js";
import { ContextMenu } from "../ContextMenu.js";
import {
  findBlockById,
  findPath,
  isDescendant,
  deepCloneBlock,
} from "../treeUtils.js";
import { reducer, initialState } from "./builderReducer.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import { BreakpointSwitcher } from "../components/BreakpointSwitcher.js";
import { DragGhost } from "../components/DragGhost.js";

export function Builder({ pageId, pageTitle, collection, onBack }: { pageId: string; pageTitle: string; collection: string; onBack: () => void }) {
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
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const prevLeftWidth = useRef(220);
  const prevRightWidth = useRef(280);

  // Structure panel state
  const [structureHeight, setStructureHeight] = useState(240);
  const [structureCollapsed, setStructureCollapsed] = useState(false);

  // Context menu & clipboard
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [clipboardBlock, setClipboardBlock] = useState<SectionBlock | null>(null);
  const [clipboardSettings, setClipboardSettings] = useState<Record<string, unknown> | null>(null);

  // Breakpoints
  const [activeBreakpoint, setActiveBreakpoint_] = useState<BreakpointId>("desktop");
  const [liveCanvasWidth, setLiveCanvasWidth] = useState<number | null>(null);
  const setActiveBreakpoint = useCallback((id: BreakpointId) => {
    setActiveBreakpoint_(id);
    setLiveCanvasWidth(null);
  }, []);
  const [breakpointsConfig, setBreakpointsConfig] = useState<BreakpointsConfig>(DEFAULT_BREAKPOINTS_CONFIG);
  const [isBreakpointsDirty, setIsBreakpointsDirty] = useState(false);

  const handleBreakpointsChange = useCallback((config: BreakpointsConfig) => {
    setBreakpointsConfig(config);
    setIsBreakpointsDirty(true);
  }, []);

  const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
    if (leftCollapsed) return;
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
  }, [leftWidth, leftCollapsed]);

  const handleLeftDoubleClick = useCallback(() => {
    if (leftCollapsed) {
      setLeftCollapsed(false);
      setLeftWidth(prevLeftWidth.current);
    } else {
      prevLeftWidth.current = leftWidth;
      setLeftCollapsed(true);
    }
  }, [leftCollapsed, leftWidth]);

  const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
    if (rightCollapsed) return;
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
  }, [rightWidth, rightCollapsed]);

  const handleRightDoubleClick = useCallback(() => {
    if (rightCollapsed) {
      setRightCollapsed(false);
      setRightWidth(prevRightWidth.current);
    } else {
      prevRightWidth.current = rightWidth;
      setRightCollapsed(true);
    }
  }, [rightCollapsed, rightWidth]);

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
      .catch(() => { });
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
        dispatch({
          type: "MOVE_BLOCK", sourceId,
          targetContainerId: path.level === "container" ? path.containerId : null,
          targetSlotIndex: path.level === "container" ? path.slotIndex : null,
          targetIndex: position === "before" ? path.index : path.index + 1,
        });
      } else {
        const container = findBlockById(targetId, sections);
        dispatch({
          type: "MOVE_BLOCK", sourceId,
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

  const duplicateBlock = useCallback((id: string) => {
    dispatch({ type: "DUPLICATE_BLOCK", id });
  }, []);

  const copyBlock = useCallback((id: string) => {
    const block = findBlockById(id, sectionsRef.current);
    if (block) setClipboardBlock(deepCloneBlock(block));
  }, []);

  const copyBlockSettings = useCallback((id: string) => {
    const block = findBlockById(id, sectionsRef.current);
    if (block) setClipboardSettings({ ...block.config });
  }, []);

  const pasteBlock = useCallback((afterId: string) => {
    if (!clipboardBlock) return;
    const clone = deepCloneBlock(clipboardBlock);
    dispatch({ type: "INSERT_AFTER", afterId, block: clone });
  }, [clipboardBlock]);

  const pasteBlockSettings = useCallback((id: string) => {
    if (!clipboardSettings) return;
    dispatch({ type: "PASTE_SETTINGS", id, config: clipboardSettings });
  }, [clipboardSettings]);

  const showContextMenu = useCallback((e: React.MouseEvent, blockId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, blockId });
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

        <div className="epx-builder__panels" style={{ gridTemplateColumns: `${leftCollapsed ? 0 : leftWidth}px 4px 1fr 4px ${rightCollapsed ? 0 : rightWidth}px` }}>
          <LeftPanel
            onAddBlock={addBlock}
            breakpointsConfig={breakpointsConfig}
            onBreakpointsChange={handleBreakpointsChange}
          />
          <div
            className={`epx-resize-handle${leftCollapsed ? " is-collapsed" : ""}`}
            onMouseDown={handleLeftResizeStart}
            onDoubleClick={handleLeftDoubleClick}
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
            className={`epx-resize-handle${rightCollapsed ? " is-collapsed" : ""}`}
            onMouseDown={handleRightResizeStart}
            onDoubleClick={handleRightDoubleClick}
          />
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
                    activeBreakpoint={activeBreakpoint}
                    breakpointsConfig={breakpointsConfig}
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
              onBlockContextMenu={showContextMenu}
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canPaste={clipboardBlock !== null}
          canPasteSettings={clipboardSettings !== null}
          onEdit={() => { selectBlock(contextMenu.blockId); setContextMenu(null); }}
          onDuplicate={() => { duplicateBlock(contextMenu.blockId); setContextMenu(null); }}
          onCopy={() => { copyBlock(contextMenu.blockId); setContextMenu(null); }}
          onCopySettings={() => { copyBlockSettings(contextMenu.blockId); setContextMenu(null); }}
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
