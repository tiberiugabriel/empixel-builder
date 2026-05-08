import React, { useRef, useState } from "react";
import type { IconGroupValue } from "../../types.js";
import type { MediaRef } from "./MediaPicker.js";
import { MediaPicker } from "./MediaPicker.js";
import { ImagePreviewCard } from "./ImagePreviewCard.js";
import { NumberWithUnits } from "./NumberWithUnits.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";
import { SelectRow } from "./FieldRow.js";
import { IconReset } from "./SpacingControl.js";

interface Props {
  label?: string;
  value: IconGroupValue | undefined;
  onChange: (v: IconGroupValue) => void;
  showPosition?: boolean;
  breakpointIndicator?: React.ReactNode;
}

const POSITION_OPTIONS = [
  { value: "left",   label: "Left" },
  { value: "right",  label: "Right" },
  { value: "top",    label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const POSITION_OPTIONS_DIVIDER = [
  { value: "left",   label: "Left of line" },
  { value: "center", label: "Centered (split)" },
  { value: "right",  label: "Right of line" },
  { value: "above",  label: "Above" },
  { value: "below",  label: "Below" },
];

function isPng(filename?: string): boolean {
  if (!filename) return false;
  return /\.png(\?|$)/i.test(filename);
}

export function IconGroup({ label = "Icon", value, onChange, showPosition, breakpointIndicator }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const v: IconGroupValue = value ?? {};
  const isDirty = !!(v.iconSrc || v.iconSize || v.iconColor || v.iconPosition);

  const set = <K extends keyof IconGroupValue>(key: K, val: IconGroupValue[K]) =>
    onChange({ ...v, [key]: val });

  const setIconSrc = (ref: MediaRef | undefined) => onChange({ ...v, iconSrc: ref });

  const handleReset = () => onChange({});

  const isIconPng = isPng(v.iconSrc?.filename);

  const openColor = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setColorOpen((o) => !o);
  };

  const isDividerLabel = label.toLowerCase().includes("divider");

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>{label}</span>
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
            <span className="epx-spacing-ctrl__label">{label}</span>
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

          <ImagePreviewCard
            image={v.iconSrc}
            onSelect={() => setPickerOpen(true)}
            onRemove={() => setIconSrc(undefined)}
            emptyLabel="Select Icon"
            boxed
          />

          {pickerOpen && (
            <MediaPicker
              title="Select Icon"
              mimeTypeFilter="image/"
              accept="image/svg+xml,image/png"
              onSelect={([ref]) => { setIconSrc(ref); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
              selectedIds={v.iconSrc?.id ? [v.iconSrc.id] : []}
            />
          )}

          <NumberWithUnits
            label="Size"
            value={v.iconSize}
            onChange={(s) => set("iconSize", s || undefined)}
            units={["px", "rem", "em", "%"]}
          />

          {/* Color (SVG only) — bare side-input row, no FieldGroup wrapper */}
          <div className="epx-side-input">
            <span className="epx-side-input__label epx-side-input__label--row">Color</span>
            <div className="epx-border-color-cell" style={{ flex: 1 }}>
              <button
                ref={swatchRef}
                type="button"
                className="epx-border-color-swatch"
                style={{ background: v.iconColor || "#000000", opacity: v.iconColorAlpha ?? 1 }}
                onClick={openColor}
              />
              <span className="epx-border-color-hex">{getColorDisplay(v.iconColor || "#000000", colorFormat)}</span>
              {colorOpen && (
                <ColorPicker
                  value={v.iconColor || "#000000"}
                  alpha={v.iconColorAlpha ?? 1}
                  onChange={(hex, a) => onChange({ ...v, iconColor: hex, iconColorAlpha: a })}
                  onClose={() => setColorOpen(false)}
                  position={colorPos}
                  format={colorFormat}
                  onFormatChange={setColorFormat}
                />
              )}
            </div>
          </div>

          {isIconPng && (v.iconColor || (v.iconColorAlpha !== undefined && v.iconColorAlpha < 1)) && (
            <p style={{ fontSize: 10, color: "var(--epx-text-faint)", margin: "0 0 4px 0" }}>
              Color applies to SVG only — ignored for PNG.
            </p>
          )}

          {showPosition && (
            <SelectRow
              label="Position"
              value={v.iconPosition ?? ""}
              onChange={(val) => set("iconPosition", (val || undefined) as IconGroupValue["iconPosition"])}
              options={isDividerLabel ? POSITION_OPTIONS_DIVIDER : POSITION_OPTIONS}
            />
          )}
        </div>
      )}
    </div>
  );
}
