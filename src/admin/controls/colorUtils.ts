/**
 * Shared admin-side color helpers. Lives outside `BackgroundControl` so
 * other admin modules (previews, RightPanel, etc.) can import without
 * pulling in the entire 950-LOC background editor (audit M3).
 *
 * Frontend rendering uses its own copy of these in
 * `src/components/styleUtils.ts` — those run in the Astro build and must
 * not depend on admin code.
 */

export interface GradientStop {
  color: string;
  alpha: number;
  pos: number;
}

export function hexToRgbVals(hex: string): [number, number, number] {
  const c    = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
  const n    = parseInt(full.padEnd(6, "0"), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbVals(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
