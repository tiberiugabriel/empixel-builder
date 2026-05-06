import React from "react";
import { FieldGroup, SelectRow } from "./FieldRow.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlignValue {
  textAlign?: string;
}

export const ALIGN_OPTIONS = [
  { value: "",        label: "Default" },
  { value: "left",    label: "Left" },
  { value: "center",  label: "Center" },
  { value: "right",   label: "Right" },
  { value: "justify", label: "Justified" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseAlign(style: Record<string, unknown>): AlignValue {
  return { textAlign: (style.textAlign as string) ?? "" };
}

export function serializeAlign(val: AlignValue): Record<string, string> {
  return { textAlign: val.textAlign ?? "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AlignControl({ value, onChange, breakpointIndicator }: {
  value: AlignValue;
  onChange: (v: AlignValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const isDirty = !!value.textAlign;
  return (
    <FieldGroup isDirty={isDirty} onReset={() => onChange({ textAlign: "" })}>
      <SelectRow
        label="Align"
        value={value.textAlign ?? ""}
        onChange={(v) => onChange({ textAlign: v })}
        options={ALIGN_OPTIONS}
        labelClassName="epx-row-label--section"
        labelSuffix={breakpointIndicator}
      />
    </FieldGroup>
  );
}
