import React from "react";
import { SideInput, parseSide, serializeSide, type SideValue } from "./SpacingControl.js";
import { FieldGroup } from "./FieldRow.js";

interface Props {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  units?: readonly string[];
  breakpointIndicator?: React.ReactNode;
  allowNegative?: boolean;
}

const DEFAULT_UNITS = ["px", "rem", "em", "%", "vh", "vw"] as const;

export function NumberWithUnits({ label, value, onChange, units, breakpointIndicator, allowNegative }: Props) {
  const sv: SideValue = parseSide(value);
  const isDirty = !!value && (sv.unit !== "px" || sv.num !== 0 || !!sv.raw);

  const handleChange = (next: SideValue) => {
    const isEmpty = next.num === 0 && next.unit === "px";
    onChange(isEmpty ? "" : serializeSide(next));
  };

  return (
    <FieldGroup isDirty={isDirty} onReset={() => onChange("")}>
      <SideInput
        sideKey=""
        labelOverride={label}
        value={sv}
        onChange={handleChange}
        units={units ?? DEFAULT_UNITS}
        labelSuffix={breakpointIndicator}
        allowNegative={allowNegative}
      />
    </FieldGroup>
  );
}
