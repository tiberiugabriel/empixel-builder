import { useCallback, useRef, useState } from "react";

export interface ResizeHandleOptions {
  /** "x" → horizontal column resize, "y" → vertical row resize. */
  axis: "x" | "y";
  /** When true, larger pointer delta produces a SMALLER size. Used by the
   *  right panel (drag left to widen) and the structure panel (drag up to
   *  grow). */
  invert?: boolean;
  min: number;
  max: number;
  initial: number;
  /** When true, double-click toggles collapse, restoring the previous size
   *  on expand. Skipped for the structure panel. */
  collapsible?: boolean;
}

export interface ResizeHandleState {
  size: number;
  collapsed: boolean;
  setSize: (n: number) => void;
  setCollapsed: (b: boolean) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

/**
 * Drag-to-resize hook used by every panel split in the builder. Owns:
 *   - current size (px), bounded by [min, max]
 *   - collapsed flag (when collapsible)
 *   - previous-size memory across collapse cycles
 *   - global cursor + user-select lock for the duration of the drag
 *
 * Replaces three near-identical inline handlers in Builder.tsx (audit H4).
 */
export function useResizeHandle(opts: ResizeHandleOptions): ResizeHandleState {
  const { axis, invert = false, min, max, initial, collapsible = false } = opts;
  const [size, setSize] = useState(initial);
  const [collapsed, setCollapsed] = useState(false);
  const prevSize = useRef(initial);

  const cursor = axis === "x" ? "col-resize" : "row-resize";

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (collapsible && collapsed) return;
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const startSize = size;
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const cur = axis === "x" ? ev.clientX : ev.clientY;
      const raw = invert ? startSize - (cur - start) : startSize + (cur - start);
      setSize(Math.max(min, Math.min(max, raw)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [axis, cursor, invert, min, max, size, collapsed, collapsible]);

  const onDoubleClick = useCallback(() => {
    if (!collapsible) return;
    if (collapsed) {
      setCollapsed(false);
      setSize(prevSize.current);
    } else {
      prevSize.current = size;
      setCollapsed(true);
    }
  }, [collapsed, collapsible, size]);

  return { size, collapsed, setSize, setCollapsed, onMouseDown, onDoubleClick };
}
