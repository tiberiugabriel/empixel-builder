import type { BreakpointId, BreakpointDef } from "../../types.js";
import { BP_ICONS } from "./BreakpointIcons.js";

export function BreakpointSwitcher({
  breakpoints,
  active,
  onChange,
}: {
  breakpoints: BreakpointDef[];
  active: BreakpointId;
  onChange: (id: BreakpointId) => void;
}) {
  return (
    <div className="epx-bp-switcher">
      {breakpoints.map((bp) => (
        <button
          key={bp.id}
          type="button"
          className={`epx-bp-btn${active === bp.id ? " is-active" : ""}`}
          data-tooltip={bp.label + (bp.defaultPx ? ` (${bp.defaultPx}px)` : "")}
          onClick={() => onChange(bp.id)}
        >
          {BP_ICONS[bp.id]}
        </button>
      ))}
    </div>
  );
}
