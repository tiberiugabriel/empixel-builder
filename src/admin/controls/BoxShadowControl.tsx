import React, { useEffect, useRef, useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BoxShadowConfig {
  x:      SideValue;
  y:      SideValue;
  blur:   SideValue;
  spread: SideValue;
  type:   "outset" | "inset";
  color:  string;
  alpha:  number;
}

const SHADOW_TYPES = ["outset", "inset"] as const;

const DEFAULT: BoxShadowConfig = {
  x:      { num: 0, unit: "px" },
  y:      { num: 0, unit: "px" },
  blur:   { num: 0, unit: "px" },
  spread: { num: 0, unit: "px" },
  type:   "outset",
  color:  "#000000",
  alpha:  1,
};

// ─── Parse / Serialize ────────────────────────────────────────────────────────

export function parseShadow(style: Record<string, unknown>): BoxShadowConfig {
  return {
    x:      parseSide(style.shadowX),
    y:      parseSide(style.shadowY),
    blur:   parseSide(style.shadowBlur),
    spread: parseSide(style.shadowSpread),
    type:   style.shadowType === "inset" ? "inset" : "outset",
    color:  typeof style.shadowColor === "string" ? style.shadowColor : "#000000",
    alpha:  typeof style.shadowAlpha === "number"  ? style.shadowAlpha  : 1,
  };
}

export function serializeShadow(cfg: BoxShadowConfig): Record<string, unknown> {
  return {
    shadowX:      serializeSide(cfg.x),
    shadowY:      serializeSide(cfg.y),
    shadowBlur:   serializeSide(cfg.blur),
    shadowSpread: serializeSide(cfg.spread),
    shadowType:   cfg.type,
    shadowColor:  cfg.color,
    shadowAlpha:  cfg.alpha,
  };
}

function isShadowDirty(cfg: BoxShadowConfig): boolean {
  return (
    cfg.x.num !== 0 ||
    cfg.y.num !== 0 ||
    cfg.blur.num !== 0 ||
    cfg.spread.num !== 0 ||
    cfg.type !== "outset" ||
    cfg.color.toLowerCase() !== "#000000" ||
    cfg.alpha !== 1
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconX() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 6h10M8 3.5L10.5 6 8 8.5M4 3.5L1.5 6 4 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconY() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 1v10M3.5 4L6 1.5 8.5 4M3.5 8L6 10.5 8.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconBlur() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="2" fill="currentColor" opacity="0.9"/>
      <circle cx="6" cy="6" r="3.8" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      <circle cx="6" cy="6" r="5.2" stroke="currentColor" strokeWidth="0.7" opacity="0.15"/>
    </svg>
  );
}

function IconSpread() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.5" y="3.5" width="5" height="5" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M1 1h2.5M1 1v2.5M11 1h-2.5M11 1v2.5M1 11h2.5M1 11v-2.5M11 11h-2.5M11 11v-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Type dropdown ────────────────────────────────────────────────────────────

function TypeDropdown({ value, onChange, onClose, anchorRef }: {
  value: string;
  onChange: (s: "outset" | "inset") => void;
  onClose: () => void;
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
      {SHADOW_TYPES.map(s => (
        <button key={s} type="button"
          className={`epx-unit-dropdown__item${s === value ? " is-active" : ""}`}
          onMouseDown={e => { e.preventDefault(); onChange(s); onClose(); }}
        >{s}</button>
      ))}
    </div>
  );
}

// ─── Type + Color row (mirrors BorderStyleRow) ────────────────────────────────

function ShadowTypeColorRow({ type, color, alpha, onTypeChange, onColorChange }: {
  type: "outset" | "inset";
  color: string;
  alpha: number;
  onTypeChange: (s: "outset" | "inset") => void;
  onColorChange: (hex: string, a: number) => void;
}) {
  const [typeOpen, setTypeOpen]       = useState(false);
  const [colorOpen, setColorOpen]     = useState(false);
  const [colorPos, setColorPos]       = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const typeBtnRef = useRef<HTMLButtonElement>(null);
  const swatchRef  = useRef<HTMLButtonElement>(null);

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
        <span className="epx-side-input__label epx-side-input__label--row">Type</span>
        <div className="epx-side-input__unit-wrap" style={{ flex: 1, position: "relative" }}>
          <button ref={typeBtnRef} type="button"
            className="epx-field-row__select-btn epx-border-style-btn"
            onClick={() => setTypeOpen(o => !o)}
          >
            <span>{type}</span>
            <span className="epx-field-row__select-caret">▾</span>
          </button>
          {typeOpen && (
            <TypeDropdown value={type} onChange={onTypeChange} onClose={() => setTypeOpen(false)} anchorRef={typeBtnRef} />
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

// ─── BoxShadowControl ─────────────────────────────────────────────────────────

export function BoxShadowControl({ value, onChange, breakpointIndicator }: {
  value: BoxShadowConfig;
  onChange: (v: BoxShadowConfig) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const dirty = isShadowDirty(value);

  const handleReset = () => onChange({ ...DEFAULT });

  return (
    <div className={`epx-spacing-ctrl${dirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Box Shadow{breakpointIndicator}</span>
            <button type="button" className="epx-spacing-ctrl__caret"
              onClick={() => setExpanded(true)} title="Expand">▾</button>
          </div>
          {dirty && (
            <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
              <IconReset />
            </button>
          )}
        </div>
      ) : (
        <div className="epx-spacing-ctrl__expanded">
          <div className="epx-spacing-ctrl__exp-header">
            <span className="epx-spacing-ctrl__label">Box Shadow{breakpointIndicator}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {dirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <div className="epx-spacing-ctrl__grid epx-spacing-ctrl__grid--col2">
            <SideInput sideKey="X" icon={<IconX />} value={value.x} allowNegative
              onChange={sv => onChange({ ...value, x: sv })} />
            <SideInput sideKey="Y" icon={<IconY />} value={value.y} allowNegative
              onChange={sv => onChange({ ...value, y: sv })} />
            <SideInput sideKey="B" icon={<IconBlur />} value={value.blur}
              onChange={sv => onChange({ ...value, blur: sv })} />
            <SideInput sideKey="S" icon={<IconSpread />} value={value.spread} allowNegative
              onChange={sv => onChange({ ...value, spread: sv })} />
          </div>

          <ShadowTypeColorRow
            type={value.type}
            color={value.color}
            alpha={value.alpha}
            onTypeChange={t => onChange({ ...value, type: t })}
            onColorChange={(hex, a) => onChange({ ...value, color: hex, alpha: a })}
          />
        </div>
      )}
    </div>
  );
}
