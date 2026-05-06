import React, { useRef, useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TextShadowValue {
  x?: string;
  y?: string;
  blur?: string;
  color?: string;
  alpha?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseTextShadow(style: Record<string, unknown>): TextShadowValue {
  return {
    x:     (style.textShadowX     as string) ?? "",
    y:     (style.textShadowY     as string) ?? "",
    blur:  (style.textShadowBlur  as string) ?? "",
    color: (style.textShadowColor as string) ?? "",
    alpha: typeof style.textShadowAlpha === "number" ? style.textShadowAlpha : 1,
  };
}

export function serializeTextShadow(val: TextShadowValue): Record<string, unknown> {
  return {
    textShadowX:     val.x     ?? "",
    textShadowY:     val.y     ?? "",
    textShadowBlur:  val.blur  ?? "",
    textShadowColor: val.color ?? "",
    textShadowAlpha: val.alpha ?? 1,
  };
}

const ZERO: SideValue = { num: 0, unit: "px" };

// ─── Component ────────────────────────────────────────────────────────────────

export function TextShadowControl({ value, onChange, breakpointIndicator }: {
  value: TextShadowValue;
  onChange: (v: TextShadowValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const xSV    = parseSide(value.x);
  const ySV    = parseSide(value.y);
  const blurSV = parseSide(value.blur);

  const isDirty = !!value.x || !!value.y || !!value.blur || !!value.color || (value.alpha ?? 1) < 1;

  const handleReset = () => onChange({ x: "", y: "", blur: "", color: "", alpha: 1 });

  const setSide = (key: "x" | "y" | "blur", sv: SideValue) => {
    const isEmpty = sv.num === 0 && sv.unit === "px";
    onChange({ ...value, [key]: isEmpty ? "" : serializeSide(sv) });
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
            <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Text Shadow{breakpointIndicator}</span>
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
            <span className="epx-spacing-ctrl__label">Text Shadow{breakpointIndicator}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <SideInput sideKey="" labelOverride="Blur"
            value={blurSV ?? ZERO}
            onChange={(sv) => setSide("blur", sv)}
          />
          <SideInput sideKey="" labelOverride="X"
            value={xSV ?? ZERO}
            onChange={(sv) => setSide("x", sv)}
            allowNegative
          />
          <SideInput sideKey="" labelOverride="Y"
            value={ySV ?? ZERO}
            onChange={(sv) => setSide("y", sv)}
            allowNegative
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
