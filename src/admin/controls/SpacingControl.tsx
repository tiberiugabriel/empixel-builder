import React, { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export const SPACING_UNITS = ["px", "%", "em", "rem", "vw", "vh", "pt", "cm", "mm", "auto"] as const;
export type SpacingUnit = (typeof SPACING_UNITS)[number];
export type SpacingKeys = "top" | "right" | "bottom" | "left";

export interface SideValue { num: number; unit: string; raw?: string; }
export type SpacingValue = Partial<Record<SpacingKeys, SideValue>>;

const SIDE_LABELS: Record<SpacingKeys, string> = { top: "T", right: "R", bottom: "B", left: "L" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseSide(raw: unknown): SideValue {
  if (typeof raw === "number") return { num: raw, unit: "px" };
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "auto") return { num: 0, unit: "auto" };
    if (t === "") return { num: 0, unit: "px" };
    if (t.startsWith("@@")) return { num: 0, unit: "custom", raw: t.slice(2) };
    const sorted = [...SPACING_UNITS].filter(u => u !== "auto").sort((a, b) => b.length - a.length);
    for (const unit of sorted) {
      if (t.endsWith(unit)) {
        const n = parseFloat(t.slice(0, -unit.length));
        if (!isNaN(n)) return { num: n, unit };
      }
    }
    const n = parseFloat(t);
    if (!isNaN(n)) return { num: n, unit: "px" };
    return { num: 0, unit: "custom", raw: t };
  }
  return { num: 0, unit: "px" };
}

export function serializeSide(sv: SideValue): string {
  if (sv.unit === "auto") return "auto";
  if (sv.unit === "custom") return `@@${sv.raw ?? ""}`;
  return `${sv.num}${sv.unit}`;
}

// ─── Pen icon ────────────────────────────────────────────────────────────────

function IconPen() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Reset icon ──────────────────────────────────────────────────────────────

export function IconReset() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 6A4.5 4.5 0 1 0 3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M1.5 1v2.5H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── UnitDropdown ─────────────────────────────────────────────────────────────

function UnitDropdown({ unit, onSelect, onClose, anchorRef }: {
  unit: string;
  onSelect: (u: string) => void;
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
      {SPACING_UNITS.map((u) => (
        <button key={u} type="button"
          className={`epx-unit-dropdown__item${u === unit ? " is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); onSelect(u); onClose(); }}
        >{u}</button>
      ))}
      <div className="epx-unit-dropdown__sep" />
      <button type="button"
        className={`epx-unit-dropdown__item epx-unit-dropdown__item--pen${unit === "custom" ? " is-active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); onSelect("custom"); onClose(); }}
      ><IconPen /></button>
    </div>
  );
}

// ─── SideInput ────────────────────────────────────────────────────────────────

export function SideInput({ sideKey, value, onChange, labelOverride, icon, allowNegative, labelSuffix }: {
  sideKey: string;
  value: SideValue;
  onChange: (sv: SideValue) => void;
  labelOverride?: string;
  icon?: React.ReactNode;
  allowNegative?: boolean;
  labelSuffix?: React.ReactNode;
}) {
  const [unitOpen, setUnitOpen] = useState(false);
  const unitBtnRef = useRef<HTMLButtonElement>(null);

  const handleScrubDown = (e: React.MouseEvent) => {
    if (value.unit === "auto" || value.unit === "custom") return;
    e.preventDefault();
    const startX = e.clientX;
    const startNum = value.num;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const next = Math.round(startNum + (ev.clientX - startX) / 2);
      onChange({ ...value, num: allowNegative ? next : Math.max(0, next) });
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
        className={`epx-side-input__label${labelOverride ? " epx-side-input__label--full" : ""}${icon ? " epx-side-input__label--icon" : ""}${labelSuffix ? " epx-side-input__label--has-suffix" : ""}`}
        onMouseDown={handleScrubDown}
        title="Drag to adjust"
      >
        {icon ?? labelOverride ?? sideKey}
        {labelSuffix}
      </span>
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
          value={value.unit === "auto" ? "" : value.num}
          placeholder={value.unit === "auto" ? "auto" : "0"}
          disabled={value.unit === "auto"}
          min={allowNegative ? undefined : 0}
          step={1}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange({ ...value, num: isNaN(n) ? 0 : n });
          }}
        />
      )}
      <div className="epx-side-input__unit-wrap">
        <button ref={unitBtnRef} type="button"
          className={`epx-side-input__unit-btn${value.unit === "custom" ? " epx-side-input__unit-btn--icon" : ""}`}
          onClick={() => setUnitOpen(o => !o)}
        >{value.unit === "custom" ? <IconPen /> : value.unit}</button>
        {unitOpen && (
          <UnitDropdown
            unit={value.unit}
            onSelect={(u) => onChange({ ...value, unit: u, num: u === "auto" || u === "custom" ? 0 : value.num, raw: u === "custom" ? "" : undefined })}
            onClose={() => setUnitOpen(false)}
            anchorRef={unitBtnRef as React.RefObject<HTMLButtonElement>}
          />
        )}
      </div>
    </div>
  );
}

// ─── SpacingControl ───────────────────────────────────────────────────────────

export function SpacingControl({ label, value, onChange, sides, forceExpanded }: {
  label: string;
  value: SpacingValue;
  onChange: (v: SpacingValue) => void;
  sides: SpacingKeys[];
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const firstSide = sides[0];
  const collapsedValue: SideValue = value[firstSide] ?? { num: 0, unit: "px" };
  const allVals = sides.map(s => value[s] ?? { num: 0, unit: "px" });
  const isMixed = !allVals.every(v => v.num === allVals[0].num && v.unit === allVals[0].unit);
  const isDirty = sides.some(s => {
    const sv = value[s];
    return (sv?.num ?? 0) !== 0 || (sv?.unit !== undefined && sv.unit !== "px");
  });

  const handleCollapsedChange = (sv: SideValue) => {
    const next: SpacingValue = { ...value };
    sides.forEach((s) => { next[s] = sv; });
    onChange(next);
  };

  const handleReset = () => {
    const next: SpacingValue = { ...value };
    sides.forEach(s => { next[s] = { num: 0, unit: "px" }; });
    onChange(next);
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded && !forceExpanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            {isMixed ? (
              <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>{label}</span>
            ) : (
              <SideInput sideKey="" labelOverride={label} value={collapsedValue} onChange={handleCollapsedChange} />
            )}
            {isMixed && <span className="epx-border-mixed">Mixed</span>}
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
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={handleReset} title="Reset">
                  <IconReset />
                </button>
              )}
              {!forceExpanded && (
                <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
              )}
            </div>
          </div>
          <div className={`epx-spacing-ctrl__grid epx-spacing-ctrl__grid--${sides.length <= 2 ? "col1" : "col2"}`}>
            {sides.map((side) => (
              <SideInput key={side} sideKey={SIDE_LABELS[side]}
                value={value[side] ?? { num: 0, unit: "px" }}
                onChange={(sv) => onChange({ ...value, [side]: sv })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
