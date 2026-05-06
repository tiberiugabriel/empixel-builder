import React, { useRef, useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";

const STROKE_UNITS = ["px", "em", "rem"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextStrokeValue {
  width?: string;
  color?: string;
  alpha?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseTextStroke(style: Record<string, unknown>): TextStrokeValue {
  return {
    width: (style.textStrokeWidth as string) ?? "",
    color: (style.textStrokeColor as string) ?? "",
    alpha: typeof style.textStrokeAlpha === "number" ? style.textStrokeAlpha : 1,
  };
}

export function serializeTextStroke(val: TextStrokeValue): Record<string, unknown> {
  return {
    textStrokeWidth: val.width ?? "",
    textStrokeColor: val.color ?? "",
    textStrokeAlpha: val.alpha ?? 1,
  };
}

const ZERO: SideValue = { num: 0, unit: "px" };

// ─── Component ────────────────────────────────────────────────────────────────

export function TextStrokeControl({ value, onChange, breakpointIndicator }: {
  value: TextStrokeValue;
  onChange: (v: TextStrokeValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const widthSV = parseSide(value.width);
  const isDirty = !!value.width || !!value.color || (value.alpha ?? 1) < 1;

  const handleReset = () => onChange({ width: "", color: "", alpha: 1 });

  const setWidth = (sv: SideValue) => {
    const isEmpty = sv.num === 0 && sv.unit === "px";
    onChange({ ...value, width: isEmpty ? "" : serializeSide(sv) });
  };

  const openColor = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setColorOpen((o) => !o);
  };

  return (
    <div className={`epx-spacing-ctrl epx-typo-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Text Stroke{breakpointIndicator}</span>
            <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(true)}>▾</button>
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
            <span className="epx-spacing-ctrl__label">Text Stroke{breakpointIndicator}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <SideInput sideKey="" labelOverride="Stroke"
            value={widthSV ?? ZERO}
            onChange={setWidth}
            units={STROKE_UNITS}
          />

          <div className="epx-side-input">
            <span className="epx-side-input__label epx-side-input__label--row">Color</span>
            <div className="epx-border-color-cell" style={{ flex: 1 }}>
              <button ref={swatchRef} type="button"
                className="epx-border-color-swatch"
                style={{ background: value.color || "#000000", opacity: value.alpha ?? 1 }}
                onClick={openColor}
              />
              <span className="epx-border-color-hex">{getColorDisplay(value.color || "#000000", colorFormat)}</span>
              {colorOpen && (
                <ColorPicker
                  value={value.color || "#000000"}
                  alpha={value.alpha ?? 1}
                  onChange={(hex, a) => onChange({ ...value, color: hex, alpha: a })}
                  onClose={() => setColorOpen(false)}
                  position={colorPos}
                  format={colorFormat}
                  onFormatChange={setColorFormat}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
