import { useEffect } from "react";
import type { ReactNode } from "react";
import type { BreakpointId, SectionBlock } from "../../types.js";
import { getBlockDef } from "../blockDefinitions.js";
import { FieldRenderer } from "../fields/FieldRenderer.js";
import { SectionRenderer } from "./SectionRenderer.js";
import { AdvancedTab } from "./AdvancedTab.js";
import { IconFields, IconStyle, IconAdvanced } from "./icons.js";

/**
 * Tab shell for the new declarative right-panel path (F3.5.4). Replaces
 * the hardcoded `html`-only branch in `RightPanel.tsx` that toggled
 * Style off. Tab visibility derives from `BlockDef`:
 *
 * - Fields: visible when `fieldsTab` (or back-compat `fields`) is set.
 * - Style: visible when `styleTab` is non-empty. Hidden for `html` and
 *   for any block whose def is missing.
 * - Advanced: always visible (universal CSS ID / classes / custom CSS /
 *   position / z-index controls).
 *
 * F3.5.5 wires in the real `<AdvancedTab />`; F3.5.6 swaps
 * `RightPanel.tsx`.
 */

export type Tab = "fields" | "style" | "advanced";

export interface TabDef {
  id: Tab;
  icon: ReactNode;
  title: string;
}

const TAB_META: Record<Tab, { title: string; icon: () => ReactNode }> = {
  fields:   { title: "Fields",   icon: () => <IconFields /> },
  style:    { title: "Style",    icon: () => <IconStyle /> },
  advanced: { title: "Advanced", icon: () => <IconAdvanced /> },
};

/**
 * Visible tab set for a block, in UI order (Fields, Style, Advanced).
 * Fields renders even when its array is empty — `container` / `video`
 * still keep block-specific Fields content in the legacy imperative
 * branches until F3.5.6 introduces a Fields-tab `kind: "custom"` hook.
 * Unknown block types fall back to `["fields", "advanced"]` so the
 * panel can render a placeholder without losing universal controls.
 */
export function getVisibleTabs(block: SectionBlock): Tab[] {
  const def = getBlockDef(block.type);
  const out: Tab[] = [];
  if (def) {
    const fields = def.fieldsTab ?? def.fields;
    if (Array.isArray(fields)) out.push("fields");
    if (Array.isArray(def.styleTab) && def.styleTab.length > 0) out.push("style");
  } else {
    out.push("fields");
  }
  out.push("advanced");
  return out;
}

/**
 * Snap `activeTab` to a valid tab when the underlying block type
 * changes. F3.5.6 imports this from `RightPanel.tsx` (one-line swap).
 * Depends only on `block.type`, not on every config edit.
 */
export function useAutoSelectTab(
  block: SectionBlock | null,
  activeTab: Tab,
  setActiveTab: (tab: Tab) => void,
): void {
  const blockType = block?.type;
  useEffect(() => {
    if (!block) return;
    const visible = getVisibleTabs(block);
    if (!visible.includes(activeTab) && visible.length > 0) {
      setActiveTab(visible[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockType]);
}

export interface TabRendererProps {
  block: SectionBlock;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}

export function TabRenderer(props: TabRendererProps): ReactNode {
  const { block, activeTab, onTabChange, onChange, activeBreakpoint } = props;
  const def = getBlockDef(block.type);
  const visible = getVisibleTabs(block);
  const tabs: TabDef[] = visible.map((id) => ({
    id,
    icon: TAB_META[id].icon(),
    title: TAB_META[id].title,
  }));

  return (
    <>
      <div className="epx-right-panel__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`epx-right-panel__tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            title={tab.title}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {activeTab === "fields" && (
        <div className="epx-right-panel__fields">
          {(def?.fieldsTab ?? def?.fields ?? [])
            .filter((field) => !field.showWhen || block.config[field.showWhen.key] === field.showWhen.value)
            .map((field) => {
              if (field.kind === "custom") {
                return (
                  <FieldRenderer
                    key={field.key}
                    field={field}
                    value={undefined}
                    onChange={() => {}}
                    customCtx={{ block, panelOnChange: onChange, activeBreakpoint }}
                  />
                );
              }
              const defaultVal = def?.defaultConfig?.[field.key];
              const currentVal = block.config[field.key];
              const isDirty = JSON.stringify(currentVal) !== JSON.stringify(defaultVal);
              return (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={currentVal}
                  isDirty={isDirty}
                  onChange={(val) => onChange({ [field.key]: val })}
                />
              );
            })}
        </div>
      )}

      {activeTab === "style" && def?.styleTab && (
        <div className="epx-right-panel__style">
          {def.styleTab.map((section, idx) => (
            <SectionRenderer
              key={`${section.kind}-${idx}`}
              section={section}
              block={block}
              onChange={onChange}
              activeBreakpoint={activeBreakpoint}
            />
          ))}
        </div>
      )}

      {activeTab === "advanced" && (
        <AdvancedTab
          block={block}
          onChange={onChange}
          activeBreakpoint={activeBreakpoint}
        />
      )}
    </>
  );
}
