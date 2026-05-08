import React, { useState } from "react";
import { SideInput, parseSide, serializeSide, IconReset, type SideValue } from "./SpacingControl.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GapValue = {
  column?: SideValue;
  row?: SideValue;
};

export function parseGap(style: Record<string, unknown>): GapValue {
  return {
    column: parseSide(style.columnGap),
    row:    parseSide(style.rowGap),
  };
}

export function serializeGap(val: GapValue): Record<string, string> {
  return {
    columnGap: serializeSide(val.column ?? { num: 0, unit: "px" }),
    rowGap:    serializeSide(val.row    ?? { num: 0, unit: "px" }),
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconColumnGap() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.75" y="1.5" width="3" height="9" rx="0.75" fill="currentColor" opacity="0.5"/>
      <rect x="8.25" y="1.5" width="3" height="9" rx="0.75" fill="currentColor" opacity="0.5"/>
      <line x1="5.5" y1="3" x2="5.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
    </svg>
  );
}

function IconRowGap() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="0.75" width="9" height="3" rx="0.75" fill="currentColor" opacity="0.5"/>
      <rect x="1.5" y="8.25" width="9" height="3" rx="0.75" fill="currentColor" opacity="0.5"/>
      <line x1="3" y1="5.5" x2="9" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.5 1.5"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const ZERO: SideValue = { num: 0, unit: "px" };

export function GapControl({ value, onChange, breakpointIndicator }: {
  value: GapValue;
  onChange: (v: GapValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const col = value.column ?? ZERO;
  const row = value.row    ?? ZERO;

  const isMixed = col.num !== row.num || col.unit !== row.unit;
  const isDirty = (col.num !== 0) || (row.num !== 0);

  const handleCollapsedChange = (sv: SideValue) => {
    onChange({ column: sv, row: sv });
  };

  const handleReset = () => {
    onChange({ column: ZERO, row: ZERO });
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            {isMixed ? (
              <>
                <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>Gaps</span>
                {breakpointIndicator}
              </>
            ) : (
              <SideInput sideKey="" labelOverride="Gaps" value={col} onChange={handleCollapsedChange} labelSuffix={breakpointIndicator} />
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
            <span className="epx-spacing-ctrl__label">Gaps{breakpointIndicator}</span>
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
            <SideInput sideKey="" icon={<IconColumnGap />}
              value={col}
              onChange={(sv) => onChange({ ...value, column: sv })}
            />
            <SideInput sideKey="" icon={<IconRowGap />}
              value={row}
              onChange={(sv) => onChange({ ...value, row: sv })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
