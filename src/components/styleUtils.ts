import type { MediaUrlResolver } from "./media.js";
import { resolveMediaUrl } from "./media.js";

type GradStop = { color: string; alpha: number; pos: number };

/**
 * Options threaded through the chrome / background helpers so they can
 * resolve `storageKey` references without hardcoding the local-runtime
 * URL pattern. CSS generation is sync — callers build the resolver from
 * `Astro.locals` once and pass it down.
 *
 * `resolveMediaUrl` defaults to the legacy fallback (no adapter), so
 * existing call sites that haven't been wired through yet still work.
 */
export interface MediaUrlOptions {
  resolveMediaUrl?: MediaUrlResolver;
}

function defaultResolver(key: string): string | null {
  // No `locals` — `resolveMediaUrl` returns the legacy fallback URL.
  return resolveMediaUrl(key);
}

function pickResolver(opts?: MediaUrlOptions): MediaUrlResolver {
  return opts?.resolveMediaUrl ?? defaultResolver;
}

// Light-variant style. Dark is a separate variant emitted as its own scoped
// rule (see buildBlockCss / darkBlockSelector). config.theme is purely an
// authoring marker and is NOT consulted at render time — the frontend emits
// BOTH variants and a host-driven dark ancestor (`html.dark`,
// `[data-theme="dark"]`, `[data-mode="dark"]`, …) cascades. See
// `darkBlockSelector` for the full list of accepted conventions.
function getEffectiveStyle(config: Record<string, unknown>): Record<string, unknown> {
  return (config.style ?? {}) as Record<string, unknown>;
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

// ─── Legacy symbolic-spacing inline resolve (F3.6.4) ─────────────────────────
//
// Pre-F3.6 layouts persisted padding/margin as symbolic strings (`"md"`,
// `"lg"`, …). Since F3.6 the canvas writes concrete px (e.g. `"12px"`).
// Agent A's `runMigrationLegacySpacingV1` rewrites stored values forward;
// once it has run, no row carries a symbolic value anymore. This helper
// defends the brief window between an EmDash host upgrading the plugin and
// the lazy-gate migration firing on first request — without that window
// guard, rows with `paddingTop: "md"` would render with literal `"md"` as
// the CSS value (browser ignores → padding 0, silent visual regression).
//
// Values verified against the legacy `spacingMap` in `SectionContainer.astro`
// (pre-F3.6.4). Source-of-truth migration also uses these values.
const LEGACY_SPACING_MAP: Record<string, string> = {
  none: "0",
  sm:   "32px",
  md:   "48px",
  lg:   "64px",
  xl:   "96px",
};

// Spacing keys whose symbolic values are normalised via LEGACY_SPACING_MAP.
// Restricted to padding+margin — the original `resolveSpacing` in
// `SectionContainer.astro` only ever applied to padding, but margin uses the
// same authoring vocabulary historically. Border / sizing / radius keys are
// intentionally NOT in this set: they never had a symbolic-spacing fallback
// and folding them in would silently change behavior for any author who
// happened to type `none` into a width field expecting it to stay `none`.
const LEGACY_SPACING_PROP_SET: ReadonlySet<string> = new Set([
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "marginTop",  "marginRight",  "marginBottom",  "marginLeft",
]);

/**
 * Inline-resolve a legacy symbolic spacing value (`"none"`/`"sm"`/`"md"`/
 * `"lg"`/`"xl"`) to its px equivalent. Returns the input unchanged when the
 * value is not symbolic — concrete CSS values (`"12px"`, `"1.5rem"`, …) and
 * empty strings pass through.
 *
 * KISS: callers gate this on the prop name being in
 * `LEGACY_SPACING_PROP_SET`, so non-spacing keys never touch the legacy map.
 */
export function normalizeLegacySpacing(value: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_SPACING_MAP, value)
    ? LEGACY_SPACING_MAP[value]
    : value;
}

/**
 * `cssStr` + legacy spacing normalisation. Used by the CSS builder for
 * padding/margin keys so symbolic values from pre-F3.6 layouts render as
 * the matching px during the migration window.
 */
function spacingCssStr(v: unknown): string {
  const raw = cssStr(v);
  if (!raw) return "";
  return normalizeLegacySpacing(raw);
}

// ─── Background ───────────────────────────────────────────────────────────────

export function buildBackgroundCss(style: Record<string, unknown>, opts?: MediaUrlOptions): string {
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

  const resolve = pickResolver(opts);

  if (type === "image") {
    const src    = style.backgroundImageSrc as string | undefined;
    const imgUrl = src === "url"
      ? (style.backgroundImageUrl as string | undefined)
      : (() => {
          const k = style.backgroundImageStorageKey as string | undefined;
          return k ? (resolve(k) ?? undefined) : undefined;
        })();
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
    if (first?.storageKey) {
      const url = resolve(first.storageKey);
      if (url) return `background:url(${url}) center/cover no-repeat;`;
    }
  }

  // video: handled via <video> element overlay — no CSS background
  return "";
}

// ─── Full inline style string ─────────────────────────────────────────────────

/**
 * Canonical list of CSS-property keys the plugin's CSS pipeline knows how to
 * emit. Every key here maps 1:1 to a kebab-case CSS declaration via
 * `camelToKebab`. Spacing keys (`padding*` / `margin*`) additionally get
 * legacy-symbolic resolution through `LEGACY_SPACING_PROP_SET` +
 * `normalizeLegacySpacing` (F3.6.4).
 *
 * Exported (1.0.5 — debt cleanup) so the admin schema in
 * `src/admin/blockDefinitions.ts` can derive `EMPTY_STYLE_DEFAULTS` from
 * this list instead of maintaining a parallel mirror. Also referenced by
 * `tests/blockDefinitions.test.ts` directly. Single source of truth —
 * future style-key additions only need to land here.
 */
export const STYLE_PROPS = [
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
  "aspectRatio",
  "filter",
] as const;

// Visual props that target the inner <img> for image blocks
const IMG_VISUAL_PROPS = [
  "borderTopLeftRadius", "borderTopRightRadius",
  "borderBottomRightRadius", "borderBottomLeftRadius",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
] as const;
const IMG_VISUAL_PROP_SET: Set<string> = new Set(IMG_VISUAL_PROPS);

/**
 * Iterate a single style object + advanced bag and produce the CSS body
 * (no selector). Pulled out of `buildBlockStyle` so the same code can emit
 * the light variant (style + advanced) and the dark variant (styleDark
 * only — advanced is shared and lives on the light rule).
 */
function buildStyleBodyFromObject(
  style: Record<string, unknown>,
  advanced: Record<string, unknown>,
  opts?: { imgScoped?: boolean } & MediaUrlOptions,
): string {
  const imgScoped = !!opts?.imgScoped;
  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(style, opts);
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

  // All simple camelCase → kebab CSS properties.
  // Spacing keys (padding*/margin*) are inline-resolved through the legacy
  // symbolic map (F3.6.4) so pre-migration rows render concrete px during
  // the upgrade-to-migration window. Non-spacing keys go through the
  // unchanged `cssStr` path.
  for (const prop of STYLE_PROPS) {
    if (imgScoped && IMG_VISUAL_PROP_SET.has(prop)) continue;
    const v = LEGACY_SPACING_PROP_SET.has(prop)
      ? spacingCssStr(style[prop])
      : cssStr(style[prop]);
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

  // Text shadow (X Y Blur Color — defaults to #000000 if not set)
  const tsx    = cssStr(style.textShadowX);
  const tsy    = cssStr(style.textShadowY);
  const tsblur = cssStr(style.textShadowBlur);
  if (tsx || tsy || tsblur) {
    const tsColor = cssStr(style.textShadowColor) || "#000000";
    const tsAlpha = (style.textShadowAlpha as number) ?? 1;
    const colorPart = ` ${tsAlpha < 1 ? hexToRgba(tsColor, tsAlpha) : tsColor}`;
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

export function buildBlockStyle(config: Record<string, unknown>, opts?: { imgScoped?: boolean } & MediaUrlOptions): string {
  const style    = getEffectiveStyle(config);
  const advanced = (config.advanced ?? {}) as Record<string, unknown>;
  return buildStyleBodyFromObject(style, advanced, opts);
}

/**
 * CSS body for the dark-theme override, scoped via the compound selector
 * in `buildBlockCss`. Advanced (position/zIndex) lives on the light rule
 * and is intentionally NOT repeated here — the dark rule only carries the
 * declarations that change between modes.
 */
export function buildDarkBlockStyle(config: Record<string, unknown>, opts?: { imgScoped?: boolean } & MediaUrlOptions): string {
  const styleDark = (config.styleDark ?? {}) as Record<string, unknown>;
  if (Object.keys(styleDark).length === 0) return "";
  return buildStyleBodyFromObject(styleDark, {}, opts);
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
  // F4.5 — `!important` dropped. The `:hover img` compound selector
  // outranks the bare `[data-epx-block] img` selector by an additional
  // `:hover` pseudo-class, so the cascade promotes the hover declarations
  // naturally. Authors who want a per-theme hover treatment use the F4.5
  // `styleHoverDark` key (emitted by `buildBlockChromeCss` further down)
  // instead of relying on the escape-hatch.
  return `[data-epx-block="${blockId}"]:hover img{${css}}`;
}

// ─── Video background: storage key or URL ────────────────────────────────────

export function getVideoBackground(config: Record<string, unknown>, opts?: MediaUrlOptions): string | null {
  const style = getEffectiveStyle(config);
  if (style.backgroundType !== "video") return null;

  const src = style.backgroundVideoSrc as string | undefined;
  if (src === "url") return (style.backgroundVideoUrl as string) ?? null;

  const key = style.backgroundVideoMediaStorageKey as string | undefined;
  return key ? pickResolver(opts)(key) : null;
}

export type VideoType = "youtube" | "vimeo" | "html5";

export interface VideoInfo {
  type: VideoType;
  rawUrl: string;
  videoId?: string;
}

export function getVideoInfo(config: Record<string, unknown>, opts?: MediaUrlOptions): VideoInfo | null {
  const rawUrl = getVideoBackground(config, opts);
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

/**
 * Iterate `styleHover` (or any hover-shape style object) and produce the
 * CSS declarations body (no selector, no `!important`). Pulled out of
 * `buildHoverCss` so the same code can emit:
 *
 *   - `:hover` body (light/hover variant) — `buildHoverCss`.
 *   - `darkBlockSelector + :hover` body (dark/hover variant) —
 *     `buildHoverDarkCss` (F4.5).
 *   - `@media + :hover` body (light/hover-per-bp) — `buildBreakpointHoverCss`.
 *   - `@media + darkBlockSelector + :hover` body (dark/hover-per-bp) —
 *     `buildBreakpointHoverDarkCss` (F4.5).
 *
 * F4.5 dropped `!important` from every emitted declaration. The selector
 * specificity ladder now does the cascade work — see `darkBlockSelector`
 * + `prd-theme.md` for the full table.
 */
function buildHoverBodyFromObject(
  styleHover: Record<string, unknown>,
  opts?: { imgScoped?: boolean } & MediaUrlOptions,
): string {
  const imgScoped = !!opts?.imgScoped;
  const parts: string[] = [];

  // Background
  const bg = buildBackgroundCss(styleHover, opts);
  if (bg) parts.push(bg.replace(/;$/, ""));

  // Border style + color
  if (!imgScoped) {
    const borderSt = cssStr(styleHover.borderStyle);
    if (borderSt && borderSt !== "none") {
      const color = (styleHover.borderColor as string) ?? "#000000";
      const alpha = (styleHover.borderAlpha as number) ?? 1;
      parts.push(`border-style:${borderSt}`);
      parts.push(`border-color:${hexToRgba(color, alpha)}`);
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
      parts.push(`box-shadow:${inset}${hsx || "0px"} ${hsy || "0px"} ${hsblur || "0px"} ${hsspread || "0px"} ${hexToRgba(hShadowColor, hShadowAlpha)}`);
    }
  }

  // Border widths + radius
  for (const prop of HOVER_STYLE_PROPS) {
    if (imgScoped && IMG_VISUAL_PROP_SET.has(prop)) continue;
    const v = cssStr(styleHover[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v}`);
  }

  // Opacity (stored as CSS-native 0..1)
  const opacityH = styleHover.opacity;
  if (typeof opacityH === "number") parts.push(`opacity:${opacityH}`);

  return parts.join(";");
}

export function buildHoverCss(config: Record<string, unknown>, blockId: string, opts?: { imgScoped?: boolean } & MediaUrlOptions): string {
  if (!blockId) return "";
  const styleHover = (config.styleHover ?? {}) as Record<string, unknown>;
  const body = buildHoverBodyFromObject(styleHover, opts);
  if (!body) return "";
  return `[data-epx-block="${blockId}"]:hover{${body}}`;
}

/**
 * F4.5 — emit the dark-mode hover variant. `styleHoverDark` lets authors
 * override hover styles only when the host page is in dark theme. The
 * compound selector (`darkBlockSelector + :hover`) outranks both
 * `darkBlockSelector` (dark/normal) and the bare `:hover` (light/hover)
 * by specificity, so the cascade picks dark/hover whenever the host is
 * in dark and the block is being hovered. When `styleHoverDark` is empty
 * (the default), nothing emits — the cascade falls back to the
 * light/hover rule, matching pre-F4.5 behavior.
 */
export function buildHoverDarkCss(config: Record<string, unknown>, blockId: string, opts?: { imgScoped?: boolean } & MediaUrlOptions): string {
  if (!blockId) return "";
  const styleHoverDark = (config.styleHoverDark ?? {}) as Record<string, unknown>;
  if (Object.keys(styleHoverDark).length === 0) return "";
  const body = buildHoverBodyFromObject(styleHoverDark, opts);
  if (!body) return "";
  return `${darkBlockHoverSelector(blockId)}{${body}}`;
}

// ─── Block CSS (selector-based, replaces inline style) ───────────────────────

export function wrapBlockCss(styleStr: string, blockId: string): string {
  if (!styleStr || !blockId) return "";
  return `[data-epx-block="${blockId}"]{${styleStr}}`;
}

/**
 * Compound selector that matches the block element when it should render its
 * dark variant. EmDash core does NOT enforce a theme convention on the host
 * site, so the plugin must support every common one simultaneously. We cover
 * five cases via a single `:is(...)` ancestor list (specificity stays the
 * specificity of one attribute selector regardless of which clause matches):
 *
 *   1. `html.dark` — Tailwind / Novapera class-based switch.
 *   2. `html[data-theme="dark"]` — `<html>` carrying the `data-theme` attr.
 *   3. `[data-theme="dark"]` — any ancestor (e.g. `<body>`) with the attr.
 *   4. `[data-mode="dark"]` — EmDash admin convention (used by canvas chrome).
 *   5. Self: `[data-epx-block][data-theme="dark"]` — per-block author override
 *      applied by the canvas (lets the ThemeStyleToggle preview a single block
 *      in dark while siblings stay light).
 *
 * Uniform specificity means later author overrides cascade predictably.
 * Rationale: see Section 5 Q4 of `raport-empixel-emdash.html` — the plugin
 * adapts to the host, never the reverse.
 */
function darkBlockSelector(blockId: string): string {
  return `:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="${blockId}"],[data-epx-block="${blockId}"][data-theme="dark"]`;
}

/**
 * F4.5 — compound selector for the dark-hover variant. Appends `:hover` to
 * each of the two top-level clauses produced by `darkBlockSelector` (the
 * ancestor-driven one and the self-attribute one). Splitting on the
 * outer comma is safe because the inner `:is(...)` is a single
 * pseudo-class selector — it has no top-level commas.
 *
 * Result for `<id>`:
 *   `:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="<id>"]:hover,[data-epx-block="<id>"][data-theme="dark"]:hover`
 *
 * Specificity: each clause adds `:hover` (a pseudo-class) to the existing
 * `darkBlockSelector` clause, strictly outranking both the bare `:hover`
 * (light/hover) and the `darkBlockSelector` (dark/normal) — see
 * `prd-theme.md` for the cascade table.
 */
function darkBlockHoverSelector(blockId: string): string {
  return `:is(html.dark, html[data-theme="dark"], [data-theme="dark"], [data-mode="dark"]) [data-epx-block="${blockId}"]:hover,[data-epx-block="${blockId}"][data-theme="dark"]:hover`;
}

export function buildBlockCss(config: Record<string, unknown>, blockId: string, opts?: { imgScoped?: boolean } & MediaUrlOptions): string {
  if (!blockId) return "";
  const lightRule = wrapBlockCss(buildBlockStyle(config, opts), blockId);
  const darkBody = buildDarkBlockStyle(config, opts);
  if (!darkBody) return lightRule;
  return `${lightRule}${darkBlockSelector(blockId)}{${darkBody}}`;
}

// ─── Per-breakpoint Hover CSS ─────────────────────────────────────────────────

/**
 * Build the per-bp hover declarations body (no selector, no `!important`)
 * for a single bp-style object. Shared by `buildBreakpointHoverCss` and
 * `buildBreakpointHoverDarkCss` (F4.5) so the four hover variants
 * (light/normal, dark/normal, light/hover, dark/hover) emit identical
 * declarations apart from the wrapping selector.
 *
 * F4.5 dropped `!important` here as in `buildHoverCss` — selector
 * specificity now drives the cascade.
 */
function buildHoverBpBodyFromObject(bpHover: Record<string, unknown>): string {
  const parts: string[] = [];

  const borderSt = cssStr(bpHover.borderStyle);
  if (borderSt && borderSt !== "none") {
    const color = (bpHover.borderColor as string) ?? "#000000";
    const alpha = (bpHover.borderAlpha as number) ?? 1;
    parts.push(`border-style:${borderSt}`, `border-color:${hexToRgba(color, alpha)}`);
  }

  for (const prop of HOVER_STYLE_PROPS) {
    const v = cssStr(bpHover[prop]);
    if (v) parts.push(`${camelToKebab(prop)}:${v}`);
  }

  const hsx = cssStr(bpHover.shadowX);
  const hsy = cssStr(bpHover.shadowY);
  const hsblur   = cssStr(bpHover.shadowBlur);
  const hsspread = cssStr(bpHover.shadowSpread);
  if (hsx || hsy || hsblur || hsspread) {
    const inset = bpHover.shadowType === "inset" ? "inset " : "";
    const sc = (bpHover.shadowColor as string) ?? "#000000";
    const sa = (bpHover.shadowAlpha as number) ?? 1;
    parts.push(`box-shadow:${inset}${hsx || "0px"} ${hsy || "0px"} ${hsblur || "0px"} ${hsspread || "0px"} ${hexToRgba(sc, sa)}`);
  }

  return parts.join(";");
}

/**
 * Iterate a hover-bp map and yield `(px, bpHover)` entries sorted from
 * largest px to smallest (preserves the historical ordering for
 * `@media (max-width:N)` cascading — larger queries match first, smaller
 * queries override). Shared by `buildBreakpointHoverCss` and
 * `buildBreakpointHoverDarkCss`.
 */
function sortedBpEntries(
  bpMap: Record<string, Record<string, unknown>> | undefined,
): Array<[Record<string, unknown>, number]> {
  if (!bpMap) return [];
  return Object.entries(bpMap)
    .filter(([, s]) => typeof s._px === "number")
    .sort(([, a], [, b]) => (b._px as number) - (a._px as number))
    .map(([, s]) => [s, s._px as number] as [Record<string, unknown>, number]);
}

export function buildBreakpointHoverCss(config: Record<string, unknown>, blockId: string): string {
  if (!blockId) return "";
  const styleHoverBreakpoints = config.styleHoverBreakpoints as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!styleHoverBreakpoints) return "";

  let css = "";
  for (const [bpHover, px] of sortedBpEntries(styleHoverBreakpoints)) {
    const body = buildHoverBpBodyFromObject(bpHover);
    if (body) {
      css += `@media(max-width:${px}px){[data-epx-block="${blockId}"]:hover{${body}}}`;
    }
  }
  return css;
}

/**
 * F4.5 — emit per-breakpoint dark-hover declarations.
 * `styleBreakpointsHoverDark[bpId] = { _px, ...CSSProps }` is the
 * dark-mode counterpart to `styleHoverBreakpoints`. Each entry produces
 * one `@media (max-width:<px>) { darkBlockSelector + :hover { ... } }`
 * rule. When the map is empty, nothing emits and the cascade falls back
 * to `styleHoverBreakpoints` on dark — same behavior as pre-F4.5.
 */
export function buildBreakpointHoverDarkCss(config: Record<string, unknown>, blockId: string): string {
  if (!blockId) return "";
  const styleBreakpointsHoverDark = config.styleBreakpointsHoverDark as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!styleBreakpointsHoverDark) return "";

  const hoverSel = darkBlockHoverSelector(blockId);

  let css = "";
  for (const [bpHoverDark, px] of sortedBpEntries(styleBreakpointsHoverDark)) {
    const body = buildHoverBpBodyFromObject(bpHoverDark);
    if (body) {
      css += `@media(max-width:${px}px){${hoverSel}{${body}}}`;
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
  "aspectRatio",
  "filter",
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
      // Same legacy-spacing normalisation as the desktop path
      // (`buildStyleBodyFromObject`). BP_VISUAL_PROPS doesn't currently
      // include padding/margin, so this is a forward-compatibility gate —
      // if a future change adds a spacing prop here, the legacy fallback
      // travels with it.
      const v = LEGACY_SPACING_PROP_SET.has(prop)
        ? spacingCssStr(bpStyle[prop])
        : cssStr(bpStyle[prop]);
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
      const tsColor = cssStr(bpStyle.textShadowColor) || "#000000";
      const tsAlpha = (bpStyle.textShadowAlpha as number) ?? 1;
      const colorPart = ` ${tsAlpha < 1 ? hexToRgba(tsColor, tsAlpha) : tsColor}`;
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

// ─── Combined chrome CSS (single helper used by every Astro block) ───────────
//
// Every block component used to build its own combined CSS string by calling
// buildBlockCss + buildHoverCss + buildBreakpointCss + buildBreakpointHoverCss
// + getCustomCss in the same order. Some components missed one or two helpers
// — Text and Image notably skipped breakpoint variants — leading to silent
// parity drift with the canvas (audit H2). Use this helper everywhere instead.
//
// `opts.resolveMediaUrl` is forwarded into the background helpers so storage
// keys (`style.backgroundImageStorageKey`, `backgroundSlides[*].storageKey`)
// resolve through the host's storage adapter. Astro components build the
// resolver from `Astro.locals` and pass it once. When omitted, the helpers
// fall back to the legacy `/_emdash/api/media/file/<key>` URL.
function buildBlockChromeCssDirect(
  config: Record<string, unknown>,
  blockId: string | undefined,
  opts?: { imgScoped?: boolean } & MediaUrlOptions,
): string {
  if (!blockId) return "";
  // F4.5 — emit the full theme × state matrix in cascade order.
  //
  // Selector specificity ladder (low → high):
  //   1. light/normal       — `[data-epx-block]`
  //   2. dark/normal        — `darkBlockSelector + [data-epx-block]`
  //   3. light/hover        — `[data-epx-block]:hover`
  //   4. dark/hover (F4.5)  — `darkBlockSelector + [data-epx-block]:hover`
  //
  // Per-breakpoint variants repeat the same 4-rung ladder inside each
  // `@media (max-width:N)` block. Source order is light/normal,
  // dark/normal, light/hover, dark/hover so when two rules tie on
  // specificity the later one wins — this matters for the bp variants
  // that all share `@media` + selector specificity.
  //
  // `getCustomCss` (advanced.customCss) goes last so author-supplied
  // overrides cascade over everything we emit.
  //
  // `buildBlockCss` packs rules 1+2 (light/normal + dark/normal) into a
  // single output string in that order. We append rules 3+4 (light/hover
  // + dark/hover) next, then the bp variants in matching order.
  const parts = [
    buildBlockCss(config, blockId, opts),         // rules 1 + 2
    buildHoverCss(config, blockId, opts),         // rule 3
    buildHoverDarkCss(config, blockId, opts),     // rule 4 — F4.5
    buildBreakpointCss(config, blockId),          // per-bp 1 + 2 (light + dark via host signal)
    buildBreakpointHoverCss(config, blockId),     // per-bp 3
    buildBreakpointHoverDarkCss(config, blockId), // per-bp 4 — F4.5
    getCustomCss(config, blockId),
  ];
  if (opts?.imgScoped) {
    parts.push(buildImgVisualCss(config, blockId));
    parts.push(buildImgVisualHoverCss(config, blockId));
  }
  return parts.filter(Boolean).join("");
}

// ─── F4.2: memoize buildBlockChromeCss ──────────────────────────────────────
//
// `buildBlockChromeCss` runs five sub-helpers (block / hover / per-bp /
// per-bp-hover / customCss) plus the optional img-scoped pair on every render
// of every block in the layout. CSS generation is deterministic per-input —
// same `(config, blockId, opts)` always produces the same string — so we wrap
// the builder in an in-process LRU and hand back the cached string when the
// fingerprint matches.
//
// Cache key fingerprint:
//   `${JSON.stringify(config)}|${blockId}|${opts.imgScoped ? "1" : "0"}`
//
// `JSON.stringify(config)` is the dominant cost of the key build, but it's
// still cheaper than running all five sub-helpers (each of which does its own
// nested `JSON.stringify` on `styleBreakpoints` / `styleHoverBreakpoints`).
// For a 30-block page the cache turns the second + Nth render of the page
// into ~1ms instead of ~5–10ms.
//
// **Skip memoization when `opts.resolveMediaUrl` is set.** The resolver is a
// closure (built per-request from `Astro.locals`), so two structurally-
// identical configs would still need different resolved URLs. Including the
// resolver in the fingerprint via `JSON.stringify` would emit `null` (functions
// are non-enumerable to JSON) and produce false cache hits — silently serving
// the wrong URL to a different request. KISS: when a resolver is passed,
// fall through to the direct call (one-time cost is bounded; the typical
// Astro frontmatter only calls the helper once per block per request anyway).
//
// LRU eviction via `Map` re-set: on a hit, `delete` + `set` reinserts the
// entry at the tail (insertion order = recency); on overflow we evict the
// head (oldest). Capacity 500 — picked to comfortably hold a couple of
// medium-large pages worth of distinct (config, blockId) pairs.
const CHROME_CACHE_CAPACITY = 500;
const chromeCache = new Map<string, string>();

function chromeCacheKey(
  config: Record<string, unknown>,
  blockId: string,
  opts?: { imgScoped?: boolean } & MediaUrlOptions,
): string {
  return `${JSON.stringify(config)}|${blockId}|${opts?.imgScoped ? "1" : "0"}`;
}

export function buildBlockChromeCss(
  config: Record<string, unknown>,
  blockId: string | undefined,
  opts?: { imgScoped?: boolean } & MediaUrlOptions,
): string {
  if (!blockId) return "";
  // Closure dependency — bypass the cache. See block comment above.
  if (opts?.resolveMediaUrl) {
    return buildBlockChromeCssDirect(config, blockId, opts);
  }

  const key = chromeCacheKey(config, blockId, opts);
  const cached = chromeCache.get(key);
  if (cached !== undefined) {
    // Reinsert at the tail to mark recency (LRU).
    chromeCache.delete(key);
    chromeCache.set(key, cached);
    return cached;
  }

  const built = buildBlockChromeCssDirect(config, blockId, opts);
  chromeCache.set(key, built);
  if (chromeCache.size > CHROME_CACHE_CAPACITY) {
    // Evict the oldest (insertion-order head).
    const oldestKey = chromeCache.keys().next().value;
    if (oldestKey !== undefined) chromeCache.delete(oldestKey);
  }
  return built;
}

/**
 * Reset the chrome-cache state. Used by tests to assert cache behaviour
 * (size, eviction, hit rate). Not called from runtime code paths.
 */
export function _resetBuildBlockChromeCssCache(): void {
  chromeCache.clear();
}

/**
 * Test-only inspector — count of currently-cached entries. Not stable
 * runtime API.
 */
export function _buildBlockChromeCssCacheSize(): number {
  return chromeCache.size;
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
  if (!css || !blockId) return "";
  const sel = `[data-epx-block="${blockId}"]`;
  // Substitute the `selector` keyword (whole-word) with the block's attribute selector.
  const replaced = css.replace(/\bselector\b/g, sel);
  // If the user wrote rule blocks (contains `{`), emit as-is. Otherwise treat
  // the input as bare declarations and wrap in a rule scoped to the block.
  if (replaced.includes("{")) return replaced;
  return `${sel}{${replaced}}`;
}

// ─── F4.1: CSS coalescing ───────────────────────────────────────────────────
//
// Pre-F4.1 every block emitted its own `<style is:global>` tag at template
// position — a 30-block page shipped 30+ inline `<style>` tags, each
// repeating its own `@media (max-width: ...)` block. `coalesceLayoutCss`
// is the merge step: takes the per-block CSS strings the layout root
// collected, parses each for `@media` blocks, groups rule bodies by query,
// and emits a single string with (a) all base (non-`@media`) rules first,
// then (b) one `@media (...) { merged-body }` per unique query.
//
// Plugin-emitted CSS is predictable: every helper above (`buildBlockCss`,
// `buildHoverCss`, `buildBreakpointCss`, `buildBreakpointHoverCss`,
// `getCustomCss`, plus per-component scoped rules in `Image.astro` /
// `Icon.astro` / `DividerSpacer.astro` / `Html.astro` / `Video.astro` /
// `TextEditor.astro` / `SectionContainer.astro`) emits flat rules and at
// most one level of `@media` nesting. We never emit nested at-rules
// (`@supports` / `@layer` / `@container`), so a regex-driven scan is
// sufficient — no full CSS parser needed (KISS).
//
// Algorithm:
//   1. Concatenate all input strings into one buffer.
//   2. Scan top-level: walk the buffer tracking brace depth (so nested
//      braces inside `@media` bodies don't confuse the boundary detector)
//      and split into top-level chunks. Each chunk is either a bare rule
//      (`<selector> { … }`) or an `@media (...) { … }` block.
//   3. Bare rules are appended to the base-rules accumulator in input
//      order (preserves cascade semantics — declarations from later blocks
//      keep their original ordering relative to earlier blocks).
//   4. `@media` blocks are bucketed by their query string (everything
//      between `@media` and the opening `{`, normalized — leading /
//      trailing whitespace trimmed). The body (everything between matching
//      braces) is appended to that bucket's accumulator.
//   5. Output: base-rules first, then `@media (query){ accumulated body }`
//      per unique query in first-seen order.
//
// Idempotent on empty input. Whitespace-tolerant (regex matching is
// flexible on the `@media` syntax). Pass-through on input that contains
// no `@media` blocks (the original concatenation, no parse cost).
export function coalesceLayoutCss(perBlockCss: ReadonlyArray<string>): string {
  if (perBlockCss.length === 0) return "";
  const joined = perBlockCss.filter(Boolean).join("");
  if (!joined) return "";

  // Fast path — nothing to merge.
  if (!joined.includes("@media")) return joined;

  let baseRules = "";
  // Map<queryString, mergedBody>. Map preserves insertion order so groups
  // emit in first-seen order — predictable for tests + cascade.
  const mediaGroups = new Map<string, string>();

  let i = 0;
  const n = joined.length;
  while (i < n) {
    // Skip leading whitespace between rules so the boundary detector
    // doesn't accidentally treat trailing whitespace as a rule.
    while (i < n && /\s/.test(joined[i])) i += 1;
    if (i >= n) break;

    if (joined.startsWith("@media", i)) {
      // Find the opening brace that starts the @media body.
      const openIdx = joined.indexOf("{", i);
      if (openIdx === -1) {
        // Malformed — drop the rest, no useful split possible.
        break;
      }
      const queryRaw = joined.slice(i + "@media".length, openIdx);
      const query = queryRaw.trim();

      // Walk to the matching closing brace, tracking nested braces.
      let depth = 1;
      let j = openIdx + 1;
      while (j < n && depth > 0) {
        const ch = joined[j];
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      if (depth !== 0) {
        // Unbalanced — give up on the rest.
        break;
      }
      const body = joined.slice(openIdx + 1, j);
      const existing = mediaGroups.get(query) ?? "";
      mediaGroups.set(query, existing + body);
      i = j + 1;
      continue;
    }

    // Bare rule — find the matching closing brace.
    const openIdx = joined.indexOf("{", i);
    if (openIdx === -1) {
      // No more rules — append the trailing tail (declarations without a
      // selector — unusual but harmless to keep).
      baseRules += joined.slice(i);
      break;
    }
    let depth = 1;
    let j = openIdx + 1;
    while (j < n && depth > 0) {
      const ch = joined[j];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      if (depth === 0) break;
      j += 1;
    }
    if (depth !== 0) {
      baseRules += joined.slice(i);
      break;
    }
    baseRules += joined.slice(i, j + 1);
    i = j + 1;
  }

  let out = baseRules;
  for (const [query, body] of mediaGroups) {
    // No space between `@media` and the parenthesized query — matches the
    // form `buildBreakpointCss` / `buildBreakpointHoverCss` already emit
    // (`@media(max-width:992px)`), so existing snapshots / `.toContain`
    // assertions on the breakpoint helpers continue to match the coalesced
    // output. The trimmed query string carries its own parentheses.
    out += `@media${query}{${body}}`;
  }
  return out;
}
