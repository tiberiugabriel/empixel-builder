import React, { useEffect, useRef, useState } from "react";
import { IconReset } from "./SpacingControl.js";
import { SelectRow, IconButtonRow } from "./FieldRow.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayoutConfig = {
  layout?: string;
  flexWrap?: string;
  flexDirection?: string;
  justifyContent?: string;
  flexAlignItems?: string;
  gridFlow?: string;
  justifyItems?: string;
  alignItems?: string;
  gridColumns?: string;
  gridRows?: string;
};

const DEFAULTS: Required<LayoutConfig> = {
  layout:         "flex",
  flexWrap:       "nowrap",
  flexDirection:  "row",
  justifyContent: "flex-start",
  flexAlignItems: "stretch",
  gridFlow:       "row",
  justifyItems:   "stretch",
  alignItems:     "stretch",
  gridColumns:    "",
  gridRows:       "",
};

export function parseLayout(config: Record<string, unknown>): LayoutConfig {
  return {
    layout:         (config.layout         as string) || DEFAULTS.layout,
    flexWrap:       (config.flexWrap       as string) || DEFAULTS.flexWrap,
    flexDirection:  (config.flexDirection  as string) || DEFAULTS.flexDirection,
    justifyContent: (config.justifyContent as string) || DEFAULTS.justifyContent,
    flexAlignItems: (config.flexAlignItems as string) || DEFAULTS.flexAlignItems,
    gridFlow:       (config.gridFlow       as string) || DEFAULTS.gridFlow,
    justifyItems:   (config.justifyItems   as string) || DEFAULTS.justifyItems,
    alignItems:     (config.alignItems     as string) || DEFAULTS.alignItems,
    gridColumns:    (config.gridColumns    as string) ?? DEFAULTS.gridColumns,
    gridRows:       (config.gridRows       as string) ?? DEFAULTS.gridRows,
  };
}

export function layoutIsDirty(cfg: LayoutConfig): boolean {
  return (
    (cfg.layout         ?? DEFAULTS.layout)         !== DEFAULTS.layout         ||
    (cfg.flexWrap       ?? DEFAULTS.flexWrap)       !== DEFAULTS.flexWrap       ||
    (cfg.flexDirection  ?? DEFAULTS.flexDirection)  !== DEFAULTS.flexDirection  ||
    (cfg.justifyContent ?? DEFAULTS.justifyContent) !== DEFAULTS.justifyContent ||
    (cfg.flexAlignItems ?? DEFAULTS.flexAlignItems) !== DEFAULTS.flexAlignItems ||
    (cfg.gridFlow       ?? DEFAULTS.gridFlow)       !== DEFAULTS.gridFlow       ||
    (cfg.justifyItems   ?? DEFAULTS.justifyItems)   !== DEFAULTS.justifyItems   ||
    (cfg.alignItems     ?? DEFAULTS.alignItems)     !== DEFAULTS.alignItems     ||
    (cfg.gridColumns    ?? DEFAULTS.gridColumns)    !== DEFAULTS.gridColumns    ||
    (cfg.gridRows       ?? DEFAULTS.gridRows)       !== DEFAULTS.gridRows
  );
}

// ─── GridTrackValue ───────────────────────────────────────────────────────────

type GridTrackValue = { num: number; unit: "fr" | "custom"; raw?: string };

function parseGridTrack(raw: string): GridTrackValue {
  if (!raw) return { num: 1, unit: "fr" };
  if (raw.startsWith("@@")) return { num: 1, unit: "custom", raw: raw.slice(2) };
  const repeatMatch = raw.match(/^repeat\(\s*(\d+)\s*,\s*1fr\s*\)$/);
  if (repeatMatch) return { num: parseInt(repeatMatch[1], 10), unit: "fr" };
  return { num: 1, unit: "custom", raw };
}

function serializeGridTrack(v: GridTrackValue): string {
  if (v.unit === "custom") return `@@${v.raw ?? ""}`;
  return `repeat(${Math.max(1, Math.round(v.num))}, 1fr)`;
}

// ─── GridTrackInput ───────────────────────────────────────────────────────────

function IconPen() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function GridTrackDropdown({ unit, onSelect, onClose, anchorRef }: {
  unit: string;
  onSelect: (u: "fr" | "custom") => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) &&
          !anchorRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  return (
    <div ref={panelRef} className="epx-unit-dropdown">
      <button type="button"
        className={`epx-unit-dropdown__item${unit === "fr" ? " is-active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); onSelect("fr"); onClose(); }}
      >fr</button>
      <div className="epx-unit-dropdown__sep" />
      <button type="button"
        className={`epx-unit-dropdown__item epx-unit-dropdown__item--pen${unit === "custom" ? " is-active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); onSelect("custom"); onClose(); }}
      ><IconPen /></button>
    </div>
  );
}

function GridTrackInput({ label, value, onChange }: {
  label: string;
  value: GridTrackValue;
  onChange: (v: GridTrackValue) => void;
}) {
  const [unitOpen, setUnitOpen] = useState(false);
  const unitBtnRef = useRef<HTMLButtonElement>(null);

  const handleScrubDown = (e: React.MouseEvent) => {
    if (value.unit === "custom") return;
    e.preventDefault();
    const startX = e.clientX;
    const startNum = value.num;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(1, Math.round(startNum + (ev.clientX - startX) / 4));
      onChange({ ...value, num: next });
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="epx-side-input">
      <span
        className="epx-side-input__label epx-side-input__label--full"
        onMouseDown={handleScrubDown}
        style={{ cursor: value.unit === "custom" ? "default" : "ew-resize" }}
        title={value.unit === "custom" ? undefined : "Drag to adjust"}
      >{label}</span>
      {value.unit === "custom" ? (
        <input
          type="text"
          className="epx-side-input__num epx-side-input__num--custom"
          value={value.raw ?? ""}
          placeholder="custom"
          onChange={(e) => onChange({ ...value, raw: e.target.value })}
        />
      ) : (
        <input
          type="number"
          className="epx-side-input__num"
          value={value.num}
          placeholder="1"
          min={1}
          step={1}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange({ ...value, num: isNaN(n) ? 1 : Math.max(1, n) });
          }}
        />
      )}
      <div className="epx-side-input__unit-wrap">
        <button ref={unitBtnRef} type="button"
          className={`epx-side-input__unit-btn${value.unit === "custom" ? " epx-side-input__unit-btn--icon" : ""}`}
          onClick={() => setUnitOpen(o => !o)}
        >{value.unit === "custom" ? <IconPen /> : "fr"}</button>
        {unitOpen && (
          <GridTrackDropdown
            unit={value.unit}
            onSelect={(u) => onChange(u === "custom" ? { num: 1, unit: "custom", raw: "" } : { num: value.num || 1, unit: "fr" })}
            onClose={() => setUnitOpen(false)}
            anchorRef={unitBtnRef as React.RefObject<HTMLButtonElement>}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab icons ────────────────────────────────────────────────────────────────

function IconFlex() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="4.5" width="3.5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="5.5" y="4.5" width="3" height="5" rx="0.75" fill="currentColor"/>
      <rect x="9.5" y="4.5" width="3.5" height="5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"   y="1"   width="5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="8"   y="1"   width="5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="1"   y="8"   width="5" height="5" rx="0.75" fill="currentColor"/>
      <rect x="8"   y="8"   width="5" height="5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}

// ─── Flex option sets ─────────────────────────────────────────────────────────

const DIRECTION_OPTIONS = [
  {
    value: "row", title: "Row (→)",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h9M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    value: "column", title: "Column (↓)",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v9M4 8l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    value: "row-reverse", title: "Row Reverse (←)",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7H3M6 4L3 7l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    value: "column-reverse", title: "Column Reverse (↑)",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 12V3M4 6l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
];

const JUSTIFY_CONTENT_OPTIONS = [
  {
    value: "flex-start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="1.5" y1="2" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="3" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="6.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="10" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor" opacity="0.35"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor" opacity="0.35"/><rect x="4.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="8" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="11.5" y="3.5" width="1" height="7" rx="0.5" fill="currentColor" opacity="0.35"/></svg>,
  },
  {
    value: "flex-end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="12.5" y1="2" x2="12.5" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="1" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor" opacity="0.35"/><rect x="4.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="8" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/></svg>,
  },
  {
    value: "space-between", title: "Space Between",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="5.75" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="10.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/></svg>,
  },
  {
    value: "space-around", title: "Space Around",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="5.75" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="10" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><line x1="1.5" y1="7" x2="0.5" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.4"/><line x1="13.5" y1="7" x2="12.5" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.4"/></svg>,
  },
  {
    value: "space-evenly", title: "Space Evenly",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="5.75" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/><rect x="9" y="3.5" width="2.5" height="7" rx="0.6" fill="currentColor"/></svg>,
  },
];

const FLEX_ALIGN_OPTIONS = [
  {
    value: "flex-start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="1.5" x2="12" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="3" y="3" width="3" height="7" rx="0.6" fill="currentColor"/><rect x="8" y="3" width="3" height="5" rx="0.6" fill="currentColor"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="2" width="3" height="10" rx="0.6" fill="currentColor" opacity="0.3"/><rect x="3" y="3.5" width="3" height="7" rx="0.6" fill="currentColor"/><rect x="8" y="4.5" width="3" height="5" rx="0.6" fill="currentColor"/></svg>,
  },
  {
    value: "flex-end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="12.5" x2="12" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="3" y="4" width="3" height="7" rx="0.6" fill="currentColor"/><rect x="8" y="6" width="3" height="5" rx="0.6" fill="currentColor"/></svg>,
  },
  {
    value: "stretch", title: "Stretch",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="2" y1="1.5" x2="12" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2" y1="12.5" x2="12" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><rect x="3" y="3" width="3" height="8" rx="0.6" fill="currentColor"/><rect x="8" y="3" width="3" height="8" rx="0.6" fill="currentColor"/></svg>,
  },
];

// ─── Grid option sets ─────────────────────────────────────────────────────────

const JUSTIFY_OPTIONS = [
  {
    value: "start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="2" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4.5" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="7" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "stretch", title: "Stretch",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="2" y="4" width="10" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
];

const ALIGN_OPTIONS = [
  {
    value: "start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4" y="2" width="6" height="5" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4" y="4.5" width="6" height="5" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4" y="7" width="6" height="5" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "stretch", title: "Stretch",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4" y="2" width="6" height="10" rx="0.75" fill="currentColor"/></svg>,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function LayoutControl({ value, onChange, breakpointIndicator }: {
  value: LayoutConfig;
  onChange: (patch: Partial<LayoutConfig>) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const layout         = value.layout         ?? DEFAULTS.layout;
  const flexWrap       = value.flexWrap       ?? DEFAULTS.flexWrap;
  const flexDirection  = value.flexDirection  ?? DEFAULTS.flexDirection;
  const justifyContent = value.justifyContent ?? DEFAULTS.justifyContent;
  const flexAlignItems = value.flexAlignItems ?? DEFAULTS.flexAlignItems;
  const gridFlow       = value.gridFlow       ?? DEFAULTS.gridFlow;
  const justifyItems   = value.justifyItems   ?? DEFAULTS.justifyItems;
  const alignItems     = value.alignItems     ?? DEFAULTS.alignItems;
  const gridColumns    = value.gridColumns    ?? DEFAULTS.gridColumns;
  const gridRows       = value.gridRows       ?? DEFAULTS.gridRows;

  const dirty = layoutIsDirty(value);

  const handleReset = () => onChange({ ...DEFAULTS });

  const setLayout = (next: string) => {
    if (next === layout) return;
    onChange({ layout: next });
  };

  return (
    <div className={`epx-spacing-ctrl${dirty ? " is-dirty" : ""}`}>
      <div className="epx-bg-ctrl__card">

        {/* Header */}
        <div className="epx-spacing-ctrl__exp-header">
          <span className="epx-spacing-ctrl__label">Layout{breakpointIndicator}</span>
          {dirty && (
            <div className="epx-spacing-ctrl__exp-actions">
              <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                <IconReset />
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="epx-bg-ctrl__type-tabs">
          {[
            { type: "flex", icon: <IconFlex />, title: "Flex" },
            { type: "grid", icon: <IconGrid />, title: "Grid" },
          ].map((tab) => (
            <button
              key={tab.type}
              type="button"
              className={`epx-bg-ctrl__type-tab${layout === tab.type ? " is-active" : ""}`}
              onClick={() => setLayout(tab.type)}
              data-tooltip={tab.title}
            >
              {tab.icon}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="epx-bg-ctrl__body epx-layout-ctrl__body">
          {layout === "flex" && (
            <>
              <SelectRow
                label="Wrap"
                value={flexWrap}
                onChange={(v) => onChange({ flexWrap: v })}
                options={[
                  { value: "nowrap", label: "No Wrap" },
                  { value: "wrap",   label: "Wrap" },
                ]}
              />
              <IconButtonRow
                label="Direction"
                value={flexDirection}
                onChange={(v) => onChange({ flexDirection: v })}
                options={DIRECTION_OPTIONS}
              />
              <IconButtonRow
                label="Justify Content"
                value={justifyContent}
                onChange={(v) => onChange({ justifyContent: v })}
                options={JUSTIFY_CONTENT_OPTIONS}
              />
              <IconButtonRow
                label="Align Items"
                value={flexAlignItems}
                onChange={(v) => onChange({ flexAlignItems: v })}
                options={FLEX_ALIGN_OPTIONS}
              />
            </>
          )}
          {layout === "grid" && (
            <>
              <SelectRow
                label="Flow"
                value={gridFlow}
                onChange={(v) => onChange({ gridFlow: v })}
                options={[
                  { value: "row",    label: "Row" },
                  { value: "column", label: "Column" },
                ]}
              />
              <IconButtonRow
                label="Justify Items"
                value={justifyItems}
                onChange={(v) => onChange({ justifyItems: v })}
                options={JUSTIFY_OPTIONS}
              />
              <IconButtonRow
                label="Align Items"
                value={alignItems}
                onChange={(v) => onChange({ alignItems: v })}
                options={ALIGN_OPTIONS}
              />
              <GridTrackInput
                label="Columns"
                value={parseGridTrack(gridColumns)}
                onChange={(v) => onChange({ gridColumns: serializeGridTrack(v) })}
              />
              <GridTrackInput
                label="Rows"
                value={parseGridTrack(gridRows)}
                onChange={(v) => onChange({ gridRows: serializeGridTrack(v) })}
              />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
