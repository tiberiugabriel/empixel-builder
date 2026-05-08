// Local types shared across the RightPanel and its per-block sub-panels.
// Extracted from RightPanel.tsx (audit M1, conservative slice). Keep here
// rather than in `src/types.ts` because they're admin-UI-only — frontend
// rendering reads `config.advanced` via the open `Record<string, unknown>`
// surface in `BaseBlockConfig`.

export type AdvancedConfig = {
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number | string;
  cssId?: string;
  cssClasses?: string;
  customCss?: string;
};
