import React, { memo } from "react";

const RESOLUTION_DIMS: Record<string, { w: number; h: number }> = {
  thumbnail: { w: 150, h: 150 },
  medium:    { w: 300, h: 300 },
  large:     { w: 1024, h: 1024 },
};

const ALIGN_TO_JUSTIFY: Record<string, React.CSSProperties["justifyContent"]> = {
  start:  "flex-start",
  center: "center",
  end:    "flex-end",
};

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map(x => x + x).join("") : c.slice(0, 6);
  const n = parseInt(full.padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function buildImgVisualReactStyle(style: Record<string, unknown>): React.CSSProperties {
  const out: React.CSSProperties = {};

  const borderSt = (style.borderStyle as string) || "";
  if (borderSt && borderSt !== "none") {
    out.borderStyle = borderSt;
    const color = (style.borderColor as string) || "#000000";
    const alpha = typeof style.borderAlpha === "number" ? style.borderAlpha : 1;
    out.borderColor = alpha < 1 ? hexToRgba(color, alpha) : color;
  }
  if (style.borderTopLeftRadius)     out.borderTopLeftRadius     = style.borderTopLeftRadius     as string;
  if (style.borderTopRightRadius)    out.borderTopRightRadius    = style.borderTopRightRadius    as string;
  if (style.borderBottomRightRadius) out.borderBottomRightRadius = style.borderBottomRightRadius as string;
  if (style.borderBottomLeftRadius)  out.borderBottomLeftRadius  = style.borderBottomLeftRadius  as string;
  if (style.borderTopWidth)    out.borderTopWidth    = style.borderTopWidth    as string;
  if (style.borderRightWidth)  out.borderRightWidth  = style.borderRightWidth  as string;
  if (style.borderBottomWidth) out.borderBottomWidth = style.borderBottomWidth as string;
  if (style.borderLeftWidth)   out.borderLeftWidth   = style.borderLeftWidth   as string;

  if (style.shadowX || style.shadowY || style.shadowBlur || style.shadowSpread) {
    const sc = typeof style.shadowColor === "string" ? style.shadowColor : "#000000";
    const sa = typeof style.shadowAlpha === "number" ? style.shadowAlpha : 1;
    const inset = style.shadowType === "inset" ? "inset " : "";
    const sx = (style.shadowX as string) || "0px";
    const sy = (style.shadowY as string) || "0px";
    const sb = (style.shadowBlur as string) || "0px";
    const ss = (style.shadowSpread as string) || "0px";
    out.boxShadow = `${inset}${sx} ${sy} ${sb} ${ss} ${hexToRgba(sc, sa)}`;
  }

  return out;
}

export const ImagePreview = memo(function ImagePreview({ config }: { config: Record<string, unknown> }) {
  const image = config.image as { storageKey?: string; alt?: string; filename?: string } | undefined;
  const resolution = (config.resolution as string) || "full";
  const caption = (config.caption as string) || "";

  if (!image?.storageKey) {
    return (
      <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Image block</span>
    );
  }

  const dims = RESOLUTION_DIMS[resolution];

  const imgStyleCfg = (config.imgStyle ?? {}) as Record<string, string | undefined>;
  const styleCfg    = (config.style    ?? {}) as Record<string, unknown>;

  // Visual styles (border / radius / shadow) target the <img> for image blocks
  const visualStyle = buildImgVisualReactStyle(styleCfg);

  const imgInline: React.CSSProperties = { ...visualStyle };
  if (imgStyleCfg.width)          imgInline.width          = imgStyleCfg.width;
  if (imgStyleCfg.minWidth)       imgInline.minWidth       = imgStyleCfg.minWidth;
  if (imgStyleCfg.maxWidth)       imgInline.maxWidth       = imgStyleCfg.maxWidth;
  if (imgStyleCfg.height)         imgInline.height         = imgStyleCfg.height;
  if (imgStyleCfg.minHeight)      imgInline.minHeight      = imgStyleCfg.minHeight;
  if (imgStyleCfg.maxHeight)      imgInline.maxHeight      = imgStyleCfg.maxHeight;
  if (imgStyleCfg.objectFit)      imgInline.objectFit      = imgStyleCfg.objectFit as React.CSSProperties["objectFit"];
  if (imgStyleCfg.objectPosition) imgInline.objectPosition = imgStyleCfg.objectPosition;

  // Resolution attrs (used as fallback if no inline width/height set)
  if (!imgInline.width  && dims) imgInline.width  = dims.w;
  if (!imgInline.height && dims) imgInline.height = dims.h;
  if (!imgInline.maxWidth)        imgInline.maxWidth = "100%";

  const justify = ALIGN_TO_JUSTIFY[((styleCfg.textAlign as string) || "").trim()];
  const frameStyle: React.CSSProperties = justify
    ? { display: "flex", justifyContent: justify }
    : {};

  return (
    <figure style={{ margin: 0 }}>
      <div className="epx-img-frame" style={frameStyle}>
        <img
          src={`/_emdash/api/media/file/${image.storageKey}`}
          alt={image.alt ?? image.filename ?? ""}
          style={imgInline}
        />
      </div>
      {caption && (
        <figcaption style={{ fontSize: 12, color: "#666", whiteSpace: "pre-wrap", marginTop: 4 }}>{caption}</figcaption>
      )}
    </figure>
  );
});
