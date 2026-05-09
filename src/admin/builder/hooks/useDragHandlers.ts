import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import type { SectionBlock, BlockType } from "../../../types.js";
import { isRootAllowedType } from "../../../types.js";
import { findBlockById, findPath, isDescendant } from "../../treeUtils.js";
import { getBlockDef } from "../../blockDefinitions.js";
import { CANVAS_DROP_ID, type BlockDragData, type EmptyZoneData } from "../../Canvas.js";
import type { StructureDropTarget } from "../../StructurePanel.js";
import type { HistoryAction } from "../builderReducer.js";

interface Options {
  sectionsRef: MutableRefObject<SectionBlock[]>;
  dispatch: Dispatch<HistoryAction>;
  setOverBlockId: (id: string | null) => void;
  structureDropTargetRef: MutableRefObject<StructureDropTarget>;
  setStructureDropTarget: (val: StructureDropTarget) => void;
}

/**
 * @dnd-kit drag handlers extracted from Builder.tsx (audit H4 finalize).
 * Three branches: structure-panel drag (reorder via the layer tree),
 * new-block drag (palette → canvas), canvas-block drag (move / reorder).
 *
 * Reads always go through `sectionsRef` so the handlers see the latest tree
 * even when triggered from a long-running pointer interaction.
 */
export function useDragHandlers({
  sectionsRef,
  dispatch,
  setOverBlockId,
  structureDropTargetRef,
  setStructureDropTarget,
}: Options) {
  const onDragStart = useCallback((_: DragStartEvent) => {
    // ghost is rendered via DragGhost reading from useDndContext directly
  }, []);

  const onDragOver = useCallback(({ active, over, delta, activatorEvent }: DragOverEvent) => {
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
  }, [setStructureDropTarget, setOverBlockId]);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setOverBlockId(null);

    const sections = sectionsRef.current;
    const activeData = active.data.current as
      | BlockDragData
      // F4.4 — `field` slot is set when the dragged card came from the
      // "Bound to this entry" palette section. Pre-fills
      // `config.field` + `config.as` on the freshly-created block.
      | { kind: "new-block"; blockType: BlockType; field?: string }
      | { kind: "structure-block"; blockId: string }
      | undefined;

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
          type: "MOVE_BLOCK",
          sourceId,
          targetContainerId: path.level === "container" ? path.containerId : null,
          targetSlotIndex: path.level === "container" ? path.slotIndex : null,
          targetIndex: position === "before" ? path.index : path.index + 1,
        });
      } else {
        const container = findBlockById(targetId, sections);
        dispatch({
          type: "MOVE_BLOCK",
          sourceId,
          targetContainerId: targetId,
          targetSlotIndex: null,
          targetIndex: container?.children?.length ?? 0,
        });
      }
      return;
    }

    // ── New block dragged from palette ──
    if (activeData?.kind === "new-block") {
      const { blockType, field } = activeData as { kind: "new-block"; blockType: BlockType; field?: string };
      const def = getBlockDef(blockType);
      if (!def) return;
      // F4.4 — when the drag came from the LeftPanel "Bound to this
      // entry" section, `field` carries the entry-key the user wants
      // to bind. Pre-fill `config.field` and pick a sensible
      // `config.as` (title→h1, excerpt→p, default→p) so the new
      // block lands ready to render. Authors can rebind via the
      // Fields tab afterward.
      const config: Record<string, unknown> = { ...def.defaultConfig };
      if (blockType === "field-binding" && typeof field === "string" && field.length > 0) {
        config.field = field;
        config.as = field === "title" ? "h1" : field === "excerpt" ? "p" : "p";
      }
      const newBlock: SectionBlock = { id: crypto.randomUUID(), type: blockType, config };

      if (!over) return;
      const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

      if (over.id === CANVAS_DROP_ID) {
        // Only root-allowed types (container / html / divider-spacer) may
        // be dropped at the canvas root; other leaves must land inside a
        // container.
        if (!isRootAllowedType(blockType)) return;
        dispatch({ type: "ADD_BLOCK", block: newBlock });
        return;
      }
      if (overData?.kind === "empty-zone") {
        const ezd = overData as EmptyZoneData;
        dispatch({ type: "ADD_TO_CONTAINER", containerId: ezd.containerId, slotIndex: ezd.slotIndex ?? undefined, block: newBlock });
        return;
      }
      if ((overData as BlockDragData)?.isContainer) {
        dispatch({ type: "ADD_TO_CONTAINER", containerId: String(over.id), block: newBlock });
        return;
      }
      dispatch({ type: "INSERT_AFTER", afterId: String(over.id), block: newBlock });
      return;
    }

    // ── Canvas block reorder / move ──
    if (activeData?.kind !== "block") return;
    if (active.id === over?.id) return;
    if (!over) return;

    const overData = over.data.current as EmptyZoneData | BlockDragData | undefined;

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

    if (overBlockData?.isContainer && !activeBlockData.isContainer) {
      const container = findBlockById(String(over.id), sections);
      const targetIndex = container?.children?.length ?? 0;
      dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: String(over.id), targetSlotIndex: null, targetIndex });
      return;
    }

    if (activeContainerId === overContainerId && activeSlotIndex === overSlotIndex) {
      if (activeContainerId === null) {
        const oldIdx = sections.findIndex((s) => s.id === active.id);
        const newIdx = sections.findIndex((s) => s.id === over.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const next = [...sections];
          const [removed] = next.splice(oldIdx, 1);
          next.splice(newIdx, 0, removed);
          dispatch({ type: "REORDER", sections: next });
        }
      } else {
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

    const path = findPath(String(over.id), sections);
    const targetIndex = path ? path.index : 0;
    dispatch({ type: "MOVE_BLOCK", sourceId: String(active.id), targetContainerId: overContainerId, targetSlotIndex: overSlotIndex, targetIndex });
  }, [sectionsRef, dispatch, setOverBlockId, structureDropTargetRef, setStructureDropTarget]);

  return { onDragStart, onDragOver, onDragEnd };
}
