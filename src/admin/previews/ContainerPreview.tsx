import React, { memo } from "react";
import type { SectionBlock } from "../../types.js";
import { hexToRgbVals, hexToRgba, type GradientStop } from "../controls/colorUtils.js";

function getBgStyle(style: Record<string, unknown>): React.CSSProperties {
  const type = style.backgroundType as string | undefined;
  if (!type) return {};

  if (type === "color") {
    const color = (style.backgroundColor as string) ?? "#ffffff";
    const alpha = (style.backgroundColorAlpha as number) ?? 1;
    return { background: hexToRgba(color, alpha) };
  }

  if (type === "gradient") {
    const angle = (style.backgroundGradAngle as number) ?? 135;
    let stops: GradientStop[] = [];
    try { stops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); } catch { /**/ }
    if (stops.length < 2) return {};
    const parts = [...stops]
      .sort((a, b) => a.pos - b.pos)
      .map(s => `rgba(${hexToRgbVals(s.color).join(",")},${s.alpha}) ${s.pos}%`)
      .join(",");
    return { background: `linear-gradient(${angle}deg, ${parts})` };
  }

  if (type === "image") {
    const key = style.backgroundImageStorageKey as string | undefined;
    if (!key) return {};
    return {
      backgroundImage: `url(/_emdash/api/media/file/${key})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  if (type === "video") return { background: "#0f172a" };
  if (type === "slideshow") {
    let slides: Array<{ storageKey?: string }> = [];
    try { slides = JSON.parse((style.backgroundSlides as string) ?? "[]"); } catch { /**/ }
    const first = slides[0];
    if (first?.storageKey) {
      return {
        backgroundImage: `url(/_emdash/api/media/file/${first.storageKey})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { background: "#1e293b" };
  }

  return {};
}

export const ContainerPreview = memo(function ContainerPreview({ config, children }: {
  config: Record<string, unknown>;
  children?: SectionBlock[];
}) {
  const style = (config.style ?? {}) as Record<string, unknown>;
  const bg = getBgStyle(style);
  const count = children?.length ?? 0;

  return (
    <div style={{ ...bg, border: "2px dashed #93c5fd", borderRadius: 6, padding: "12px", minHeight: 48 }}>
      <div style={{ fontSize: 10, color: "#93c5fd", fontWeight: 600, marginBottom: count > 0 ? 8 : 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Container
      </div>
      {count > 0 ? (
        <div style={{ fontSize: 11, color: "#888" }}>{count} block{count !== 1 ? "s" : ""} inside</div>
      ) : (
        <div style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>Drop blocks here</div>
      )}
    </div>
  );
});
