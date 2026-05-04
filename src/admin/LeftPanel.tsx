import React, { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_DEFINITIONS } from "./blockDefinitions.js";
import type { BlockType, BreakpointsConfig, BreakpointDef } from "../types.js";
import { BREAKPOINT_DEFS, DEFAULT_BREAKPOINTS_CONFIG } from "../types.js";
import { IconReset } from "./controls/SpacingControl.js";

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

function BpRow({ def, currentPx, isEnabled, onToggle, onChangePx }: {
  def: BreakpointDef;
  currentPx: number;
  isEnabled: boolean;
  onToggle?: (checked: boolean) => void;
  onChangePx: (v: number) => void;
}) {
  const handleScrub = (e: React.MouseEvent) => {
    if (!isEnabled) return;
    e.preventDefault();
    const startX = e.clientX;
    const startPx = currentPx;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => onChangePx(Math.round(startPx + (ev.clientX - startX) / 2));
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="epx-bp-row">
      <div className="epx-bp-row__label" onMouseDown={handleScrub} title={isEnabled ? "Drag to adjust" : undefined}>
        {def.removable ? (
          <label className="epx-bp-row__check-wrap" onMouseDown={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              className="epx-bp-row__check"
              checked={isEnabled}
              onChange={(e) => onToggle?.(e.target.checked)}
            />
          </label>
        ) : (
          <span className="epx-bp-row__check-spacer" />
        )}
        <span className="epx-bp-row__name">{def.label}</span>
      </div>
      <input
        type="number"
        className="epx-side-input__num"
        value={currentPx}
        step={1}
        disabled={!isEnabled}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChangePx(n);
        }}
      />
    </div>
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

  const setBreakpointPx = (id: string, px: number, defaultPx: number) => {
    const otherOverrides = breakpointsConfig.overrides.filter((o) => o.id !== id);
    const overrides = px === defaultPx
      ? otherOverrides
      : [...otherOverrides, { id: id as typeof breakpointsConfig.overrides[number]["id"], px }];
    onBreakpointsChange({ ...breakpointsConfig, overrides });
  };

  const resetBreakpoints = () => onBreakpointsChange(DEFAULT_BREAKPOINTS_CONFIG);

  const isBreakpointsDirty =
    breakpointsConfig.overrides.length > 0 ||
    breakpointsConfig.enabled.slice().sort().join(",") !==
      DEFAULT_BREAKPOINTS_CONFIG.enabled.slice().sort().join(",");

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
          <div className="epx-bg-ctrl__card" style={{ containerType: "inline-size" } as React.CSSProperties}>
            <div className="epx-settings-label">
              <span>Breakpoints</span>
              {isBreakpointsDirty && (
                <button type="button" className="epx-settings-reset-btn" onClick={resetBreakpoints} title="Reset to defaults">
                  <IconReset />
                </button>
              )}
            </div>
            {BREAKPOINT_DEFS.filter((d) => d.id !== "desktop").map((def) => {
              const isEnabled = breakpointsConfig.enabled.includes(def.id);
              const override = breakpointsConfig.overrides.find((o) => o.id === def.id);
              const currentPx = override?.px ?? def.defaultPx!;
              return (
                <BpRow
                  key={def.id}
                  def={def}
                  currentPx={currentPx}
                  isEnabled={isEnabled}
                  onToggle={def.removable ? (checked) => toggleBreakpoint(def.id, checked) : undefined}
                  onChangePx={(px) => setBreakpointPx(def.id, px, def.defaultPx!)}
                />
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
