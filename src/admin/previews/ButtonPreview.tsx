import React, { memo } from "react";
import type { IconGroupValue } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
}

export const ButtonPreview = memo(function ButtonPreview({ config }: PreviewProps) {
  const text = (config.text as string) || "Click me";
  const icon = (config.icon as IconGroupValue) ?? {};
  const iconSrc = icon.iconSrc?.storageKey
    ? `/_emdash/api/media/file/${icon.iconSrc.storageKey}`
    : undefined;
  const pos = icon.iconPosition ?? "left";
  const style = (config.style ?? {}) as Record<string, string>;

  const isVertical = pos === "top" || pos === "bottom";

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: isVertical ? (pos === "top" ? "column" : "column-reverse") : (pos === "right" ? "row-reverse" : "row"),
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    background: style.backgroundColor || "#111827",
    color: style.color || "#ffffff",
    borderRadius: style.borderTopLeftRadius || "6px",
    fontSize: style.fontSize || "13px",
    fontWeight: (style.fontWeight as string) || "500",
    cursor: "pointer",
  };

  return (
    <button type="button" style={btnStyle}>
      {iconSrc && <img src={iconSrc} alt="" style={{ width: icon.iconSize || "16px", height: icon.iconSize || "16px" }} />}
      <span>{text}</span>
    </button>
  );
});
