import React from "react";
import { FieldGroup, SelectRow } from "./FieldRow.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlendModeValue {
  mixBlendMode?: string;
}

export const BLEND_MODE_OPTIONS = [
  { value: "",            label: "Default" },
  { value: "normal",      label: "Normal" },
  { value: "multiply",    label: "Multiply" },
  { value: "screen",      label: "Screen" },
  { value: "overlay",     label: "Overlay" },
  { value: "darken",      label: "Darken" },
  { value: "lighten",     label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn",  label: "Color Burn" },
  { value: "hard-light",  label: "Hard Light" },
  { value: "soft-light",  label: "Soft Light" },
  { value: "difference",  label: "Difference" },
  { value: "exclusion",   label: "Exclusion" },
  { value: "hue",         label: "Hue" },
  { value: "saturation",  label: "Saturation" },
  { value: "color",       label: "Color" },
  { value: "luminosity",  label: "Luminosity" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseBlendMode(style: Record<string, unknown>): BlendModeValue {
  return { mixBlendMode: (style.mixBlendMode as string) ?? "" };
}

export function serializeBlendMode(val: BlendModeValue): Record<string, string> {
  return { mixBlendMode: val.mixBlendMode ?? "" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BlendModeControl({ value, onChange, breakpointIndicator }: {
  value: BlendModeValue;
  onChange: (v: BlendModeValue) => void;
  breakpointIndicator?: React.ReactNode;
}) {
  const isDirty = !!value.mixBlendMode;
  return (
    <FieldGroup isDirty={isDirty} onReset={() => onChange({ mixBlendMode: "" })}>
      <SelectRow
        label="Blend Mode"
        value={value.mixBlendMode ?? ""}
        onChange={(v) => onChange({ mixBlendMode: v })}
        options={BLEND_MODE_OPTIONS}
        labelClassName="epx-row-label--section"
        labelSuffix={breakpointIndicator}
      />
    </FieldGroup>
  );
}
