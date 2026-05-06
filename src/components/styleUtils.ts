type GradStop = { color: string; alpha: number; pos: number };

function getEffectiveStyle(config: Record<string, unknown>): Record<string, unknown> {
  const style = (config.style ?? {}) as Record<string, unknown>;
  if ((config.theme as string) === "dark") {
    const styleDark = (config.styleDark ?? {}) as Record<string, unknown>;
    return { ...style, ...styleDark };
  }
  return style;
}

function hexToRgba(hex: string, alpha: number): string {
  const c    = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map(x => x + x).join("") : c.slice(0, 6);
  const n    = parseInt(full.padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function camelToKebab(s: string): string {
  return s.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`);
}

function cssStr(v: unknown): string {
  if (typeof v !== "string" || !v.trim()) return "";
  const t = v.trim();
  if (t.startsWith("@@")) return t.slice(2); // custom CSS value marker
  return t;
}

// ─── Background ───────────────────────────────────────────────────────────────

export function buildBackgroundCss(style: Record<string, unknown>): string {
  const type = style.backgroundType as string | undefined;
  if (!type) return "";

  if (type === "color") {
    const color = (style.backgroundColor as string) ?? "#ffffff";
    const alpha = (style.backgroundColorAlpha as number) ?? 1;
    return `background:${hexToRgba(color, alpha)};`;
  }

  if (type === "gradient") {
    const angle = (style.backgroundGradAngle as number) ?? 135;
    let stops: GradStop[] = [];
    try { stops = JSON.parse((style.backgroundGradStops as string) ?? "[]"); } catch { /**/ }
    if (stops.length < 2) return "";
    const parts = [...stops]
      .sort((a, b) => a.pos - b.pos)
      .map(s => `${hexToRgba(s.color, s.alpha)} ${s.pos}%`)
      .join(",");
    return `background:linear-gradient(${angle}deg,${parts});`;
  }

  if (type === "image") {
    const src    = style.backgroundImageSrc as string | undefined;
    const imgUrl = src === "url"
      ? (style.backgroundImageUrl as string | undefined)
      : (() => { const k = style.backgroundImageStorageKey as string | undefined; return k ? `/_emdash/api/media/file/${k}` : undefined; })();
    if (!imgUrl) return "";
    const size       = (style.backgroundImageSize       as string) || "cover";
    const position   = (style.backgroundImagePosition   as string) || "center";
    const repeat     = (style.backgroundImageRepeat     as string) || "no-repeat";
    const attachment = (style.backgroundImageAttachment as string) || "";
    return [
      `background-image:url(${imgUrl})`,
      `background-size:${size}`,
      `background-position:${position}`,
      `background-repeat:${repeat}`,
      ...(attachment && attachment !== "scroll" ? [`background-attachment:${attachment}`] : []),
    ].join(";") + ";";
  }

  if (type === "slideshow") {
    let slides: Array<{ storageKey?: string }> = [];
    try { slides = JSON.parse((style.backgroundSlides as string) ?? "[]"); } catch { /**/ }
    const first = slides[0];
    if (first?.storageKey)
      return `background:url(/_emdash/api/media/file/${first.storageKey}) center/cover no-repeat;`;
  }

  // video: handled via <video> element overlay — no CSS background
  return "";
}

// ─── Full inline style string ─────────────────────────────────────────────────

const STYLE_PROPS = [
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop",  "marginRight",  "marginBottom",  "marginLeft",
  "width", "minWidth", "maxWidth", "height", "minHeight", "maxHeight",
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "overflowX", "overflowY",
  "textAlign",
  "fontFamily", "fontSize", "fontWeight",
  "textTransform", "fontStyle", "textDecoration",
  "lineHeight", "letterSpacing", "wordSpacing",
  "mixBlendMode",
] as const;

// Visual props that target the inner <img> for image blocks
const IMG_VISUAL_PROPS = [
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;
const IMG_VISUAL_PROP_SET: Set<string> = new Set(IMG_VISUAL_PROPS);

export function buildBlockStyle(config: Record<string, unknown>, opts?: { imgScoped?: boolean }): string {
  const style    = getEffectiveStyle(config);
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  const imgScoped = !!opts?.imgScoped;

  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(style);
  if (bg) parts.push(bg.replace(/;$/, ""));

  // Border style + color (applied together when borderStyle is not "none")
  const borderSt = cssStr(style.borderStyle);
  if (!imgScoped && borderSt && borderSt !== "none") {
    const color = (style.borderColor as string) ?? "#000000";
    const alpha = (style.borderAlpha as number) ?? 1;
    parts.push(`border-style:${borderSt}`);
    parts.push(`border-color:${hexToRgba(color, alpha)}`);
  }

  // Text color (with optional alpha)
  const textColor = cssStr(style.color);
  if (textColor) {
    const alpha = (style.colorAlpha as number) ?? 1;
    parts.push(`color:${alpha < 1 ? hexToRgba(textColor, alpha) : textColor}`);
  }

  // All simple camelCase → kebab CSS properties
  for (const prop of STYLE_PROPS) {
    if (imgScoped && IMG_VISUAL_PROP_SET.has(prop)) continue;
    const v = cssStr(style[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v}`);
  }

  // Box shadow
  if (!imgScoped) {
    const shadowColor = (style.shadowColor as string) ?? "#000000";
    const shadowAlpha = (style.shadowAlpha as number) ?? 1;
    const sx = cssStr(style.shadowX);
    const sy = cssStr(style.shadowY);
    const sblur   = cssStr(style.shadowBlur);
    const sspread = cssStr(style.shadowSpread);
    if (sx || sy || sblur || sspread) {
      const inset = style.shadowType === "inset" ? "inset " : "";
      parts.push(`box-shadow:${inset}${sx || "0px"} ${sy || "0px"} ${sblur || "0px"} ${sspread || "0px"} ${hexToRgba(shadowColor, shadowAlpha)}`);
    }
  }

  // Text stroke (-webkit-text-stroke-width / -webkit-text-stroke-color)
  const strokeWidth = cssStr(style.textStrokeWidth);
  if (strokeWidth) parts.push(`-webkit-text-stroke-width:${strokeWidth}`);
  const strokeColor = cssStr(style.textStrokeColor);
  if (strokeColor) {
    const a = (style.textStrokeAlpha as number) ?? 1;
    parts.push(`-webkit-text-stroke-color:${a < 1 ? hexToRgba(strokeColor, a) : strokeColor}`);
  }

  // Text shadow (X Y Blur Color — color falls back to currentColor)
  const tsx    = cssStr(style.textShadowX);
  const tsy    = cssStr(style.textShadowY);
  const tsblur = cssStr(style.textShadowBlur);
  if (tsx || tsy || tsblur) {
    const tsColor = cssStr(style.textShadowColor);
    const tsAlpha = (style.textShadowAlpha as number) ?? 1;
    const colorPart = tsColor
      ? ` ${tsAlpha < 1 ? hexToRgba(tsColor, tsAlpha) : tsColor}`
      : "";
    parts.push(`text-shadow:${tsx || "0px"} ${tsy || "0px"} ${tsblur || "0px"}${colorPart}`);
  }

  // Advanced: position + inset
  const pos = cssStr(advanced.position);
  if (pos) {
    parts.push(`position:${pos}`);
    for (const side of ["top", "right", "bottom", "left"]) {
      const v = cssStr(advanced[side]);
      if (v) parts.push(`${side}:${v}`);
    }
  }

  // Advanced: z-index
  const zi = advanced.zIndex;
  if (zi !== undefined && zi !== "" && zi !== null) parts.push(`z-index:${zi}`);

  // Opacity (stored as CSS-native 0..1)
  const opacity = style.opacity;
  if (typeof opacity === "number") parts.push(`opacity:${opacity}`);

  // Auto overflow:hidden when border + radius are both set and overflow not explicit
  // (skipped when imgScoped — visual props go on the <img> directly)
  if (!imgScoped) {
    const hasBorderStyle = (() => {
      const bs = cssStr(style.borderStyle);
      return !!bs && bs !== "none";
    })();
    const hasBorderWidth = !!(
      cssStr(style.borderTopWidth)    ||
      cssStr(style.borderRightWidth)  ||
      cssStr(style.borderBottomWidth) ||
      cssStr(style.borderLeftWidth)
    );
    const hasRadius = !!(
      cssStr(style.borderTopLeftRadius)     ||
      cssStr(style.borderTopRightRadius)    ||
      cssStr(style.borderBottomRightRadius) ||
      cssStr(style.borderBottomLeftRadius)
    );
    const hasOverflowSet = !!(cssStr(style.overflowX) || cssStr(style.overflowY));
    if (hasBorderStyle && hasBorderWidth && hasRadius && !hasOverflowSet) {
      parts.push("overflow:hidden");
    }
  }

  return parts.join(";");
}

// Build CSS body for the visual subset (border / radii / shadow) — used to
// target an inner <img> for image blocks.
export function buildImgVisualStyle(style: Record<string, unknown>): string {
  const parts: string[] = [];

  const borderSt = cssStr(style.borderStyle);
  if (borderSt && borderSt !== "none") {
    const color = (style.borderColor as string) ?? "#000000";
    const alpha = (style.borderAlpha as number) ?? 1;
    parts.push(`border-style:${borderSt}`);
    parts.push(`border-color:${hexToRgba(color, alpha)}`);
  }

  for (const prop of IMG_VISUAL_PROPS) {
    const v = cssStr(style[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v}`);
  }

  const shadowColor = (style.shadowColor as string) ?? "#000000";
  const shadowAlpha = (style.shadowAlpha as number) ?? 1;
  const sx = cssStr(style.shadowX);
  const sy = cssStr(style.shadowY);
  const sblur   = cssStr(style.shadowBlur);
  const sspread = cssStr(style.shadowSpread);
  if (sx || sy || sblur || sspread) {
    const inset = style.shadowType === "inset" ? "inset " : "";
    parts.push(`box-shadow:${inset}${sx || "0px"} ${sy || "0px"} ${sblur || "0px"} ${sspread || "0px"} ${hexToRgba(shadowColor, shadowAlpha)}`);
  }

  return parts.join(";");
}

export function buildImgVisualCss(config: Record<string, unknown>, blockId: string): string {
  if (!blockId) return "";
  const style = getEffectiveStyle(config);
  const css = buildImgVisualStyle(style);
  return css ? `[data-epx-block="${blockId}"] img{${css}}` : "";
}

export function buildImgVisualHoverCss(config: Record<string, unknown>, blockId: string): string {
  if (!blockId) return "";
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const css = buildImgVisualStyle(styleHover);
  if (!css) return "";
  const importantCss = css.split(";").filter(Boolean).map(d => `${d} !important`).join(";");
  return `[data-epx-block="${blockId}"]:hover img{${importantCss}}`;
}

// ─── Video background: storage key or URL ────────────────────────────────────

export function getVideoBackground(config: Record<string, unknown>): string | null {
  const style = getEffectiveStyle(config);
  if (style.backgroundType !== "video") return null;

  const src = style.backgroundVideoSrc as string | undefined;
  if (src === "url") return (style.backgroundVideoUrl as string) ?? null;

  const key = style.backgroundVideoMediaStorageKey as string | undefined;
  return key ? `/_emdash/api/media/file/${key}` : null;
}

export type VideoType = "youtube" | "vimeo" | "html5";

export interface VideoInfo {
  type: VideoType;
  rawUrl: string;
  videoId?: string;
}

export function getVideoInfo(config: Record<string, unknown>): VideoInfo | null {
  const rawUrl = getVideoBackground(config);
  if (!rawUrl) return null;

  const yt = rawUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: "youtube", rawUrl, videoId: yt[1] };

  const vi = rawUrl.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
  if (vi) return { type: "vimeo", rawUrl, videoId: vi[1] };

  return { type: "html5", rawUrl };
}

export function buildYouTubeEmbedUrl(videoId: string, opts: { startTime?: number; endTime?: number; loop: boolean }): string {
  const p = new URLSearchParams({
    autoplay: "1", mute: "1", controls: "0",
    disablekb: "1", fs: "0", cc_load_policy: "0",
    rel: "0", iv_load_policy: "3", modestbranding: "1", playsinline: "1",
  });
  if (opts.loop) { p.set("loop", "1"); p.set("playlist", videoId); }
  if (opts.startTime !== undefined) p.set("start", String(Math.floor(opts.startTime)));
  if (opts.endTime   !== undefined) p.set("end",   String(Math.floor(opts.endTime)));
  return `https://www.youtube.com/embed/${videoId}?${p}`;
}

export function buildVimeoEmbedUrl(videoId: string, opts: { startTime?: number; loop: boolean }): string {
  const p = new URLSearchParams({ autoplay: "1", muted: "1", background: "1", autopause: "0" });
  if (!opts.loop) p.set("loop", "0");
  const url = `https://player.vimeo.com/video/${videoId}?${p}`;
  return opts.startTime !== undefined ? `${url}#t=${Math.floor(opts.startTime)}` : url;
}

// ─── Hover CSS ────────────────────────────────────────────────────────────────

const HOVER_STYLE_PROPS = [
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;

export function buildHoverCss(config: Record<string, unknown>, blockId: string, opts?: { imgScoped?: boolean }): string {
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const imgScoped = !!opts?.imgScoped;
  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(styleHover);
  if (bg) parts.push(bg.replace(/;$/, "") + " !important");

  // Border style + color
  if (!imgScoped) {
    const borderSt = cssStr(styleHover.borderStyle);
    if (borderSt && borderSt !== "none") {
      const color = (styleHover.borderColor as string) ?? "#000000";
      const alpha = (styleHover.borderAlpha as number) ?? 1;
      parts.push(`border-style:${borderSt} !important`);
      parts.push(`border-color:${hexToRgba(color, alpha)} !important`);
    }
  }

  // Box shadow
  if (!imgScoped) {
    const hShadowColor = (styleHover.shadowColor as string) ?? "#000000";
    const hShadowAlpha = (styleHover.shadowAlpha as number) ?? 1;
    const hsx = cssStr(styleHover.shadowX);
    const hsy = cssStr(styleHover.shadowY);
    const hsblur   = cssStr(styleHover.shadowBlur);
    const hsspread = cssStr(styleHover.shadowSpread);
    if (hsx || hsy || hsblur || hsspread) {
      const inset = styleHover.shadowType === "inset" ? "inset " : "";
      parts.push(`box-shadow:${inset}${hsx || "0px"} ${hsy || "0px"} ${hsblur || "0px"} ${hsspread || "0px"} ${hexToRgba(hShadowColor, hShadowAlpha)} !important`);
    }
  }

  // Border widths + radius
  for (const prop of HOVER_STYLE_PROPS) {
    if (imgScoped && IMG_VISUAL_PROP_SET.has(prop)) continue;
    const v = cssStr(styleHover[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v} !important`);
  }

  // Opacity (stored as CSS-native 0..1)
  const opacityH = styleHover.opacity;
  if (typeof opacityH === "number") parts.push(`opacity:${opacityH} !important`);

  if (!parts.length) return "";
  return `[data-epx-block="${blockId}"]:hover{${parts.join(";")}}`;
}

// ─── Block CSS (selector-based, replaces inline style) ───────────────────────

export function wrapBlockCss(styleStr: string, blockId: string): string {
  if (!styleStr || !blockId) return "";
  return `[data-epx-block="${blockId}"]{${styleStr}}`;
}

export function buildBlockCss(config: Record<string, unknown>, blockId: string, opts?: { imgScoped?: boolean }): string {
  return wrapBlockCss(buildBlockStyle(config, opts), blockId);
}

// ─── Per-breakpoint Hover CSS ─────────────────────────────────────────────────

export function buildBreakpointHoverCss(config: Record<string, unknown>, blockId: string): string {
  const styleHoverBreakpoints = config.styleHoverBreakpoints as Record<string, Record<string, unknown>> | undefined;
  if (!styleHoverBreakpoints || !blockId) return "";

  const entries = Object.entries(styleHoverBreakpoints)
    .filter(([, s]) => typeof (s as Record<string, unknown>)._px === "number")
    .sort(([, a], [, b]) => ((b as Record<string, unknown>)._px as number) - ((a as Record<string, unknown>)._px as number));

  let css = "";
  for (const [, bpHover] of entries) {
    const px = (bpHover as Record<string, unknown>)._px as number;
    const parts: string[] = [];

    const borderSt = cssStr(bpHover.borderStyle);
    if (borderSt && borderSt !== "none") {
      const color = (bpHover.borderColor as string) ?? "#000000";
      const alpha = (bpHover.borderAlpha as number) ?? 1;
      parts.push(`border-style:${borderSt} !important`, `border-color:${hexToRgba(color, alpha)} !important`);
    }

    for (const prop of HOVER_STYLE_PROPS) {
      const v = cssStr(bpHover[prop]);
      if (v) parts.push(`${camelToKebab(prop)}:${v} !important`);
    }

    const hsx = cssStr(bpHover.shadowX);
    const hsy = cssStr(bpHover.shadowY);
    const hsblur   = cssStr(bpHover.shadowBlur);
    const hsspread = cssStr(bpHover.shadowSpread);
    if (hsx || hsy || hsblur || hsspread) {
      const inset = bpHover.shadowType === "inset" ? "inset " : "";
      const sc = (bpHover.shadowColor as string) ?? "#000000";
      const sa = (bpHover.shadowAlpha as number) ?? 1;
      parts.push(`box-shadow:${inset}${hsx || "0px"} ${hsy || "0px"} ${hsblur || "0px"} ${hsspread || "0px"} ${hexToRgba(sc, sa)} !important`);
    }

    if (parts.length) {
      css += `@media(max-width:${px}px){[data-epx-block="${blockId}"]:hover{${parts.join(";")}}}`;
    }
  }
  return css;
}

// ─── Per-breakpoint CSS (Radius + Border + Shadow overrides) ─────────────────

const BP_VISUAL_PROPS = [
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "textAlign",
  "fontFamily", "fontSize", "fontWeight",
  "textTransform", "fontStyle", "textDecoration",
  "lineHeight", "letterSpacing", "wordSpacing",
  "mixBlendMode",
] as const;

// layoutSelector: when provided (e.g. for video containers), layout+gap rules target
// that selector instead of the block root selector.
export function buildBreakpointCss(
  config: Record<string, unknown>,
  blockId: string,
  layoutSelector?: string,
): string {
  const styleBreakpoints = config.styleBreakpoints as Record<string, Record<string, unknown>> | undefined;
  if (!styleBreakpoints || !blockId) return "";

  const entries = Object.entries(styleBreakpoints)
    .filter(([, s]) => typeof (s as Record<string, unknown>)._px === "number")
    .sort(([, a], [, b]) => ((b as Record<string, unknown>)._px as number) - ((a as Record<string, unknown>)._px as number));

  const rootSel   = `[data-epx-block="${blockId}"]`;
  const layoutSel = layoutSelector ?? rootSel;

  let css = "";
  for (const [, bpStyle] of entries) {
    const px = (bpStyle as Record<string, unknown>)._px as number;

    // Visual properties — always on root selector
    const visualParts: string[] = [];

    const borderSt = cssStr(bpStyle.borderStyle);
    if (borderSt && borderSt !== "none") {
      const color = (bpStyle.borderColor as string) ?? "#000000";
      const alpha = (bpStyle.borderAlpha as number) ?? 1;
      visualParts.push(`border-style:${borderSt}`, `border-color:${hexToRgba(color, alpha)}`);
    }

    const bpTextColor = cssStr(bpStyle.color);
    if (bpTextColor) {
      const alpha = (bpStyle.colorAlpha as number) ?? 1;
      visualParts.push(`color:${alpha < 1 ? hexToRgba(bpTextColor, alpha) : bpTextColor}`);
    }

    for (const prop of BP_VISUAL_PROPS) {
      const v = cssStr(bpStyle[prop]);
      if (v) visualParts.push(`${camelToKebab(prop)}:${v}`);
    }

    const sx = cssStr(bpStyle.shadowX);
    const sy = cssStr(bpStyle.shadowY);
    const sblur   = cssStr(bpStyle.shadowBlur);
    const sspread = cssStr(bpStyle.shadowSpread);
    if (sx || sy || sblur || sspread) {
      const inset = bpStyle.shadowType === "inset" ? "inset " : "";
      const sc = (bpStyle.shadowColor as string) ?? "#000000";
      const sa = (bpStyle.shadowAlpha as number) ?? 1;
      visualParts.push(`box-shadow:${inset}${sx || "0px"} ${sy || "0px"} ${sblur || "0px"} ${sspread || "0px"} ${hexToRgba(sc, sa)}`);
    }

    const bpStrokeWidth = cssStr(bpStyle.textStrokeWidth);
    if (bpStrokeWidth) visualParts.push(`-webkit-text-stroke-width:${bpStrokeWidth}`);
    const bpStrokeColor = cssStr(bpStyle.textStrokeColor);
    if (bpStrokeColor) {
      const a = (bpStyle.textStrokeAlpha as number) ?? 1;
      visualParts.push(`-webkit-text-stroke-color:${a < 1 ? hexToRgba(bpStrokeColor, a) : bpStrokeColor}`);
    }

    const tsx    = cssStr(bpStyle.textShadowX);
    const tsy    = cssStr(bpStyle.textShadowY);
    const tsblur = cssStr(bpStyle.textShadowBlur);
    if (tsx || tsy || tsblur) {
      const tsColor = cssStr(bpStyle.textShadowColor);
      const tsAlpha = (bpStyle.textShadowAlpha as number) ?? 1;
      const colorPart = tsColor
        ? ` ${tsAlpha < 1 ? hexToRgba(tsColor, tsAlpha) : tsColor}`
        : "";
      visualParts.push(`text-shadow:${tsx || "0px"} ${tsy || "0px"} ${tsblur || "0px"}${colorPart}`);
    }

    // Layout + gap properties — on layoutSel (may differ from rootSel for video containers)
    const layoutParts: string[] = [];

    const colGap = cssStr(bpStyle.columnGap);   if (colGap) layoutParts.push(`column-gap:${colGap}`);
    const rowGap = cssStr(bpStyle.rowGap);       if (rowGap) layoutParts.push(`row-gap:${rowGap}`);
    const flexDir = cssStr(bpStyle.flexDirection);   if (flexDir) layoutParts.push(`flex-direction:${flexDir}`);
    const flexWrap = cssStr(bpStyle.flexWrap);       if (flexWrap) layoutParts.push(`flex-wrap:${flexWrap}`);
    const justifyC = cssStr(bpStyle.justifyContent); if (justifyC) layoutParts.push(`justify-content:${justifyC}`);
    const alignI   = cssStr(bpStyle.flexAlignItems); if (alignI)   layoutParts.push(`align-items:${alignI}`);

    if (!visualParts.length && !layoutParts.length) continue;

    let mq = "";
    if (layoutSel === rootSel) {
      // Same selector — merge into one rule
      const all = [...visualParts, ...layoutParts];
      mq = `${rootSel}{${all.join(";")}}`;
    } else {
      if (visualParts.length) mq += `${rootSel}{${visualParts.join(";")}}`;
      if (layoutParts.length) mq += `${layoutSel}{${layoutParts.join(";")}}`;
    }
    css += `@media(max-width:${px}px){${mq}}`;
  }
  return css;
}

// ─── HTML attribute helpers ───────────────────────────────────────────────────

export function getBlockId(config: Record<string, unknown>): string | null {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  return cssStr(advanced.cssId) || null;
}

export function getBlockClass(config: Record<string, unknown>): string {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  return cssStr(advanced.cssClasses);
}

export function getCustomCss(config: Record<string, unknown>, blockId: string): string {
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  const css = cssStr(advanced.customCss);
  if (!css) return "";
  return `[data-epx-block="${blockId}"]{${css}}`;
}
