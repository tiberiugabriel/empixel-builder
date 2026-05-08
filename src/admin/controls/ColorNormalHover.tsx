import React, { useRef, useState } from "react";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";
import { FieldGroup } from "./FieldRow.js";

export interface ColorValue {
  color?: string;
  alpha?: number;
}

interface Props {
  label: string;
  normal: ColorValue;
  hover: ColorValue;
  onNormalChange: (v: ColorValue) => void;
  onHoverChange: (v: ColorValue) => void;
  breakpointIndicator?: React.ReactNode;
  defaultColor?: string;
}

function IconStateNormal() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="6.5" r="3" fill="currentColor" />
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

function IconStateHover() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2.5L3 10L5.5 7.5L7 11L8.5 10.4L7 7H10.5L3 2.5Z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

export function ColorNormalHover({ label, normal, hover, onNormalChange, onHoverChange, breakpointIndicator, defaultColor = "#000000" }: Props) {
  const [mode, setMode] = useState<"normal" | "hover">("normal");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [format, setFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const active = mode === "hover" ? hover : normal;
  const handleChange = (hex: string, a: number) => {
    if (mode === "hover") onHoverChange({ color: hex, alpha: a });
    else onNormalChange({ color: hex, alpha: a });
  };
  const handleReset = () => {
    if (mode === "hover") onHoverChange({});
    else onNormalChange({});
  };

  const openPicker = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setOpen((o) => !o);
  };

  const isDirty = !!active.color || (active.alpha !== undefined && active.alpha < 1);

  return (
    <div className="epx-stateful-ctrl">
      <div className="epx-state-toggle">
        <button type="button" className={`epx-state-toggle__btn${mode === "normal" ? " is-active" : ""}`} onClick={() => setMode("normal")} data-tooltip="Normal">
          <IconStateNormal />
        </button>
        <button type="button" className={`epx-state-toggle__btn${mode === "hover" ? " is-active" : ""}`} onClick={() => setMode("hover")} data-tooltip="Hover">
          <IconStateHover />
        </button>
      </div>
      <FieldGroup isDirty={isDirty} onReset={handleReset}>
        <div className="epx-side-input">
          <span className="epx-side-input__label epx-side-input__label--row">{label}</span>
          {breakpointIndicator}
          <div className="epx-border-color-cell" style={{ flex: 1 }}>
            <button
              ref={swatchRef}
              type="button"
              className="epx-border-color-swatch"
              style={{ background: active.color || defaultColor, opacity: active.alpha ?? 1 }}
              onClick={openPicker}
            />
            <span className="epx-border-color-hex">{getColorDisplay(active.color || defaultColor, format)}</span>
            {open && (
              <ColorPicker
                value={active.color || defaultColor}
                alpha={active.alpha ?? 1}
                onChange={handleChange}
                onClose={() => setOpen(false)}
                position={pos}
                format={format}
                onFormatChange={setFormat}
              />
            )}
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}
