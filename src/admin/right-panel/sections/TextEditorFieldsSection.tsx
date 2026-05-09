import type { FieldRenderProps } from "../../blockDefinitions.js";
import { BREAKPOINT_DEFS } from "../../../types.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import {
  parseSide,
  serializeSide,
  SideInput,
} from "../../controls/SpacingControl.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

/**
 * Text-Editor block Fields-tab extras — Drop Cap toggle, Columns select
 * with custom-pen + scrub label + leftAddon for the custom column count,
 * Columns Gap inline SideInput. All bp-aware via `configBreakpoints[bpId]`.
 *
 * F3.5.6 — extracted from `RightPanel.tsx`'s `block.type === "text-editor"`
 * Fields branch (~lines 631–778). Backs the
 * `{ kind: "custom", render: TextEditorFieldsSection }` entry in the
 * text-editor block's `fieldsTab` (added after the rich-text content
 * field).
 */
export function TextEditorFieldsSection({ block, onChange, activeBreakpoint }: FieldRenderProps) {
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpDefaultPx = BREAKPOINT_DEFS.find((b) => b.id === activeBreakpoint)?.defaultPx ?? 992;
  const config = block.config as Record<string, unknown>;
  const configBreakpoints = (config.configBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpConfigRaw = isNonDesktop ? (configBreakpoints[activeBreakpoint] ?? {}) : {};

  const writeBpConfig = (patch: Record<string, unknown>) => {
    const current = configBreakpoints[activeBreakpoint] ?? {};
    onChange({
      configBreakpoints: {
        ...configBreakpoints,
        [activeBreakpoint]: { ...current, _px: bpDefaultPx, ...patch },
      },
    });
  };

  // Effective per-breakpoint reads — bp override falls back to base.
  const baseDropCap = !!config.dropCap;
  const baseColumns = (config.columns as string) ?? "1";
  const baseColumnsCustom = config.columnsCustom as number | undefined;
  const baseColumnsGap = (config.columnsGap as string) ?? "0px";
  const eff = isNonDesktop ? { ...config, ...bpConfigRaw } : config;
  const effDropCap = !!eff.dropCap;
  const effColumns = (eff.columns as string) ?? "1";
  const effColumnsCustom = eff.columnsCustom as number | undefined;
  const effColumnsGap = (eff.columnsGap as string) ?? "0px";

  const setKey = (key: string, val: unknown) => {
    if (isNonDesktop) writeBpConfig({ [key]: val });
    else onChange({ [key]: val });
  };

  const dropCapDirty = isNonDesktop
    ? bpConfigRaw.dropCap !== undefined
    : baseDropCap;
  const columnsDirty = isNonDesktop
    ? bpConfigRaw.columns !== undefined || bpConfigRaw.columnsCustom !== undefined
    : baseColumns !== "1" || baseColumnsCustom !== undefined;
  const columnsGapDirty = isNonDesktop
    ? bpConfigRaw.columnsGap !== undefined
    : !!baseColumnsGap && baseColumnsGap !== "0px";

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  return (
    <>
      {/* Drop Cap toggle (bp-aware) */}
      <FieldGroup
        isDirty={dropCapDirty}
        onReset={() => {
          if (isNonDesktop) writeBpConfig({ dropCap: undefined });
          else onChange({ dropCap: false });
        }}
      >
        <div className="epx-side-input">
          <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">Drop Cap</span>
          {breakpointIndicator}
          <label className="epx-toggle" style={{ marginLeft: "auto", paddingRight: 8 }}>
            <input
              type="checkbox"
              checked={effDropCap}
              onChange={(e) => setKey("dropCap", e.target.checked)}
            />
            <span className="epx-toggle__track"><span className="epx-toggle__thumb" /></span>
          </label>
        </div>
      </FieldGroup>

      {/* Columns dropdown + inline custom input (bp-aware), scrubable label. */}
      <FieldGroup
        isDirty={columnsDirty}
        onReset={() => {
          if (isNonDesktop) writeBpConfig({ columns: undefined, columnsCustom: undefined });
          else onChange({ columns: "1", columnsCustom: undefined });
        }}
      >
        <SelectRow
          label="Columns"
          value={effColumns}
          onChange={(v) => setKey("columns", v)}
          options={[
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            {
              value: "custom",
              label: (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
          ]}
          labelClassName="epx-row-label--section"
          labelSuffix={breakpointIndicator}
          onLabelMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startCount = effColumns === "custom"
              ? (effColumnsCustom ?? 1)
              : Number(effColumns) || 1;
            document.body.style.cursor = "ew-resize";
            document.body.style.userSelect = "none";
            const onMove = (ev: MouseEvent) => {
              // 8px drag = 1 column step.
              const next = Math.max(1, Math.round(startCount + (ev.clientX - startX) / 8));
              if (next <= 3) {
                const v = String(next);
                setKey("columns", v);
                // Clear custom when going back to preset.
                if (effColumnsCustom !== undefined) setKey("columnsCustom", undefined);
              } else {
                setKey("columns", "custom");
                setKey("columnsCustom", next);
              }
            };
            const onUp = () => {
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          leftAddon={effColumns === "custom" ? (
            <input
              type="number"
              className="epx-side-input__num"
              min={2}
              step={1}
              value={effColumnsCustom ?? ""}
              placeholder="4"
              onChange={(e) => {
                const raw = e.target.value;
                setKey("columnsCustom", raw === "" ? undefined : Number(raw));
              }}
            />
          ) : null}
        />
      </FieldGroup>

      {/* Columns Gap (bp-aware) — inline SideInput to use a single FieldGroup wrapper. */}
      <FieldGroup
        isDirty={columnsGapDirty}
        onReset={() => {
          if (isNonDesktop) writeBpConfig({ columnsGap: undefined });
          else onChange({ columnsGap: "0px" });
        }}
      >
        <SideInput
          sideKey=""
          labelOverride="Columns Gap"
          value={parseSide(effColumnsGap)}
          onChange={(next) => {
            const isEmpty = next.num === 0 && next.unit === "px";
            setKey("columnsGap", isEmpty ? "" : serializeSide(next));
          }}
          units={["px", "rem", "em", "%"]}
          labelSuffix={breakpointIndicator}
        />
      </FieldGroup>
    </>
  );
}
