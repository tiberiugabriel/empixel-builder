import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";
import type { BlockType, BreakpointsConfig } from "../types.js";
import { BREAKPOINT_DEFS } from "../types.js";
import { NumberRow } from "./controls/FieldRow.js";

interface Props {
  onAddBlock: (type: BlockType) => void;
  breakpointsConfig: BreakpointsConfig;
  onBreakpointsChange: (c: BreakpointsConfig) => void;
}

function IconBlocks() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
      <path d="m22,13.25v-2.5l-2.318-.966c-.167-.581-.395-1.135-.682-1.654l.954-2.318-1.768-1.768-2.318.954c-.518-.287-1.073-.515-1.654-.682l-.966-2.318h-2.5l-.966,2.318c-.581.167-1.135.395-1.654.682l-2.318-.954-1.768,1.768.954,2.318c-.287.518-.515,1.073-.682,1.654l-2.318.966v2.5l2.318.966c.167.581.395,1.135.682,1.654l-.954,2.318,1.768,1.768,2.318-.954c.518.287,1.073.515,1.654.682l.966,2.318h2.5l.966-2.318c.581-.167,1.135-.395,1.654-.682l2.318.954,1.768-1.768-.954-2.318c.287-.518.515-1.073.682-1.654l2.318-.966Z" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
    </svg>
  );
}

function DraggableBlockCard({
  def,
  onAddBlock,
}: {
  def: (typeof BLOCK_DEFINITIONS)[number];
  onAddBlock: (type: BlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-${def.type}`,
    data: { kind: "new-block", blockType: def.type },
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="epx-block-card"
      onClick={() => onAddBlock(def.type)}
      title={def.description}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: isDragging ? "grabbing" : "grab" }}
      type="button"
    >
      <span className="epx-block-card__icon">{def.icon}</span>
      <span className="epx-block-card__label">{def.label}</span>
    </button>
  );
}

type Tab = "blocks" | "page";

export function LeftPanel({ onAddBlock, breakpointsConfig, onBreakpointsChange }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("blocks");

  const TABS: { id: Tab; icon: React.ReactNode; title: string }[] = [
    { id: "blocks", icon: <IconBlocks />, title: "Blocks" },
    { id: "page", icon: <IconSettings />, title: "Settings" },
  ];

  const toggleBreakpoint = (id: string, checked: boolean) => {
    const enabled = checked
      ? [...breakpointsConfig.enabled, id as typeof breakpointsConfig.enabled[number]]
      : breakpointsConfig.enabled.filter((e) => e !== id);
    onBreakpointsChange({ ...breakpointsConfig, enabled });
  };

  const setBreakpointPx = (id: string, px: number | undefined, defaultPx: number) => {
    const value = px ?? defaultPx;
    const otherOverrides = breakpointsConfig.overrides.filter((o) => o.id !== id);
    const overrides = value === defaultPx
      ? otherOverrides
      : [...otherOverrides, { id: id as typeof breakpointsConfig.overrides[number]["id"], px: value }];
    onBreakpointsChange({ ...breakpointsConfig, overrides });
  };

  return (
    <aside className="epx-left-panel">
      <div className="epx-left-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`epx-left-panel__tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {activeTab === "blocks" && (
        <div className="epx-left-panel__list">
          {(["core", "general"] as const).map((cat) => {
            const defs = BLOCK_DEFINITIONS.filter((d) => d.category === cat);
            return (
              <div key={cat} className="epx-block-group">
                <span className="epx-block-group__label">{cat === "core" ? "Core" : "General"}</span>
                {defs.map((def) => (
                  <DraggableBlockCard key={def.type} def={def} onAddBlock={onAddBlock} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "page" && (
        <div className="epx-settings-panel">
          <div className="epx-settings-section">
            <span className="epx-settings-label">Breakpoints</span>
            <div className="epx-bp-toggles">
              {BREAKPOINT_DEFS.filter((d) => d.removable).map((def) => (
                <label key={def.id} className="epx-bp-toggle">
                  <input
                    type="checkbox"
                    checked={breakpointsConfig.enabled.includes(def.id)}
                    onChange={(e) => toggleBreakpoint(def.id, e.target.checked)}
                  />
                  {def.label}
                </label>
              ))}
            </div>
            <div className="epx-bp-values">
              {BREAKPOINT_DEFS
                .filter((d) => d.id !== "desktop" && breakpointsConfig.enabled.includes(d.id))
                .map((def) => {
                  const override = breakpointsConfig.overrides.find((o) => o.id === def.id);
                  const currentPx = override?.px ?? def.defaultPx!;
                  return (
                    <NumberRow
                      key={def.id}
                      label={def.label}
                      value={currentPx}
                      onChange={(v) => setBreakpointPx(def.id, v, def.defaultPx!)}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
