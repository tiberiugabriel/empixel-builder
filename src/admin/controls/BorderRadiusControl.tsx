import React, { useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RadiusKeys = "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
export type RadiusValue = Partial<Record<RadiusKeys, SideValue>>;

export const RADIUS_CSS_KEYS: Record<RadiusKeys, string> = {
  topLeft:     "borderTopLeftRadius",
  topRight:    "borderTopRightRadius",
  bottomRight: "borderBottomRightRadius",
  bottomLeft:  "borderBottomLeftRadius",
};

const CORNERS: RadiusKeys[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

export function parseRadius(style: Record<string, unknown>): RadiusValue {
  return {
    topLeft:     parseSide(style.borderTopLeftRadius),
    topRight:    parseSide(style.borderTopRightRadius),
    bottomRight: parseSide(style.borderBottomRightRadius),
    bottomLeft:  parseSide(style.borderBottomLeftRadius),
  };
}

export function serializeRadius(val: RadiusValue): Record<string, string> {
  const out: Record<string, string> = {};
  (Object.entries(val) as [RadiusKeys, SideValue][]).forEach(([corner, sv]) => {
    out[RADIUS_CSS_KEYS[corner]] = serializeSide(sv);
  });
  return out;
}

// ─── Corner icons ─────────────────────────────────────────────────────────────

function IconTL() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2H4a2 2 0 0 0-2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function IconTR() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2h6a2 2 0 0 1 2 2v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function IconBR() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 10h6a2 2 0 0 0 2-2V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function IconBL() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10H4a2 2 0 0 1-2-2V2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

const CORNER_ICONS: Record<RadiusKeys, React.ReactNode> = {
  topLeft:     <IconTL />,
  topRight:    <IconTR />,
  bottomRight: <IconBR />,
  bottomLeft:  <IconBL />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function BorderRadiusControl({ value, onChange, breakpointIndicator }: {
  value: RadiusValue;
  onChange: (v: RadiusValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const collapsedValue: SideValue = value.topLeft ?? { num: 0, unit: "px" };
  const allVals = CORNERS.map(c => value[c] ?? { num: 0, unit: "px" });
  const isMixed = !allVals.every(v => v.num === allVals[0].num && v.unit === allVals[0].unit);
  const isDirty = CORNERS.some(c => {
    const sv = value[c];
    return (sv?.num ?? 0) !== 0 || (sv?.unit !== undefined && sv.unit !== "px");
  });

  const handleCollapsedChange = (sv: SideValue) => {
    const next: RadiusValue = {};
    CORNERS.forEach((c) => { next[c] = sv; });
    onChange(next);
  };

  const handleReset = () => {
    const next: RadiusValue = {};
    CORNERS.forEach(c => { next[c] = { num: 0, unit: "px" }; });
    onChange(next);
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            {isMixed ? (
              <span className="epx-side-input__label epx-side-input__label--full epx-side-input__label--has-suffix" style={{ cursor: "default" }}>Radius{breakpointIndicator}</span>
            ) : (
              <SideInput sideKey="" labelOverride="Radius" value={collapsedValue} onChange={handleCollapsedChange} labelSuffix={breakpointIndicator} />
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
            <span className="epx-spacing-ctrl__label">Radius{breakpointIndicator}</span>
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
            {CORNERS.map((corner) => (
              <SideInput key={corner} sideKey="" icon={CORNER_ICONS[corner]}
                value={value[corner] ?? { num: 0, unit: "px" }}
                onChange={(sv) => onChange({ ...value, [corner]: sv })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
