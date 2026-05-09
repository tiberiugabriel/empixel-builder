import { lazy, Suspense, type ReactNode } from "react";
import type { BreakpointId, SectionBlock } from "../../types.js";
import {
  parseSide,
  serializeSide,
  SpacingControl,
  type SideValue,
  type SpacingKeys,
  type SpacingValue,
} from "../controls/SpacingControl.js";
import {
  DimensionControl,
  FieldGroup,
  NumberRow,
  SelectRow,
  TextRow,
} from "../controls/FieldRow.js";
import type { AdvancedConfig } from "./types.js";

/**
 * F4.3 — Custom CSS uses `CodeEditor`, which is the same heavy
 * control consumed by the Fields-tab `code` renderer. The Advanced
 * tab is reachable for every block (not just blocks with a code
 * field), but the Custom CSS textarea is at the bottom of a long
 * scrolling form — most users open the panel without scrolling that
 * far. Lazy-import keeps the initial chunk lean; React de-dupes the
 * dynamic import with the FieldRenderer copy so the editor downloads
 * once across the whole admin app.
 */
const CodeEditor = lazy(() =>
  import("../controls/CodeEditor.js").then((m) => ({ default: m.CodeEditor })),
);

/**
 * Universal Advanced tab (F3.5.5). Renders identically for every block
 * type — Width / Height / Padding / Margin / Position+Offset / Z-Index
 * / CSS ID / CSS Classes / Custom CSS. Mirrors the inline JSX in
 * `RightPanel.tsx` so the F3.5.6 swap is visually invisible.
 *
 * Reads `block.config.advanced` + `block.config.style`. Dispatches
 * `onChange` with merged config patches — `{ advanced }` for the
 * position/z-index/css/customCss group and `{ style }` for width /
 * height / padding / margin (matches the legacy paths so CSS keys do
 * not move). `activeBreakpoint` is reserved for future breakpoint-aware
 * extensions — the inline implementation in `RightPanel.tsx` writes
 * Advanced fields to base `style` regardless of breakpoint.
 */

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "",         label: "Default"  },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed",    label: "Fixed"    },
  { value: "sticky",   label: "Sticky"   },
];

function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

export interface AdvancedTabProps {
  block: SectionBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId | null;
}

const CSS_KEYS = {
  width:  { fix: "width",  min: "minWidth",  max: "maxWidth"  },
  height: { fix: "height", min: "minHeight", max: "maxHeight" },
} as const;

export function AdvancedTab({ block, onChange }: AdvancedTabProps): ReactNode {
  const advanced = (block.config.advanced ?? {}) as AdvancedConfig;
  const style = (block.config.style ?? {}) as Record<string, unknown>;

  const writeAdvanced = (next: AdvancedConfig) => onChange({ advanced: next });
  const set = (key: keyof AdvancedConfig, val: unknown) =>
    writeAdvanced({ ...advanced, [key]: val });

  const selector = `[data-epx-block="${block.id}"]`;
  const zIndexNum = typeof advanced.zIndex === "number"
    ? advanced.zIndex
    : (advanced.zIndex ? Number(advanced.zIndex) : undefined);
  const hasPosition = !!advanced.position;

  const offsetValue: SpacingValue = {
    top:    parseSide(advanced.top),
    right:  parseSide(advanced.right),
    bottom: parseSide(advanced.bottom),
    left:   parseSide(advanced.left),
  };
  const handleOffset = (v: SpacingValue) => {
    const sides: SpacingKeys[] = ["top", "right", "bottom", "left"];
    const next: Partial<AdvancedConfig> = {};
    sides.forEach((s) => {
      next[s] = v[s] ? serializeSide(v[s] as SideValue) : undefined;
    });
    writeAdvanced({ ...advanced, ...next });
  };

  const widthValues = {
    fix: parseSide(style.width),
    min: parseSide(style.minWidth),
    max: parseSide(style.maxWidth),
  };
  const heightValues = {
    fix: parseSide(style.height),
    min: parseSide(style.minHeight),
    max: parseSide(style.maxHeight),
  };
  const handleDimension = (
    axis: "width" | "height",
    key: "fix" | "min" | "max",
    sv: SideValue,
  ) => {
    onChange({ style: { ...style, [CSS_KEYS[axis][key]]: serializeSide(sv) } });
  };
  const onResetWidth = () =>
    onChange({ style: { ...style, width: "", minWidth: "", maxWidth: "" } });
  const onResetHeight = () =>
    onChange({ style: { ...style, height: "", minHeight: "", maxHeight: "" } });

  const paddingValue: SpacingValue = {
    top:    parseSide(style.paddingTop),
    right:  parseSide(style.paddingRight),
    bottom: parseSide(style.paddingBottom),
    left:   parseSide(style.paddingLeft),
  };
  const marginValue: SpacingValue = {
    top:    parseSide(style.marginTop),
    right:  parseSide(style.marginRight),
    bottom: parseSide(style.marginBottom),
    left:   parseSide(style.marginLeft),
  };
  const handleSpacing = (key: "padding" | "margin", val: SpacingValue) => {
    const next: Record<string, unknown> = { ...style };
    Object.entries(val).forEach(([side, sv]) => {
      const cssKey = `${key}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      next[cssKey] = serializeSide(sv as SideValue);
    });
    onChange({ style: next });
  };

  return (
    <div className="epx-right-panel__fields">
      <DimensionControl
        label="Width"
        values={widthValues}
        onChange={(key, v) => handleDimension("width", key, v)}
        onReset={onResetWidth}
      />
      <DimensionControl
        label="Height"
        values={heightValues}
        onChange={(key, v) => handleDimension("height", key, v)}
        onReset={onResetHeight}
      />
      <SpacingControl
        label="Padding"
        value={paddingValue}
        onChange={(v) => handleSpacing("padding", v)}
        sides={["top", "right", "bottom", "left"]}
      />
      <SpacingControl
        label="Margin"
        value={marginValue}
        onChange={(v) => handleSpacing("margin", v)}
        sides={["top", "right", "bottom", "left"]}
      />
      <PanelDivider />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <FieldGroup
          isDirty={!!advanced.position}
          onReset={() =>
            writeAdvanced({
              ...advanced,
              position: "",
              top: undefined,
              right: undefined,
              bottom: undefined,
              left: undefined,
            })
          }
        >
          <SelectRow
            label="Position"
            value={advanced.position ?? ""}
            onChange={(v) => set("position", v)}
            options={POSITION_OPTIONS}
            labelClassName="epx-row-label--section"
          />
        </FieldGroup>

        {hasPosition && (
          <SpacingControl
            label="Offset"
            value={offsetValue}
            onChange={handleOffset}
            sides={["top", "right", "bottom", "left"]}
            forceExpanded
          />
        )}
      </div>

      <FieldGroup
        isDirty={zIndexNum !== undefined}
        onReset={() => set("zIndex", undefined)}
      >
        <NumberRow
          label="Z-Index"
          value={zIndexNum}
          onChange={(v) => set("zIndex", v)}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!advanced.cssId}
        onReset={() => set("cssId", "")}
      >
        <TextRow
          label="CSS ID"
          value={advanced.cssId ?? ""}
          onChange={(v) => set("cssId", v)}
          placeholder="#"
          labelClassName="epx-row-label--color"
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!advanced.cssClasses}
        onReset={() => set("cssClasses", "")}
      >
        <TextRow
          label="CSS Classes"
          value={advanced.cssClasses ?? ""}
          onChange={(v) => set("cssClasses", v)}
          placeholder="."
          labelClassName="epx-row-label--color"
        />
      </FieldGroup>

      <div className="epx-field">
        <label className="epx-field__label">Custom CSS</label>
        <Suspense
          fallback={
            <div
              className="epx-code-editor epx-code-editor--loading"
              aria-busy="true"
              style={{ minHeight: 160 }}
            />
          }
        >
          <CodeEditor
            value={advanced.customCss ?? ""}
            onChange={(v) => set("customCss", v)}
            language="css"
            selectorHeader={selector}
          />
        </Suspense>
      </div>
    </div>
  );
}
