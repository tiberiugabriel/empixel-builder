import React, { useRef, useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";
import { SelectRow } from "./FieldRow.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";

// ─── Font stacks ──────────────────────────────────────────────────────────────

const FONT_SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const FONT_SERIF  = 'Georgia, "Times New Roman", Times, serif';
const FONT_MONO   = 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const FAMILY_OPTIONS = [
  { value: "",          label: "Default" },
  { value: FONT_SYSTEM, label: "System" },
  { value: FONT_SERIF,  label: "Serif" },
  { value: FONT_MONO,   label: "Mono" },
];

const WEIGHT_OPTIONS = [
  { value: "",    label: "Default" },
  { value: "100", label: "100 — Thin" },
  { value: "200", label: "200 — Extra Light" },
  { value: "300", label: "300 — Light" },
  { value: "400", label: "400 — Normal" },
  { value: "500", label: "500 — Medium" },
  { value: "600", label: "600 — Semi Bold" },
  { value: "700", label: "700 — Bold" },
  { value: "800", label: "800 — Extra Bold" },
  { value: "900", label: "900 — Black" },
];

const TRANSFORM_OPTIONS = [
  { value: "",           label: "Default" },
  { value: "none",       label: "Normal" },
  { value: "uppercase",  label: "Uppercase" },
  { value: "lowercase",  label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
];

const STYLE_OPTIONS = [
  { value: "",        label: "Default" },
  { value: "normal",  label: "Normal" },
  { value: "italic",  label: "Italic" },
  { value: "oblique", label: "Oblique" },
];

const DECORATION_OPTIONS = [
  { value: "",             label: "Default" },
  { value: "none",         label: "None" },
  { value: "underline",    label: "Underline" },
  { value: "overline",     label: "Overline" },
  { value: "line-through", label: "Line Through" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypographyValue {
  fontFamily?: string;
  color?: string;
  colorAlpha?: number;
  fontSize?: string;
  fontWeight?: string;
  textTransform?: string;
  fontStyle?: string;
  textDecoration?: string;
  lineHeight?: string;
  letterSpacing?: string;
  wordSpacing?: string;
}

const TYPO_STR_KEYS = [
  "fontFamily", "color", "fontSize", "fontWeight", "textTransform",
  "fontStyle", "textDecoration", "lineHeight", "letterSpacing", "wordSpacing",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseTypography(style: Record<string, unknown>): TypographyValue {
  const out: TypographyValue = {};
  for (const k of TYPO_STR_KEYS) {
    out[k] = (style[k] as string) ?? "";
  }
  out.colorAlpha = typeof style.colorAlpha === "number" ? style.colorAlpha : 1;
  return out;
}

export function serializeTypography(val: TypographyValue): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TYPO_STR_KEYS) {
    out[k] = val[k] ?? "";
  }
  out.colorAlpha = val.colorAlpha ?? 1;
  return out;
}

function emptyTypography(): TypographyValue {
  const out: TypographyValue = {};
  for (const k of TYPO_STR_KEYS) out[k] = "";
  out.colorAlpha = 1;
  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ZERO: SideValue = { num: 0, unit: "px" };

export function TypographyControl({ value, onChange, breakpointIndicator }: {
  value: TypographyValue;
  onChange: (v: TypographyValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const isDirty = TYPO_STR_KEYS.some((k) => !!value[k]) || (value.colorAlpha ?? 1) < 1;

  const handleReset = () => onChange(emptyTypography());

  const set = <K extends keyof TypographyValue>(key: K, v: TypographyValue[K]) =>
    onChange({ ...value, [key]: v });

  const openColor = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setColorOpen((o) => !o);
  };

  const sizeSV         = parseSide(value.fontSize);
  const lineHeightSV   = parseSide(value.lineHeight);
  const letterSpaceSV  = parseSide(value.letterSpacing);
  const wordSpaceSV    = parseSide(value.wordSpacing);

  const setSide = (key: "fontSize" | "lineHeight" | "letterSpacing" | "wordSpacing", sv: SideValue) => {
    const isEmpty = sv.num === 0 && sv.unit === "px";
    set(key, isEmpty ? "" : serializeSide(sv));
  };

  return (
    <div className={`epx-spacing-ctrl epx-typo-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Typography{breakpointIndicator}</span>
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
            <span className="epx-spacing-ctrl__label">Typography{breakpointIndicator}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <SelectRow
            label="Family"
            value={value.fontFamily ?? ""}
            onChange={(v) => set("fontFamily", v)}
            options={FAMILY_OPTIONS}
          />

          <div className="epx-side-input">
            <span className="epx-side-input__label epx-side-input__label--row">Color</span>
            <div className="epx-border-color-cell" style={{ flex: 1 }}>
              <button ref={swatchRef} type="button"
                className="epx-border-color-swatch"
                style={{ background: value.color || "#000000", opacity: value.colorAlpha ?? 1 }}
                onClick={openColor}
              />
              <span className="epx-border-color-hex">{getColorDisplay(value.color || "#000000", colorFormat)}</span>
              {colorOpen && (
                <ColorPicker
                  value={value.color || "#000000"}
                  alpha={value.colorAlpha ?? 1}
                  onChange={(hex, a) => onChange({ ...value, color: hex, colorAlpha: a })}
                  onClose={() => setColorOpen(false)}
                  position={colorPos}
                  format={colorFormat}
                  onFormatChange={setColorFormat}
                />
              )}
            </div>
          </div>

          <SideInput sideKey="" labelOverride="Size"
            value={sizeSV ?? ZERO}
            onChange={(sv) => setSide("fontSize", sv)}
          />

          <SelectRow
            label="Weight"
            value={value.fontWeight ?? ""}
            onChange={(v) => set("fontWeight", v)}
            options={WEIGHT_OPTIONS}
          />

          <SelectRow
            label="Transform"
            value={value.textTransform ?? ""}
            onChange={(v) => set("textTransform", v)}
            options={TRANSFORM_OPTIONS}
          />

          <SelectRow
            label="Style"
            value={value.fontStyle ?? ""}
            onChange={(v) => set("fontStyle", v)}
            options={STYLE_OPTIONS}
          />

          <SelectRow
            label="Decoration"
            value={value.textDecoration ?? ""}
            onChange={(v) => set("textDecoration", v)}
            options={DECORATION_OPTIONS}
          />

          <SideInput sideKey="" labelOverride="Line Height"
            value={lineHeightSV ?? ZERO}
            onChange={(sv) => setSide("lineHeight", sv)}
          />

          <SideInput sideKey="" labelOverride="Letter Spacing"
            value={letterSpaceSV ?? ZERO}
            onChange={(sv) => setSide("letterSpacing", sv)}
          />

          <SideInput sideKey="" labelOverride="Word Spacing"
            value={wordSpaceSV ?? ZERO}
            onChange={(sv) => setSide("wordSpacing", sv)}
          />
        </div>
      )}
    </div>
  );
}
