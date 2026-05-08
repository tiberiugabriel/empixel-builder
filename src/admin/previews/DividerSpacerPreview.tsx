import React, { memo } from "react";
import type { DividerConfig, DividerSpacerConfig, IconGroupValue, DividerGradient } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
}

function hexA(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
  const n = parseInt(full.padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function isPng(filename: string | undefined): boolean {
  return /\.png(\?|$)/i.test(filename ?? "");
}

function isSvg(filename: string | undefined): boolean {
  return /\.svg(\?|$)/i.test(filename ?? "");
}

function parsePxNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = raw.match(/^([\d.]+)\s*(px|rem|em)?$/i);
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  if (isNaN(n)) return fallback;
  const unit = (m[2] || "px").toLowerCase();
  if (unit === "rem" || unit === "em") return n * 16;
  return n;
}

function buildLineStyle(divider: DividerConfig, isVertical: boolean): React.CSSProperties {
  const lineColorRaw = divider.color || "#000000";
  const lineAlpha = divider.colorAlpha ?? 1;
  const lineColorRgba = hexA(lineColorRaw, lineAlpha);
  const lineWidth = divider.width || "1px";
  const lineLength = divider.length || "100%";
  const dividerStyle = divider.style ?? "solid";

  const sizing: React.CSSProperties = isVertical
    ? { width: lineLength, maxWidth: "100%", flex: "0 0 auto" }
    : { flex: 1, maxWidth: lineLength };

  const strokePx = Math.max(0.5, parsePxNumber(lineWidth, 1.5));
  const patternHeight = Math.max(8, Math.ceil(strokePx * 5));

  if (dividerStyle === "wavy") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 6' preserveAspectRatio='none'><path d='M0 3 Q 5 0 10 3 T 20 3' stroke='${lineColorRgba}' fill='none' stroke-width='${strokePx}' stroke-linecap='round'/></svg>`;
    return {
      ...sizing,
      height: patternHeight,
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "repeat-x",
      backgroundPosition: "center",
      backgroundSize: `${patternHeight * 3}px 100%`,
    };
  }
  if (dividerStyle === "zigzag") {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 6' preserveAspectRatio='none'><polyline points='0,5 5,1 10,5 15,1 20,5' stroke='${lineColorRgba}' fill='none' stroke-width='${strokePx}' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
    return {
      ...sizing,
      height: patternHeight,
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "repeat-x",
      backgroundPosition: "center",
      backgroundSize: `${patternHeight * 3}px 100%`,
    };
  }
  if (dividerStyle === "gradient") {
    const grad = (divider.gradient ?? {}) as DividerGradient;
    const cssAngle = (((grad.angle ?? 0) + 180) % 360);
    const stops = grad.stops && grad.stops.length >= 2
      ? [...grad.stops].sort((a, b) => a.pos - b.pos).map((s) => `${hexA(s.color, s.alpha)} ${s.pos}%`).join(",")
      : `${lineColorRgba} 0%, transparent 100%`;
    return {
      ...sizing,
      height: lineWidth,
      background: `linear-gradient(${cssAngle}deg, ${stops})`,
    };
  }
  // solid/dashed/dotted/double/groove/ridge
  return {
    ...sizing,
    height: 0,
    borderTop: `${lineWidth} ${dividerStyle} ${lineColorRgba}`,
  };
}

export const DividerSpacerPreview = memo(function DividerSpacerPreview({ config }: PreviewProps) {
  const c = config as unknown as DividerSpacerConfig;
  const space = c.space || "48px";
  const divider = (c.divider ?? {}) as DividerConfig;
  const dividerActive = divider.style && divider.style !== "none";
  const icon = (divider.icon ?? {}) as IconGroupValue;
  const iconPos = icon.iconPosition ?? "center";
  const isVertical = iconPos === "above" || iconPos === "below";

  if (!dividerActive) {
    return <div style={{ height: space }} aria-hidden="true" />;
  }

  const wrapStyle: React.CSSProperties = {
    minHeight: space,
    display: "flex",
    flexDirection: isVertical ? "column" : "row",
    alignItems: "center",
    justifyContent: isVertical
      ? "center"
      : divider.align === "left" ? "flex-start" : divider.align === "right" ? "flex-end" : "center",
    gap: 8,
  };

  const lineStyle = buildLineStyle(divider, isVertical);

  const iconUrl = icon.iconSrc?.storageKey
    ? `/_emdash/api/media/file/${icon.iconSrc.storageKey}`
    : undefined;
  const iconSize = icon.iconSize || "20px";
  const iconColor = icon.iconColor;
  const iconColorAlpha = icon.iconColorAlpha ?? 1;
  const filename = icon.iconSrc?.filename;
  const renderAsSvgMask = iconUrl && isSvg(filename) && !!iconColor;

  const renderIcon = (key: string) => {
    if (!iconUrl) return null;
    if (renderAsSvgMask) {
      return (
        <span
          key={key}
          aria-label={icon.iconSrc?.alt ?? ""}
          role="img"
          style={{
            display: "inline-block",
            width: iconSize,
            height: iconSize,
            flex: "0 0 auto",
            backgroundColor: hexA(iconColor!, iconColorAlpha),
            WebkitMask: `url(${iconUrl}) no-repeat center/contain`,
            mask: `url(${iconUrl}) no-repeat center/contain`,
          }}
        />
      );
    }
    const pngOpacity = isPng(filename) && iconColorAlpha < 1 ? iconColorAlpha : undefined;
    return (
      <img
        key={key}
        src={iconUrl}
        alt={icon.iconSrc?.alt ?? ""}
        style={{ width: iconSize, height: iconSize, flex: "0 0 auto", opacity: pngOpacity }}
      />
    );
  };

  const Line = (key: string) => <div key={key} style={lineStyle} />;

  const renderInner = () => {
    if (!iconUrl) return Line("ln");
    if (iconPos === "left" || iconPos === "above") return [renderIcon("ic"), Line("ln")];
    if (iconPos === "right" || iconPos === "below") return [Line("ln"), renderIcon("ic")];
    return [Line("ln1"), renderIcon("ic"), Line("ln2")];
  };

  return <div style={wrapStyle}>{renderInner()}</div>;
});
