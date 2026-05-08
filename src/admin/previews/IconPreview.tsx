import React, { memo } from "react";
import type { IconGroupValue } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
}

export const IconPreview = memo(function IconPreview({ config }: PreviewProps) {
  const icon = (config.icon as IconGroupValue) ?? {};
  const iconSrc = icon.iconSrc?.storageKey
    ? `/_emdash/api/media/file/${icon.iconSrc.storageKey}`
    : undefined;
  const size = icon.iconSize || (config.style as Record<string, string> | undefined)?.iconBlockSize || "32px";
  const rotate = (config.rotate as string) || "";
  const style = (config.style ?? {}) as Record<string, string>;
  const align = (style.textAlign as string) || "left";
  const colorVal = (style.iconColor as string) || icon.iconColor;

  const wrapStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: align === "center" ? "center" : align === "right" || align === "end" ? "flex-end" : "flex-start",
  };
  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    transform: rotate ? `rotate(${rotate})` : undefined,
    color: colorVal,
  };

  if (!iconSrc) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Icon block</span>;
  }

  return (
    <div style={wrapStyle}>
      <img src={iconSrc} alt={icon.iconSrc?.alt ?? ""} style={imgStyle} />
    </div>
  );
});
