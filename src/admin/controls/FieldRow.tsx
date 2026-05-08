import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SideInput, IconReset, type SideValue } from "./SpacingControl.js";

// ─── FieldGroup ───────────────────────────────────────────────────────────────

export function FieldGroup({ children, isDirty, onReset }: {
  children: React.ReactNode;
  isDirty?: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="epx-spacing-ctrl__row">
      <div className={`epx-field-group${isDirty ? " is-dirty" : ""}`}>{children}</div>
      {isDirty && onReset && (
        <button type="button" className="epx-reset-btn" onClick={onReset} title="Reset">
          <IconReset />
        </button>
      )}
    </div>
  );
}

// ─── DimensionRow ─────────────────────────────────────────────────────────────

export function DimensionRow({ label, value, onChange }: {
  label: string;
  value: SideValue;
  onChange: (v: SideValue) => void;
}) {
  return <SideInput sideKey="" labelOverride={label} value={value} onChange={onChange} />;
}

// ─── NumberRow ────────────────────────────────────────────────────────────────

export function NumberRow({ label, value, onChange, labelClassName, step = 1, min, max }: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  labelClassName?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  const clamp = (n: number) => {
    if (typeof min === "number" && n < min) n = min;
    if (typeof max === "number" && n > max) n = max;
    return n;
  };
  const snap = (n: number) => {
    if (step >= 1) return Math.round(n / step) * step;
    const inv = 1 / step;
    return Math.round(n * inv) / inv;
  };

  const handleScrubDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startNum = value ?? 0;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      // 2px of drag ≈ 1 step
      const delta = (ev.clientX - startX) / 2;
      onChange(clamp(snap(startNum + delta * step)));
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
        className={`epx-side-input__label epx-side-input__label--row epx-side-input__label--scrub${labelClassName ? ` ${labelClassName}` : ""}`}
        style={{ cursor: "ew-resize" }}
        onMouseDown={handleScrubDown}
        title="Drag to adjust"
      >{label}</span>
      <input
        type="number"
        className="epx-side-input__num"
        value={value ?? ""}
        placeholder="0"
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") { onChange(undefined); return; }
          const n = step < 1 ? parseFloat(raw) : parseInt(raw, 10);
          onChange(isNaN(n) ? undefined : clamp(snap(n)));
        }}
      />
    </div>
  );
}

// ─── SelectDropdown ───────────────────────────────────────────────────────────

function SelectDropdown({ value, options, onSelect, onClose, anchorRef }: {
  value: string;
  options: { value: string; label: React.ReactNode }[];
  onSelect: (v: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLDivElement>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) &&
          !anchorRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  useLayoutEffect(() => {
    const reposition = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const r = anchor.getBoundingClientRect();
      const ph = panel.offsetHeight;
      const spaceBelow = window.innerHeight - r.bottom;
      const flipUp = spaceBelow < ph + 8 && r.top > ph + 8;
      const top = flipUp ? Math.max(4, r.top - ph - 4) : r.bottom + 4;
      const left = Math.max(4, r.right - panel.offsetWidth);
      setPos({ top, left });
    };
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [anchorRef]);

  const portalStyle: React.CSSProperties = {
    position: "fixed",
    top: pos?.top ?? -9999,
    left: pos?.left ?? -9999,
    right: "auto",
    width: "max-content",
    zIndex: 9999,
  };

  const regular = options.filter((o) => o.value !== "custom");
  const customOpts = options.filter((o) => o.value === "custom");

  return createPortal(
    <div ref={panelRef} className="epx-unit-dropdown" style={portalStyle}>
      {regular.map((opt) => (
        <button key={opt.value} type="button"
          className={`epx-unit-dropdown__item${opt.value === value ? " is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(opt.value); onClose(); }}
        >{opt.label}</button>
      ))}
      {customOpts.length > 0 && <div className="epx-unit-dropdown__sep" />}
      {customOpts.map((opt) => (
        <button key={opt.value} type="button"
          className={`epx-unit-dropdown__item epx-unit-dropdown__item--pen${opt.value === value ? " is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(opt.value); onClose(); }}
        >{opt.label}</button>
      ))}
    </div>,
    document.body,
  );
}

// ─── SelectRow ────────────────────────────────────────────────────────────────

export function SelectRow({ label, value, onChange, options, labelClassName, icon, labelSuffix, leftAddon, onLabelMouseDown }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: React.ReactNode }[];
  labelClassName?: string;
  icon?: React.ReactNode;
  labelSuffix?: React.ReactNode;
  /** Optional content rendered between the label and the dropdown — typically
   *  a number/text input shown for "custom" values (mirrors SideInput's unit pattern). */
  leftAddon?: React.ReactNode;
  /** Optional mousedown handler on the label to allow drag-scrubbing values. */
  onLabelMouseDown?: (e: React.MouseEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const display = options.find(o => o.value === value)?.label ?? (value || "—");

  return (
    <div className="epx-side-input">
      <span
        className={`epx-side-input__label${icon ? " epx-side-input__label--icon" : " epx-side-input__label--row"}${onLabelMouseDown ? " epx-side-input__label--scrub" : ""}${labelClassName ? ` ${labelClassName}` : ""}`}
        style={onLabelMouseDown ? { cursor: "ew-resize" } : undefined}
        onMouseDown={onLabelMouseDown}
        title={onLabelMouseDown ? "Drag to adjust" : undefined}
        {...(icon && label ? { "data-tooltip": label } : {})}
      >{icon ?? label}</span>
      {labelSuffix}
      {leftAddon}
      <div ref={wrapRef} className="epx-field-row__select-wrap">
        <button type="button" className="epx-field-row__select-btn" onClick={() => setOpen(o => !o)}>
          <span>{display}</span>
          <span className="epx-field-row__select-caret">▾</span>
        </button>
        {open && (
          <SelectDropdown
            value={value}
            options={options}
            onSelect={(v) => { onChange(v); setOpen(false); }}
            onClose={() => setOpen(false)}
            anchorRef={wrapRef as React.RefObject<HTMLDivElement>}
          />
        )}
      </div>
    </div>
  );
}

// ─── IconButtonRow ────────────────────────────────────────────────────────────

export function IconButtonRow({ label, value, onChange, options, labelClassName }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; icon: React.ReactNode; title: string }[];
  labelClassName?: string;
}) {
  return (
    <div className="epx-side-input">
      <span className={`epx-side-input__label epx-side-input__label--row${labelClassName ? ` ${labelClassName}` : ""}`}>{label}</span>
      <div className="epx-icon-btn-group">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`epx-icon-btn${value === opt.value ? " is-active" : ""}`}
            onClick={() => onChange(opt.value)}
            data-tooltip={opt.title}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TextRow ──────────────────────────────────────────────────────────────────

export function TextRow({ label, value, onChange, placeholder, labelClassName }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  labelClassName?: string;
}) {
  return (
    <div className="epx-side-input">
      <span className={`epx-side-input__label epx-side-input__label--row${labelClassName ? ` ${labelClassName}` : ""}`}>{label}</span>
      <input
        type="text"
        className="epx-side-input__num"
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ─── DimensionControl ─────────────────────────────────────────────────────────

const isEmpty = (sv: SideValue) => sv.num === 0 && sv.unit === "px";

export function DimensionControl({ label, values, onChange, onReset }: {
  label: string;
  values: { fix: SideValue; min: SideValue; max: SideValue };
  onChange: (key: "fix" | "min" | "max", v: SideValue) => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDirty = !isEmpty(values.fix) || !isEmpty(values.min) || !isEmpty(values.max);

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <SideInput sideKey="" labelOverride={label} value={values.fix} onChange={(v) => onChange("fix", v)} />
            <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(true)}>▾</button>
          </div>
          {isDirty && (
            <button type="button" className="epx-reset-btn" onClick={onReset} title="Reset">
              <IconReset />
            </button>
          )}
        </div>
      ) : (
        <div className="epx-spacing-ctrl__expanded">
          <div className="epx-spacing-ctrl__exp-header">
            <span className="epx-spacing-ctrl__label">{label}</span>
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={onReset} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>
          <SideInput sideKey="" labelOverride="Fix" value={values.fix} onChange={(v) => onChange("fix", v)} />
          <SideInput sideKey="" labelOverride="Min" value={values.min} onChange={(v) => onChange("min", v)} />
          <SideInput sideKey="" labelOverride="Max" value={values.max} onChange={(v) => onChange("max", v)} />
        </div>
      )}
    </div>
  );
}
