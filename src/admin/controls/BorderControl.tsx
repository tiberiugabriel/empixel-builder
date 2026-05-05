import React, { useEffect, useRef, useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

type BorderSide = "top" | "right" | "bottom" | "left";
type BorderWidths = Partial<Record<BorderSide, SideValue>>;

const SIDES: BorderSide[] = ["top", "right", "bottom", "left"];
const SIDE_LABELS: Record<BorderSide, string> = { top: "T", right: "R", bottom: "B", left: "L" };
const WIDTH_CSS: Record<BorderSide, string> = {
  top:    "borderTopWidth",
  right:  "borderRightWidth",
  bottom: "borderBottomWidth",
  left:   "borderLeftWidth",
};

const BORDER_STYLES = ["none", "solid", "dashed", "dotted", "double"];

function sidesEqual(widths: BorderWidths): boolean {
  const vals = SIDES.map(s => widths[s] ?? { num: 0, unit: "px" });
  return vals.every(v => v.num === vals[0].num && v.unit === vals[0].unit);
}

export interface BorderConfig {
  widths: BorderWidths;
  style:  string;
  color:  string;
  alpha:  number;
}

export function parseBorder(style: Record<string, unknown>): BorderConfig {
  return {
    widths: {
      top:    parseSide(style.borderTopWidth),
      right:  parseSide(style.borderRightWidth),
      bottom: parseSide(style.borderBottomWidth),
      left:   parseSide(style.borderLeftWidth),
    },
    style: typeof style.borderStyle === "string" ? style.borderStyle : "none",
    color: typeof style.borderColor === "string" ? style.borderColor : "#000000",
    alpha: typeof style.borderAlpha === "number"  ? style.borderAlpha  : 1,
  };
}

export function serializeBorder(cfg: BorderConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {
    borderStyle: cfg.style,
    borderColor: cfg.color,
    borderAlpha: cfg.alpha,
  };
  SIDES.forEach(side => {
    const sv = cfg.widths[side];
    if (sv) out[WIDTH_CSS[side]] = serializeSide(sv);
  });
  return out;
}

// ─── Style mini-dropdown ──────────────────────────────────────────────────────

function StyleDropdown({ value, onChange, onClose, anchorRef }: {
  value: string; onChange: (s: string) => void; onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
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
      {BORDER_STYLES.map(s => (
        <button key={s} type="button"
          className={`epx-unit-dropdown__item${s === value ? " is-active" : ""}`}
          onMouseDown={e => { e.preventDefault(); onChange(s); onClose(); }}
        >{s}</button>
      ))}
    </div>
  );
}

// ─── Style + Color row ────────────────────────────────────────────────────────

function BorderStyleRow({ borderStyle, color, alpha, onStyleChange, onColorChange }: {
  borderStyle: string;
  color: string;
  alpha: number;
  onStyleChange: (s: string) => void;
  onColorChange: (hex: string, a: number) => void;
}) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const styleBtnRef = useRef<HTMLButtonElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  const openColor = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setColorOpen(o => !o);
  };

  return (
    <div className="epx-border-style-row">
      <div className="epx-border-style-cell">
        <span className="epx-side-input__label epx-side-input__label--row">Style</span>
        <div className="epx-side-input__unit-wrap" style={{ flex: 1, position: "relative" }}>
          <button ref={styleBtnRef} type="button"
            className="epx-field-row__select-btn epx-border-style-btn"
            onClick={() => setStyleOpen(o => !o)}
          >
            <span>{borderStyle}</span>
            <span className="epx-field-row__select-caret">▾</span>
          </button>
          {styleOpen && (
            <StyleDropdown value={borderStyle} onChange={onStyleChange} onClose={() => setStyleOpen(false)} anchorRef={styleBtnRef} />
          )}
        </div>
      </div>
      <div className="epx-border-color-cell">
        <button ref={swatchRef} type="button"
          className="epx-border-color-swatch"
          style={{ background: color, opacity: alpha }}
          onClick={openColor}
        />
        <span className="epx-border-color-hex">{getColorDisplay(color, colorFormat)}</span>
        {colorOpen && (
          <ColorPicker
            value={color}
            alpha={alpha}
            onChange={onColorChange}
            onClose={() => setColorOpen(false)}
            position={colorPos}
            format={colorFormat}
            onFormatChange={setColorFormat}
          />
        )}
      </div>
    </div>
  );
}

// ─── BorderControl ────────────────────────────────────────────────────────────

export function BorderControl({ value, onChange, breakpointIndicator }: {
  value: BorderConfig;
  onChange: (v: BorderConfig) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const mixed = !sidesEqual(value.widths);
  const isDirty = SIDES.some(s => {
    const sv = value.widths[s];
    return (sv?.num ?? 0) !== 0 || (sv?.unit !== undefined && sv.unit !== "px");
  })
    || value.style !== "none"
    || value.color.toLowerCase() !== "#000000"
    || value.alpha !== 1;
  const collapsed = value.widths.top ?? { num: 0, unit: "px" };

  const handleCollapsedChange = (sv: SideValue) => {
    const next: BorderWidths = {};
    SIDES.forEach(s => { next[s] = sv; });
    onChange({ ...value, widths: next });
  };

  const handleReset = () => {
    const next: BorderWidths = {};
    SIDES.forEach(s => { next[s] = { num: 0, unit: "px" }; });
    onChange({ widths: next, style: "none", color: "#000000", alpha: 1 });
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            {mixed ? (
              <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Border{breakpointIndicator}</span>
            ) : (
              <SideInput sideKey="" labelOverride="Border" value={collapsed} onChange={handleCollapsedChange} labelSuffix={breakpointIndicator} />
            )}
            {mixed && <span className="epx-border-mixed">Mixed</span>}
            <button type="button" className="epx-spacing-ctrl__caret"
              onClick={() => setExpanded(true)} title="Expand">▾</button>
          </div>
          {isDirty && (
            <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
              <IconReset />
            </button>
          )}
        </div>
      ) : (
        <div className="epx-spacing-ctrl__expanded">
          <div className="epx-spacing-ctrl__exp-header">
            <span className="epx-spacing-ctrl__label">Border{breakpointIndicator}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>
          <div className="epx-spacing-ctrl__grid epx-spacing-ctrl__grid--col2">
            {SIDES.map(side => (
              <SideInput key={side} sideKey={SIDE_LABELS[side]}
                value={value.widths[side] ?? { num: 0, unit: "px" }}
                onChange={sv => onChange({ ...value, widths: { ...value.widths, [side]: sv } })}
              />
            ))}
          </div>
          <BorderStyleRow
            borderStyle={value.style}
            color={value.color}
            alpha={value.alpha}
            onStyleChange={s => onChange({ ...value, style: s })}
            onColorChange={(hex, a) => onChange({ ...value, color: hex, alpha: a })}
          />
        </div>
      )}
    </div>
  );
}
