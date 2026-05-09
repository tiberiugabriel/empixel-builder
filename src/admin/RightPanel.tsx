import { useState } from "react";
import type { SectionBlock, BreakpointId, BreakpointsConfig } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { TabRenderer, getVisibleTabs, useAutoSelectTab, type Tab } from "./right-panel/TabRenderer.js";
import type { AdvancedConfig } from "./right-panel/types.js";

/**
 * RightPanel — block-settings sidebar.
 *
 * F3.5.6 — rewritten on top of the declarative `BlockDef.fieldsTab` /
 * `styleTab` pipeline shipped in F3.5.1—F3.5.5. Every per-block
 * imperative branch (9 across Fields and Style tabs) is gone; tab
 * visibility is driven by `getVisibleTabs(block)`. The body dispatches
 * through `<TabRenderer />` which itself delegates to:
 *
 * - Fields tab → `<FieldRenderer />` (per-FieldDef dispatch — including
 *   `kind: "custom"` for the bespoke container / video / etc. content).
 * - Style tab  → `<SectionRenderer />` (per-`StyleSection.kind` dispatch).
 * - Advanced   → universal `<AdvancedTab />` (one component for all blocks).
 *
 * `RightPanel.tsx` is now a thin shell: header + description, panel
 * frame, the unknown-block placeholder for orphan rows, and the tab
 * shell wired to `<TabRenderer />`. State that the legacy panel kept
 * here (state-toggle modes, picker open flags, divider gradient editor
 * cursor positions, etc.) is now owned by the matching section
 * components. `breakpointsConfig` is no longer needed at this level —
 * the bp-aware sections fall back to `BREAKPOINT_DEFS` defaults; if a
 * future change wants host-customised breakpoints to flow through, it
 * can extend `SectionRenderProps` / `FieldRenderProps`.
 */

interface Props {
  block: SectionBlock | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
  /**
   * Reserved for future use — the declarative pipeline currently
   * resolves per-breakpoint default px values via `BREAKPOINT_DEFS` in
   * each section. Kept on the props so existing callers compile and
   * can pass in host overrides once the pipeline threads them through.
   */
  breakpointsConfig?: BreakpointsConfig;
}

/**
 * Minimal panel frame for blocks that don't have a registered
 * `BlockDef`. Surfaces enough Advanced-style controls (CSS ID + Classes)
 * so the user can recover from a hand-edited DB / removed block type
 * without losing data, plus a delete affordance via the canvas right-
 * click menu (handled outside this component).
 */
function UnknownBlockPanel({ block, onChange }: {
  block: SectionBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
}) {
  const adv = (block.config.advanced ?? {}) as AdvancedConfig;
  const writeAdv = (patch: Partial<AdvancedConfig>) =>
    onChange({ advanced: { ...adv, ...patch } });
  return (
    <aside className="epx-right-panel">
      <header className="epx-right-panel__header">
        <span className="epx-right-panel__title">Unknown block</span>
      </header>
      <div className="epx-right-panel__body">
        <div className="epx-field" style={{ padding: "10px 12px", fontSize: 12, lineHeight: 1.4, color: "var(--epx-text-muted)" }}>
          <strong style={{ color: "var(--epx-text)" }}>Type: <code>{block.type}</code></strong>
          <p style={{ margin: "6px 0 0" }}>
            No registered <code>BlockDef</code> matches this type. The block may
            have been removed in a later release or the JSON is corrupted.
            Right-click the block on the canvas to delete it. Advanced
            attributes below still work.
          </p>
        </div>
        <div className="epx-panel-divider" />
        <div className="epx-field">
          <label className="epx-field__label" htmlFor="adv-cssid">CSS ID</label>
          <input
            id="adv-cssid"
            type="text"
            className="epx-field__input"
            value={adv.cssId ?? ""}
            onChange={(e) => writeAdv({ cssId: e.target.value })}
          />
        </div>
        <div className="epx-field">
          <label className="epx-field__label" htmlFor="adv-cssclasses">CSS Classes</label>
          <input
            id="adv-cssclasses"
            type="text"
            className="epx-field__input"
            value={adv.cssClasses ?? ""}
            onChange={(e) => writeAdv({ cssClasses: e.target.value })}
          />
        </div>
      </div>
    </aside>
  );
}

export function RightPanel({ block, onChange, activeBreakpoint }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("fields");

  // Snap the active tab back to the first visible tab when the block
  // type changes (e.g. selecting an `html` block while Style was
  // active). Replaces the legacy two-line gate that hid the Style tab
  // for `html` and forced the active tab back to Fields.
  useAutoSelectTab(block, activeTab, setActiveTab);

  if (!block) {
    return (
      <aside className="epx-right-panel epx-right-panel--empty">
        <div className="epx-right-panel__placeholder">
          <div className="epx-right-panel__placeholder-icon">👈</div>
          <p>Select a block on the canvas to edit its settings</p>
        </div>
      </aside>
    );
  }

  const def = getBlockDef(block.type);
  if (!def) {
    return <UnknownBlockPanel block={block} onChange={onChange} />;
  }

  // Derive visible tab set early — same source the TabRenderer uses,
  // so we can fall through to the first visible tab if the persisted
  // state is stale (e.g. switching from a Fields-Style-Advanced block
  // to an `html` block while Style was active and the auto-select
  // hook hasn't fired yet on the very first render).
  const visible = getVisibleTabs(block);
  const effectiveTab: Tab = visible.includes(activeTab) ? activeTab : (visible[0] ?? "advanced");

  return (
    <aside className="epx-right-panel">
      <div className="epx-right-panel__header">
        <span className="epx-right-panel__icon">{def.icon}</span>
        <h2 className="epx-right-panel__title">{def.label}</h2>
      </div>
      <p className="epx-right-panel__description">{def.description}</p>

      <TabRenderer
        block={block}
        activeTab={effectiveTab}
        onTabChange={setActiveTab}
        onChange={onChange}
        activeBreakpoint={activeBreakpoint}
      />
    </aside>
  );
}

/**
 * Re-exported so existing callers (`Canvas.tsx`, `BuilderStyles.tsx`,
 * etc.) that imported `<PanelDivider />` from `RightPanel` keep
 * compiling. Identical markup to the inline span the panel used.
 */
export function PanelDivider() {
  return <div className="epx-panel-divider" />;
}
