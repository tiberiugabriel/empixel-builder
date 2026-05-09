import type { FieldRenderProps } from "../../blockDefinitions.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import { LayoutControl, parseLayout } from "../../controls/LayoutControl.js";
import {
  GapControl,
  parseGap,
  serializeGap,
  type GapValue,
} from "../../controls/GapControl.js";
import {
  OverflowControl,
  parseOverflow,
  serializeOverflow,
  type OverflowValue,
} from "../../controls/OverflowControl.js";
import {
  LinkControl,
  parseLink,
  serializeLink,
  type LinkValue,
} from "../../controls/LinkControl.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

const HTML_TAG_OPTIONS = [
  { value: "",        label: "Default (div)" },
  { value: "div",     label: "div" },
  { value: "header",  label: "header" },
  { value: "footer",  label: "footer" },
  { value: "main",    label: "main" },
  { value: "article", label: "article" },
  { value: "section", label: "section" },
  { value: "aside",   label: "aside" },
  { value: "nav",     label: "nav" },
  { value: "a",       label: "a (link)" },
];

function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

/**
 * Fields-tab content for the `container` block. Bundles:
 *
 * - `LayoutControl` (flex/grid + direction/wrap/align/justify) — bp-aware.
 * - `GapControl` (column/row gap) — bp-aware.
 * - `OverflowControl` (overflow x/y) — base style only.
 * - HTML Tag selector (`htmlTag` — flat config key).
 * - `LinkControl` shown only when `htmlTag === "a"`.
 *
 * F3.5.6 — extracted from `RightPanel.tsx`'s imperative
 * `block.type === "container"` Fields branches (~lines 839, 849, 852).
 * Backs the `{ kind: "custom", render: ContainerLayoutPicker }` entry
 * in the container block's `fieldsTab`.
 */
export function ContainerLayoutPicker({ block, onChange, activeBreakpoint }: FieldRenderProps) {
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpDefaultPx = BREAKPOINT_DEFS.find((b) => b.id === activeBreakpoint)?.defaultPx ?? 992;
  const config = block.config as Record<string, unknown>;
  const style = (config.style ?? {}) as Record<string, unknown>;
  const styleBreakpoints = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};

  const writeBpStyle = (patch: Record<string, unknown>) => {
    const current = styleBreakpoints[activeBreakpoint] ?? {};
    onChange({
      styleBreakpoints: {
        ...styleBreakpoints,
        [activeBreakpoint]: { ...current, _px: bpDefaultPx, ...patch },
      },
    });
  };

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  const gapSource = isNonDesktop ? { ...style, ...bpStyleRaw } : style;
  const gapValue: GapValue = parseGap(gapSource);
  const handleGap = (val: GapValue) => {
    if (isNonDesktop) writeBpStyle(serializeGap(val));
    else onChange({ style: { ...style, ...serializeGap(val) } });
  };

  const overflowValue: OverflowValue = parseOverflow(style);
  const handleOverflow = (val: OverflowValue) => {
    onChange({ style: { ...style, ...serializeOverflow(val) } });
  };

  const linkValue: LinkValue = parseLink(config);
  const handleLink = (val: LinkValue) => onChange(serializeLink(val));

  const layoutSource = isNonDesktop ? { ...config, ...bpStyleRaw } : config;
  const htmlTag = (config.htmlTag as string) ?? "";

  return (
    <>
      <LayoutControl
        value={parseLayout(layoutSource)}
        onChange={(patch) => {
          if (isNonDesktop) writeBpStyle(patch as Record<string, unknown>);
          else onChange(patch as Record<string, unknown>);
        }}
        breakpointIndicator={breakpointIndicator}
      />
      <GapControl value={gapValue} onChange={handleGap} breakpointIndicator={breakpointIndicator} />
      <PanelDivider />
      <OverflowControl value={overflowValue} onChange={handleOverflow} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <FieldGroup
          isDirty={!!htmlTag}
          onReset={() => onChange({ htmlTag: "" })}
        >
          <SelectRow
            label="HTML Tag"
            value={htmlTag}
            onChange={(v) => onChange({ htmlTag: v })}
            options={HTML_TAG_OPTIONS}
            labelClassName="epx-row-label--section"
          />
        </FieldGroup>
        {htmlTag === "a" && (
          <LinkControl value={linkValue} onChange={handleLink} />
        )}
      </div>
    </>
  );
}
