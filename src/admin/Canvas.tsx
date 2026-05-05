import React, { memo, useCallback, useEffect, useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SectionBlock, BlockType, BreakpointId } from "../types.js";
import { isContainerType } from "../types.js";
import { PREVIEW_COMPONENTS } from "./previews/index.js";
import { BlockOverlay } from "./BlockOverlay.js";
import { hexToRgbVals, hexToRgba, type GradientStop } from "./controls/BackgroundControl.js";
import { buildHoverCss } from "../components/styleUtils.js";

export const CANVAS_DROP_ID = "canvas-drop";

// ─── Drag data types (exported for BuilderPage) ───────────────────────────────

export type BlockDragData = {
  kind: "block";
  containerId: string | null;
  slotIndex: number | null;
  isContainer: boolean;
};

export type EmptyZoneData = {
  kind: "empty-zone";
  containerId: string;
  slotIndex: number | null;
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const BORDER_RADIUS_MAP: Record<string, string> = {
  none: "0", sm: "4px", md: "8px", lg: "16px", full: "9999px",
};

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: "640px", md: "768px", lg: "1140px", full: "100%",
};

function css(v: unknown): string | number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "") return v.startsWith("@@") ? v.slice(2) || undefined : v;
  return undefined;
}

function getBgStyle(style: Record<string, unknown>): React.CSSProperties {
  const type = style.backgroundType as string | undefined;
  if (!type) return {};

  if (type === "color") {
    const color = (style.backgroundColor as string) ?? "#ffffff";
    const alpha = (style.backgroundColorAlpha as number) ?? 1;
    return { background: hexToRgba(color, alpha) };
  }

  if (type === "gradient") {
    const angle = (style.backgroundGradAngle as number) ?? 135;
    let stops: GradientStop[] = [];
    try { stops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); } catch { /**/ }
    if (stops.length < 2) return {};
    const parts = [...stops]
      .sort((a, b) => a.pos - b.pos)
      .map(s => `rgba(${hexToRgbVals(s.color).join(",")},${s.alpha}) ${s.pos}%`)
      .join(",");
    return { background: `linear-gradient(${angle}deg,${parts})` };
  }

  if (type === "image") {
    const src    = style.backgroundImageSrc as string | undefined;
    const imgUrl = src === "url"
      ? (style.backgroundImageUrl as string | undefined)
      : (() => { const k = style.backgroundImageStorageKey as string | undefined; return k ? `/_emdash/api/media/file/${k}` : undefined; })();
    if (!imgUrl) return {};
    return {
      backgroundImage:      `url(${imgUrl})`,
      backgroundSize:       (style.backgroundImageSize       as string) || "cover",
      backgroundPosition:   (style.backgroundImagePosition   as string) || "center",
      backgroundRepeat:     (style.backgroundImageRepeat     as string) || "no-repeat",
      backgroundAttachment: (style.backgroundImageAttachment as string) || undefined,
    };
  }

  if (type === "video") {
    const vSize = (style.backgroundVideoSize     as string) || "cover";
    const vPos  = (style.backgroundVideoPosition as string) || "center";
    const fkey = style.backgroundVideoFallbackStorageKey as string | undefined;
    if (fkey) return { backgroundImage: `url(/_emdash/api/media/file/${fkey})`, backgroundSize: vSize, backgroundPosition: vPos };
    // YouTube thumbnail preview
    const url = style.backgroundVideoUrl as string | undefined;
    if (url) {
      const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (yt) return { backgroundImage: `url(https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg)`, backgroundSize: vSize, backgroundPosition: vPos };
    }
    return { background: "#0f172a" };
  }

  if (type === "slideshow") {
    let slides: Array<{ storageKey?: string }> = [];
    try { slides = JSON.parse((style.backgroundSlides as string) ?? "[]"); } catch { /**/ }
    const first = slides[0];
    if (first?.storageKey) {
      return { backgroundImage: `url(/_emdash/api/media/file/${first.storageKey})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    return { background: "#1e293b" };
  }

  return {};
}

function getBpOverride(config: Record<string, unknown>, activeBreakpoint: BreakpointId): Record<string, unknown> | undefined {
  if (activeBreakpoint === "desktop") return undefined;
  const styleBreakpoints = config.styleBreakpoints as Record<string, Record<string, unknown>> | undefined;
  return styleBreakpoints?.[activeBreakpoint];
}

function resolveBlockStyle(config: Record<string, unknown>, bpStyle?: Record<string, unknown>): {
  outerStyle: React.CSSProperties;
  innerStyle: React.CSSProperties;
} {
  const base = (config.style ?? {}) as Record<string, unknown>;
  const dark = (config.styleDark ?? {}) as Record<string, unknown>;
  const resolved = (config.theme as string) === "dark" ? { ...base, ...dark } : base;
  const style = bpStyle ? { ...resolved, ...bpStyle } : resolved;
  const outerStyle: React.CSSProperties = {};
  const innerStyle: React.CSSProperties = {};
  if (css(style.marginTop) !== undefined)    innerStyle.marginTop    = css(style.marginTop)    as string | number;
  if (css(style.marginRight) !== undefined)  innerStyle.marginRight  = css(style.marginRight)  as string | number;
  if (css(style.marginBottom) !== undefined) innerStyle.marginBottom = css(style.marginBottom) as string | number;
  if (css(style.marginLeft) !== undefined)   innerStyle.marginLeft   = css(style.marginLeft)   as string | number;
  if (css(style.width) !== undefined)     innerStyle.width     = css(style.width)     as string;
  if (css(style.minWidth) !== undefined)  innerStyle.minWidth  = css(style.minWidth)  as string;
  if (css(style.height) !== undefined)    innerStyle.height    = css(style.height)    as string;
  if (css(style.minHeight) !== undefined) innerStyle.minHeight = css(style.minHeight) as string;
  if (css(style.maxHeight) !== undefined) innerStyle.maxHeight = css(style.maxHeight) as string;
  if (css(style.paddingTop) !== undefined) innerStyle.paddingTop = css(style.paddingTop) as string | number;
  if (css(style.paddingRight) !== undefined) innerStyle.paddingRight = css(style.paddingRight) as string | number;
  if (css(style.paddingBottom) !== undefined) innerStyle.paddingBottom = css(style.paddingBottom) as string | number;
  if (css(style.paddingLeft) !== undefined) innerStyle.paddingLeft = css(style.paddingLeft) as string | number;
  if (style.borderRadius && BORDER_RADIUS_MAP[style.borderRadius as string]) {
    innerStyle.borderRadius = BORDER_RADIUS_MAP[style.borderRadius as string];
  }
  if (css(style.borderTopLeftRadius))     innerStyle.borderTopLeftRadius     = css(style.borderTopLeftRadius)     as string;
  if (css(style.borderTopRightRadius))    innerStyle.borderTopRightRadius    = css(style.borderTopRightRadius)    as string;
  if (css(style.borderBottomRightRadius)) innerStyle.borderBottomRightRadius = css(style.borderBottomRightRadius) as string;
  if (css(style.borderBottomLeftRadius))  innerStyle.borderBottomLeftRadius  = css(style.borderBottomLeftRadius)  as string;
  if (css(style.borderTopWidth))    innerStyle.borderTopWidth    = css(style.borderTopWidth)    as string;
  if (css(style.borderRightWidth))  innerStyle.borderRightWidth  = css(style.borderRightWidth)  as string;
  if (css(style.borderBottomWidth)) innerStyle.borderBottomWidth = css(style.borderBottomWidth) as string;
  if (css(style.borderLeftWidth))   innerStyle.borderLeftWidth   = css(style.borderLeftWidth)   as string;
  if (css(style.borderStyle))       innerStyle.borderStyle       = css(style.borderStyle)       as string;
  if (css(style.borderColor)) {
    const color = css(style.borderColor) as string;
    const alpha = typeof style.borderAlpha === "number" ? style.borderAlpha : 1;
    if (alpha < 1) {
      const hex = color.replace("#", "");
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      innerStyle.borderColor = `rgba(${r},${g},${b},${alpha})`;
    } else {
      innerStyle.borderColor = color;
    }
  }
  if (style.maxWidth) {
    const mw = style.maxWidth as string;
    if (MAX_WIDTH_MAP[mw]) {
      innerStyle.maxWidth = MAX_WIDTH_MAP[mw];
      innerStyle.marginLeft = "auto";
      innerStyle.marginRight = "auto";
    } else if (css(mw) !== undefined) {
      innerStyle.maxWidth = css(mw) as string;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (css(style.overflowX)) (innerStyle as any).overflowX = css(style.overflowX);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (css(style.overflowY)) (innerStyle as any).overflowY = css(style.overflowY);
  if (style.shadowX || style.shadowY || style.shadowBlur || style.shadowSpread) {
    const sc = typeof style.shadowColor === "string" ? style.shadowColor : "#000000";
    const sa = typeof style.shadowAlpha === "number" ? style.shadowAlpha : 1;
    const hex = sc.replace("#", "").padEnd(6, "0");
    const n = parseInt(hex.slice(0, 6), 16);
    const rgba = `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${sa})`;
    const inset = style.shadowType === "inset" ? "inset " : "";
    const sx = css(style.shadowX) ?? "0px";
    const sy = css(style.shadowY) ?? "0px";
    const sb = css(style.shadowBlur) ?? "0px";
    const ss = css(style.shadowSpread) ?? "0px";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (innerStyle as any).boxShadow = `${inset}${sx} ${sy} ${sb} ${ss} ${rgba}`;
  }
  Object.assign(innerStyle, getBgStyle(style));
  return { outerStyle, innerStyle };
}

// ─── Canvas Props ─────────────────────────────────────────────────────────────

interface CanvasProps {
  sections: SectionBlock[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onAddToContainer: (containerId: string, slotIndex: number | null, type: BlockType) => void;
  dropIndicatorId: string | null;
  onAddAfter: (afterId: string, type: BlockType) => void;
  previewWidth?: number | null;
  resizeBounds?: { min: number; max: number } | null;
  onWidthChange?: (w: number | null) => void;
  onBlockContextMenu?: (e: React.MouseEvent, id: string) => void;
  activeBreakpoint: BreakpointId;
}

// ─── Hover CSS injection ──────────────────────────────────────────────────────

function collectHoverCss(sections: SectionBlock[], activeBreakpoint: BreakpointId): string {
  let css = "";
  for (const block of sections) {
    const config = block.config as Record<string, unknown>;
    const configForHover = activeBreakpoint !== "desktop"
      ? {
          ...config,
          styleHover: {
            ...(config.styleHover as Record<string, unknown> ?? {}),
            ...((config.styleHoverBreakpoints as Record<string, Record<string, unknown>> | undefined)?.[activeBreakpoint] ?? {}),
          },
        }
      : config;
    css += buildHoverCss(configForHover, block.id);
    if (block.children) css += collectHoverCss(block.children, activeBreakpoint);
    if (block.slots) block.slots.forEach(slot => { css += collectHoverCss(slot, activeBreakpoint); });
  }
  return css;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function Canvas({
  sections,
  selectedId,
  onSelect,
  onRemove,
  onAddToContainer,
  dropIndicatorId,
  onAddAfter,
  previewWidth,
  resizeBounds,
  onWidthChange,
  onBlockContextMenu,
  activeBreakpoint,
}: CanvasProps) {
  const { setNodeRef: setCanvasRef } = useDroppable({ id: CANVAS_DROP_ID });

  // Local drag-resize width — resets whenever the active breakpoint changes (previewWidth changes)
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const [prevPreviewWidth, setPrevPreviewWidth] = useState(previewWidth);
  if (prevPreviewWidth !== previewWidth) {
    setPrevPreviewWidth(previewWidth);
    setLocalWidth(null);
  }

  const effectiveWidth = localWidth ?? previewWidth;

  useEffect(() => {
    onWidthChange?.(localWidth);
  }, [localWidth, onWidthChange]);

  useEffect(() => {
    let el = document.getElementById("epx-canvas-hover-css") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "epx-canvas-hover-css";
      document.head.appendChild(el);
    }
    el.textContent = collectHoverCss(sections, activeBreakpoint);
    return () => { el?.remove(); };
  }, [sections, activeBreakpoint]);

  const handleResizeDragStart = useCallback((side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!resizeBounds) return;
    const startX = e.clientX;
    const startWidth = effectiveWidth ?? resizeBounds.max;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const raw = side === "right" ? startWidth + delta : startWidth - delta;
      setLocalWidth(Math.round(Math.max(resizeBounds.min, Math.min(resizeBounds.max, raw))));
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [resizeBounds, effectiveWidth]);

  const showHandles = !!resizeBounds && !!effectiveWidth;
  const frameStyle = effectiveWidth
    ? showHandles
      ? { width: "100%", maxWidth: effectiveWidth, flexShrink: 0 as const }
      : { maxWidth: effectiveWidth, width: "100%", margin: "0 auto" }
    : undefined;

  const isEmpty = sections.length === 0;
  const canvasClass = [
    "epx-canvas",
    isEmpty ? "epx-canvas--empty" : null,
    effectiveWidth ? "epx-canvas--preview" : null,
    showHandles ? "epx-canvas--resizable" : null,
  ].filter(Boolean).join(" ");

  const frameContent = isEmpty ? (
    <div className="epx-canvas__empty-state">
      <h3>Start building your page</h3>
      <p>Click or drag a block from the left panel</p>
    </div>
  ) : (
    <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
      <div className="epx-canvas__list">
        {sections.map((section) => {
          if (isContainerType(section.type)) {
            return (
              <ContainerBlock
                key={section.id}
                section={section}
                selectedId={selectedId}
                onSelect={onSelect}
                onRemove={onRemove}
                onAddToContainer={onAddToContainer}
                dropIndicatorId={dropIndicatorId}
                onAddAfter={onAddAfter}
                containerId={null}
                onBlockContextMenu={onBlockContextMenu}
                activeBreakpoint={activeBreakpoint}
              />
            );
          }
          return (
            <SortableBlock
              key={section.id}
              section={section}
              containerId={null}
              slotIndex={null}
              isSelected={section.id === selectedId}
              onSelect={() => onSelect(section.id)}
              onRemove={() => onRemove(section.id)}
              isDropTarget={section.id === dropIndicatorId}
              onAddAfter={(type) => onAddAfter(section.id, type)}
              onBlockContextMenu={onBlockContextMenu}
              activeBreakpoint={activeBreakpoint}
            />
          );
        })}
      </div>
    </SortableContext>
  );

  return (
    <main ref={setCanvasRef} className={canvasClass} onClick={() => onSelect(null)}>
      {showHandles && (
        <div className="epx-canvas__side-handle epx-canvas__side-handle--left" onMouseDown={handleResizeDragStart("left")}>
          <div className="epx-canvas__side-grip" />
        </div>
      )}
      <div className="epx-canvas__preview-frame" style={frameStyle}>
        {frameContent}
      </div>
      {showHandles && (
        <div className="epx-canvas__side-handle epx-canvas__side-handle--right" onMouseDown={handleResizeDragStart("right")}>
          <div className="epx-canvas__side-grip" />
        </div>
      )}
    </main>
  );
}

// ─── SortableBlock ─────────────────────────────────────────────────────────────

interface SortableBlockProps {
  section: SectionBlock;
  containerId: string | null;
  slotIndex: number | null;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isDropTarget: boolean;
  onAddAfter: (type: BlockType) => void;
  onBlockContextMenu?: (e: React.MouseEvent, id: string) => void;
  activeBreakpoint: BreakpointId;
}

function SortableBlock({
  section,
  containerId,
  slotIndex,
  isSelected,
  onSelect,
  onRemove,
  isDropTarget,
  onAddAfter,
  onBlockContextMenu,
  activeBreakpoint,
}: SortableBlockProps) {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: {
      kind: "block",
      containerId,
      slotIndex,
      isContainer: false,
    } satisfies BlockDragData,
  });

  const { outerStyle, innerStyle } = resolveBlockStyle(section.config, getBpOverride(section.config, activeBreakpoint));

  const adv = (section.config.advanced ?? {}) as Record<string, unknown>;
  if (adv.position) outerStyle.position = adv.position as React.CSSProperties["position"];
  if (adv.top)    outerStyle.top    = css(adv.top)    as string;
  if (adv.right)  outerStyle.right  = css(adv.right)  as string;
  if (adv.bottom) outerStyle.bottom = css(adv.bottom) as string;
  if (adv.left)   outerStyle.left   = css(adv.left)   as string;
  if (adv.zIndex !== undefined && adv.zIndex !== "") outerStyle.zIndex = Number(adv.zIndex);

  const wrapperStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...outerStyle,
  };

  const Preview = PREVIEW_COMPONENTS[section.type];
  const isInner = containerId !== null;

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={`epx-block-preview${isSelected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onContextMenu={(e) => onBlockContextMenu?.(e, section.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isInner ? (
        <InnerBlockOverlay
          visible={hovered || isSelected}
          dragListeners={listeners}
          dragAttributes={attributes}
          onSelect={onSelect}
        />
      ) : (
        <BlockOverlay
          visible={hovered || isSelected}
          onAdd={onAddAfter}
          dragListeners={listeners}
          dragAttributes={attributes}
          onDelete={onRemove}
          onSelect={onSelect}
        />
      )}

      <div data-epx-block={section.id} style={innerStyle} className={`epx-theme--${(section.config.theme as string) || "light"}`}>
        {Preview ? (
          <Preview config={section.config} children={section.children} slots={section.slots} />
        ) : (
          <div style={{ padding: "12px 14px", color: "#888", fontSize: 12 }}>
            Unknown block: {section.type}
          </div>
        )}
      </div>

      {isDropTarget && <div className="epx-drop-indicator" />}
    </div>
  );
}

// ─── InnerBlockOverlay ────────────────────────────────────────────────────────

function InnerBlockOverlay({
  visible,
  dragListeners,
  dragAttributes,
  onSelect,
}: {
  visible: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners: Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes: Record<string, any> | undefined;
  onSelect: () => void;
}) {
  return (
    <div
      className={`epx-inner-block-overlay${visible ? " is-visible" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div
        className="epx-inner-block-overlay__handle"
        {...dragListeners}
        {...dragAttributes}
        title="Drag to reorder"
      >
        ⠿
      </div>
    </div>
  );
}

// ─── ContainerBlock ───────────────────────────────────────────────────────────

interface ContainerBlockProps {
  section: SectionBlock;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onAddToContainer: (containerId: string, slotIndex: number | null, type: BlockType) => void;
  dropIndicatorId: string | null;
  onAddAfter: (afterId: string, type: BlockType) => void;
  containerId: string | null;
  onBlockContextMenu?: (e: React.MouseEvent, id: string) => void;
  activeBreakpoint: BreakpointId;
}

const ContainerBlock = memo(function ContainerBlock({
  section,
  selectedId,
  onSelect,
  onRemove,
  onAddToContainer,
  dropIndicatorId,
  onAddAfter,
  containerId,
  onBlockContextMenu,
  activeBreakpoint,
}: ContainerBlockProps) {
  const [hovered, setHovered] = useState(false);
  const isSelected = section.id === selectedId;
  const children = section.children ?? [];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: {
      kind: "block",
      containerId,
      slotIndex: null,
      isContainer: true,
    } satisfies BlockDragData,
  });

  const { innerStyle: containerBgStyle } = resolveBlockStyle(section.config, getBpOverride(section.config, activeBreakpoint));

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...containerBgStyle,
  };

  return (
    <div
      ref={setNodeRef}
      data-epx-block={section.id}
      style={style}
      className={`epx-container-block epx-theme--${(section.config.theme as string) || "light"}${isSelected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
      onContextMenu={(e) => onBlockContextMenu?.(e, section.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {containerId !== null ? (
        <InnerBlockOverlay
          visible={hovered || isSelected}
          dragListeners={listeners}
          dragAttributes={attributes}
          onSelect={() => onSelect(section.id)}
        />
      ) : (
        <BlockOverlay
          visible={hovered || isSelected}
          onAdd={(type) => onAddAfter(section.id, type)}
          dragListeners={listeners}
          dragAttributes={attributes}
          onDelete={() => onRemove(section.id)}
          onSelect={() => onSelect(section.id)}
        />
      )}

      <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          className="epx-container-block__children"
          style={(() => {
            const layout = (section.config.layout as string) ?? "flex";
            const configStyle = (section.config.style as Record<string, unknown> | undefined) ?? {};
            const bpOverride = getBpOverride(section.config, activeBreakpoint) ?? {};
            const isGrid = layout === "grid";
            const resolveTrack = (raw: unknown): string | undefined => {
              if (typeof raw !== "string" || !raw) return undefined;
              if (raw.startsWith("@@")) return raw.slice(2) || undefined;
              return raw;
            };
            const bp = bpOverride as Record<string, unknown>;
            return {
              display:               isGrid ? "grid" : "flex",
              columnGap:             (bp.columnGap ?? configStyle.columnGap) as string | undefined,
              rowGap:                (bp.rowGap    ?? configStyle.rowGap)    as string | undefined,
              flexWrap:              !isGrid ? (((bp.flexWrap       ?? section.config.flexWrap)       as string) ?? "nowrap")     as React.CSSProperties["flexWrap"]       : undefined,
              flexDirection:         !isGrid ? (((bp.flexDirection  ?? section.config.flexDirection)  as string) ?? "row")        as React.CSSProperties["flexDirection"]  : undefined,
              justifyContent:        !isGrid ? (((bp.justifyContent ?? section.config.justifyContent) as string) ?? "flex-start") as React.CSSProperties["justifyContent"] : undefined,
              alignItems:            !isGrid ? (((bp.flexAlignItems ?? section.config.flexAlignItems) as string) ?? "stretch")    as React.CSSProperties["alignItems"]
                                             : ((section.config.alignItems    as string) ?? "stretch"),
              gridAutoFlow:          isGrid  ? ((section.config.gridFlow       as string) ?? "row")        : undefined,
              justifyItems:          isGrid  ? ((section.config.justifyItems   as string) ?? "stretch")    : undefined,
              gridTemplateColumns:   isGrid  ? resolveTrack(section.config.gridColumns)                    : undefined,
              gridTemplateRows:      isGrid  ? resolveTrack(section.config.gridRows)                       : undefined,
            };
          })()}
        >
          {children.length > 0 ? (
            children.map((child) =>
              isContainerType(child.type) ? (
                <ContainerBlock
                  key={child.id}
                  section={child}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onRemove={onRemove}
                  onAddToContainer={onAddToContainer}
                  dropIndicatorId={dropIndicatorId}
                  onAddAfter={onAddAfter}
                  containerId={section.id}
                  onBlockContextMenu={onBlockContextMenu}
                  activeBreakpoint={activeBreakpoint}
                />
              ) : (
                <SortableBlock
                  key={child.id}
                  section={child}
                  containerId={section.id}
                  slotIndex={null}
                  isSelected={child.id === selectedId}
                  onSelect={() => onSelect(child.id)}
                  onRemove={() => onRemove(child.id)}
                  isDropTarget={child.id === dropIndicatorId}
                  onAddAfter={(type) => onAddAfter(child.id, type)}
                  onBlockContextMenu={onBlockContextMenu}
                  activeBreakpoint={activeBreakpoint}
                />
              )
            )
          ) : (
            <EmptyDropZone
              containerId={section.id}
              slotIndex={null}
            />
          )}
        </div>
      </SortableContext>

      {section.id === dropIndicatorId && <div className="epx-drop-indicator" />}
    </div>
  );
});

// ─── EmptyDropZone ────────────────────────────────────────────────────────────

function EmptyDropZone({
  containerId,
  slotIndex,
}: {
  containerId: string;
  slotIndex: number | null;
}) {
  const id = `empty:${containerId}:${slotIndex ?? "c"}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { kind: "empty-zone", containerId, slotIndex } satisfies EmptyZoneData,
  });

  return (
    <div
      ref={setNodeRef}
      className={`epx-container__empty-zone${isOver ? " is-over" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span style={{ fontSize: 11, color: "var(--epx-text-muted)", opacity: 0.6 }}>Drop blocks here</span>
    </div>
  );
}
