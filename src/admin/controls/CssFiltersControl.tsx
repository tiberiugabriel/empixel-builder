import React, { useState } from "react";
import { NumberRow } from "./FieldRow.js";
import { IconReset } from "./SpacingControl.js";

export interface CssFiltersValue {
  blur?: number;        // px
  brightness?: number;  // 1 = neutral
  contrast?: number;    // 1 = neutral
  saturate?: number;    // 1 = neutral
  hueRotate?: number;   // deg
  grayscale?: number;   // 0..1
  sepia?: number;       // 0..1
  invert?: number;      // 0..1
}

const NEUTRAL_BRIGHTNESS = 1;
const NEUTRAL_CONTRAST   = 1;
const NEUTRAL_SATURATE   = 1;

export function parseFilter(filterStr: string | undefined): CssFiltersValue {
  if (!filterStr) return {};
  const out: CssFiltersValue = {};
  const re = /(blur|brightness|contrast|saturate|hue-rotate|grayscale|sepia|invert)\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filterStr))) {
    const fn = m[1];
    const arg = m[2].trim();
    const num = parseFloat(arg);
    if (isNaN(num)) continue;
    if      (fn === "blur")        out.blur = num;
    else if (fn === "brightness")  out.brightness = num;
    else if (fn === "contrast")    out.contrast = num;
    else if (fn === "saturate")    out.saturate = num;
    else if (fn === "hue-rotate")  out.hueRotate = num;
    else if (fn === "grayscale")   out.grayscale = num;
    else if (fn === "sepia")       out.sepia = num;
    else if (fn === "invert")      out.invert = num;
  }
  return out;
}

export function serializeFilter(v: CssFiltersValue): string {
  const parts: string[] = [];
  if (v.blur)                                                                parts.push(`blur(${v.blur}px)`);
  if (v.brightness !== undefined && v.brightness !== NEUTRAL_BRIGHTNESS)     parts.push(`brightness(${v.brightness})`);
  if (v.contrast   !== undefined && v.contrast   !== NEUTRAL_CONTRAST)       parts.push(`contrast(${v.contrast})`);
  if (v.saturate   !== undefined && v.saturate   !== NEUTRAL_SATURATE)       parts.push(`saturate(${v.saturate})`);
  if (v.hueRotate)                                                           parts.push(`hue-rotate(${v.hueRotate}deg)`);
  if (v.grayscale)                                                           parts.push(`grayscale(${v.grayscale})`);
  if (v.sepia)                                                               parts.push(`sepia(${v.sepia})`);
  if (v.invert)                                                              parts.push(`invert(${v.invert})`);
  return parts.join(" ");
}

interface Props {
  value: CssFiltersValue;
  onChange: (v: CssFiltersValue) => void;
  breakpointIndicator?: React.ReactNode;
}

export function CssFiltersControl({ value, onChange, breakpointIndicator }: Props) {
  const [expanded, setExpanded] = useState(false);

  const isDirty = !!(
    value.blur || value.hueRotate ||
    value.grayscale || value.sepia || value.invert ||
    (value.brightness !== undefined && value.brightness !== NEUTRAL_BRIGHTNESS) ||
    (value.contrast   !== undefined && value.contrast   !== NEUTRAL_CONTRAST) ||
    (value.saturate   !== undefined && value.saturate   !== NEUTRAL_SATURATE)
  );

  const handleReset = () => onChange({});

  const set = <K extends keyof CssFiltersValue>(k: K, v: CssFiltersValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>CSS Filters</span>
            {breakpointIndicator}
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
            <span className="epx-spacing-ctrl__label">CSS Filters</span>
            {breakpointIndicator}
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <NumberRow label="Blur (px)"   value={value.blur}      onChange={(n) => set("blur", n)}      min={0} step={1} />
          <NumberRow label="Brightness"  value={value.brightness} onChange={(n) => set("brightness", n)} min={0} max={3} step={0.05} />
          <NumberRow label="Contrast"    value={value.contrast}   onChange={(n) => set("contrast", n)}   min={0} max={3} step={0.05} />
          <NumberRow label="Saturate"    value={value.saturate}   onChange={(n) => set("saturate", n)}   min={0} max={3} step={0.05} />
          <NumberRow label="Hue (deg)"   value={value.hueRotate}  onChange={(n) => set("hueRotate", n)}  min={0} max={360} step={1} />
          <NumberRow label="Grayscale"   value={value.grayscale}  onChange={(n) => set("grayscale", n)}  min={0} max={1} step={0.05} />
          <NumberRow label="Sepia"       value={value.sepia}      onChange={(n) => set("sepia", n)}      min={0} max={1} step={0.05} />
          <NumberRow label="Invert"      value={value.invert}     onChange={(n) => set("invert", n)}     min={0} max={1} step={0.05} />
        </div>
      )}
    </div>
  );
}
