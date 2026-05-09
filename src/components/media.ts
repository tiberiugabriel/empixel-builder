// Storage-agnostic media URL resolution for the frontend.
//
// EmDash exposes a synchronous URL builder on the request locals:
// `Astro.locals.emdash.getPublicMediaUrl(storageKey)` returns a fetchable URL
// produced by whichever storage adapter is active (local, S3, R2, …).
// Plugin layouts persist `storageKey` references and this helper turns
// those keys into URLs without hardcoding the local-runtime path.
//
// In Astro frontmatter, pass `Astro.locals` (or any object with the same
// shape). Outside an Astro request — tests, edge cases — the resolver
// falls back to the legacy `/_emdash/api/media/file/<key>` URL so older
// integrations don't break mid-rollout. The fallback is the only place
// the legacy path remains in `src/components/`.
//
// Rationale: Section 5 Q3 / Section 4 T4 of `raport-empixel-emdash.html` —
// the plugin must adapt to the host's storage adapter, not assume one.
//
// The shape mirrors EmDash's own typing
// (node_modules/emdash/dist/astro/types.d.mts):
//   `getPublicMediaUrl?: (storageKey: string) => string`
// so consumers can pass `Astro.locals` directly.

interface EmDashMediaLocals {
  getPublicMediaUrl?: (storageKey: string) => string | undefined;
}

interface EmDashLocals {
  emdash?: EmDashMediaLocals;
}

export interface ResolveMediaUrlOptions {
  /**
   * Astro `Astro.locals` (or any object with `.emdash.getPublicMediaUrl`).
   * Pass `Astro.locals` from a `*.astro` frontmatter; everything else is
   * read-only.
   */
  locals?: EmDashLocals;
}

/**
 * Resolve an EmDash storage key to a public, fetchable URL.
 *
 * Returns `null` only when `key` is empty / falsy; an unresolvable key
 * (no adapter, no fallback) still yields a string so `<img src=…>` doesn't
 * break in transitional setups.
 *
 * @param key       Storage key persisted in the layout JSON (e.g. `image.storageKey`).
 * @param opts.locals  Astro request locals — pass `Astro.locals` from `.astro` frontmatter.
 */
export function resolveMediaUrl(
  key: string | undefined | null,
  opts?: ResolveMediaUrlOptions,
): string | null {
  if (!key) return null;

  const adapter = opts?.locals?.emdash;
  if (adapter?.getPublicMediaUrl) {
    const url = adapter.getPublicMediaUrl(key);
    if (url) return url;
  }

  // Legacy fallback — the local-runtime route. Keeps the helper safe to
  // call from unit tests and from older host installations that haven't
  // wired `getPublicMediaUrl` onto `Astro.locals.emdash` yet.
  return `/_emdash/api/media/file/${encodeURIComponent(key)}`;
}

/**
 * Sync resolver type used by `styleUtils.ts` so CSS generation can keep
 * its synchronous shape. Astro components build a closure
 * `(key) => resolveMediaUrl(key, { locals: Astro.locals })` and pass it via
 * the helper's `opts.resolveMediaUrl`.
 */
export type MediaUrlResolver = (key: string) => string | null;

// ---------------------------------------------------------------------------
// F4.10 — responsive image pipeline (`<picture>` + srcset, AVIF/WebP)
// ---------------------------------------------------------------------------
//
// The image block renders responsive `<picture>` markup so the browser
// downloads the smallest appropriate file. Two cooperating layers:
//
// 1. `buildResponsiveSrcSet(baseUrl, widths, format)` — pure string builder.
//    Given a base URL, a list of widths, and a target format, returns a
//    comma-joined `srcset` string. URLs are produced by appending
//    `?format=<fmt>&w=<n>` (or `&format=…&w=…` if the URL already has a
//    query string). CDNs that intercept those query parameters
//    (Cloudflare Image Resizing, Vercel/Netlify Image Optimization,
//    custom S3-fronted-by-CF setups) do the actual transform; CDNs that
//    don't ignore the query string and serve the original — so a host
//    without format-conversion still renders the page correctly,
//    just without the optimization.
//
// 2. `resolveResponsiveSrcSet(key, opts)` — feature-detected wrapper.
//    Returns `null` when format conversion isn't available (the local
//    runtime fallback `/_emdash/api/media/file/...` doesn't speak
//    transforms — that route 404s on `?format=avif`, so we deliberately
//    skip the responsive markup for that case to preserve the F2.2 no-
//    regression promise). Returns `{ avif, webp, fallback, sizes,
//    widths }` when an adapter-resolved URL is found, allowing the
//    `Image.astro` component to emit `<picture>` with AVIF + WebP
//    `<source>` elements + an `<img srcset>` fallback. The host's CDN
//    decides whether to honor the format query — the markup is
//    forward-compatible.
//
// Default size set: `[480, 800, 1200, 1920]` widths covering phones
// (480) through 4K (1920 ≈ 2x typical desktop width) without flooding
// `srcset` with dozens of entries. Default `sizes`:
// `(max-width: 768px) 100vw, 50vw` — the canonical "image fills the
// viewport on phone, half-width on desktop" heuristic. Future blocks
// can override both via `opts.widths` and `opts.sizes`.

/** Default responsive widths emitted in the `<picture>` srcset. */
export const RESPONSIVE_DEFAULT_WIDTHS: ReadonlyArray<number> = [480, 800, 1200, 1920];

/** Default `sizes` attribute when the block doesn't supply an explicit one. */
export const RESPONSIVE_DEFAULT_SIZES = "(max-width: 768px) 100vw, 50vw";

/** Image format set in priority order (AVIF first, original-format last). */
export type ResponsiveImageFormat = "avif" | "webp";

/**
 * Append `format` and `w` query parameters to a URL, preserving any
 * existing query. Used by `buildResponsiveSrcSet` to produce per-format
 * per-width URLs for the `<picture>` srcset.
 *
 * @internal
 */
export function appendImageTransformParams(
  baseUrl: string,
  format: ResponsiveImageFormat | undefined,
  width: number,
): string {
  const sep = baseUrl.includes("?") ? "&" : "?";
  const parts: string[] = [];
  if (format) parts.push(`format=${format}`);
  parts.push(`w=${width}`);
  return `${baseUrl}${sep}${parts.join("&")}`;
}

/**
 * Build a comma-joined `srcset` value for the given widths and format.
 *
 * @example
 *   buildResponsiveSrcSet("https://cdn/img.png?epx=1", [480, 800], "webp")
 *   // → "https://cdn/img.png?epx=1&format=webp&w=480 480w, https://cdn/img.png?epx=1&format=webp&w=800 800w"
 */
export function buildResponsiveSrcSet(
  baseUrl: string,
  widths: ReadonlyArray<number>,
  format?: ResponsiveImageFormat,
): string {
  return widths
    .map((w) => `${appendImageTransformParams(baseUrl, format, w)} ${w}w`)
    .join(", ");
}

/**
 * Result shape for `resolveResponsiveSrcSet`. When non-null, the
 * `Image.astro` component emits `<picture>` with AVIF + WebP `<source>`
 * elements and an `<img srcset>` fallback. When `null`, the component
 * falls back to a plain `<img src>` — preserving the F2.2 behavior for
 * hosts whose storage adapter doesn't support format conversion.
 */
export interface ResponsiveSrcSet {
  /** AVIF `<source srcset>` value. */
  avif: string;
  /** WebP `<source srcset>` value. */
  webp: string;
  /** Original-format `<img srcset>` value (JPEG / PNG / etc.). */
  fallback: string;
  /** Resolved single-URL fallback for the `<img src>` attribute. */
  src: string;
  /** `sizes` attribute for both `<source>` and `<img>`. */
  sizes: string;
  /** Width set used to build the srcsets (echoed for testability). */
  widths: ReadonlyArray<number>;
}

export interface ResolveResponsiveSrcSetOptions extends ResolveMediaUrlOptions {
  /** Widths emitted in the srcset. Defaults to `RESPONSIVE_DEFAULT_WIDTHS`. */
  widths?: ReadonlyArray<number>;
  /** `sizes` attribute. Defaults to `RESPONSIVE_DEFAULT_SIZES`. */
  sizes?: string;
}

/**
 * Internal pattern matching the legacy local-runtime URL the F2.2
 * fallback emits when no adapter is wired. We deliberately skip
 * responsive markup for that case — the route doesn't honor `?format=`
 * or `?w=` query params, so we'd ship a `<picture>` with broken
 * `<source>` URLs that 404 on every breakpoint. Plain `<img src>` is
 * the safe degradation.
 *
 * @internal
 */
const LOCAL_RUNTIME_URL_PREFIX = "/_emdash/api/media/file/";

/**
 * Detect whether the resolved URL is the legacy local-runtime fallback.
 * Used by `resolveResponsiveSrcSet` to opt out of responsive markup for
 * hosts that don't have a format-aware adapter wired.
 *
 * @internal
 */
export function isLegacyLocalRuntimeUrl(url: string): boolean {
  return url.startsWith(LOCAL_RUNTIME_URL_PREFIX);
}

/**
 * Resolve a storage key into a responsive `<picture>` markup descriptor,
 * or `null` when format conversion isn't available.
 *
 * Returns `null` when:
 * - `key` is falsy.
 * - The host doesn't expose `getPublicMediaUrl` (no adapter — fall
 *   through to legacy `<img>` markup).
 * - The resolved URL is the legacy local-runtime fallback (the
 *   `/_emdash/api/media/file/...` route doesn't speak transforms).
 *
 * Returns `{ avif, webp, fallback, src, sizes, widths }` otherwise. The
 * srcset URLs are produced by `buildResponsiveSrcSet`. `src` (the
 * `<img>` fallback) is the unmodified resolver output so browsers
 * without `<picture>` support still render the original image.
 *
 * @param key   Storage key persisted in `image.storageKey`.
 * @param opts  `locals` (Astro.locals) + optional `widths` / `sizes` overrides.
 */
export function resolveResponsiveSrcSet(
  key: string | undefined | null,
  opts?: ResolveResponsiveSrcSetOptions,
): ResponsiveSrcSet | null {
  if (!key) return null;

  // Adapter required — without `getPublicMediaUrl` we'd hit the legacy
  // local-runtime fallback, which doesn't honor `?format=` / `?w=`.
  const adapter = opts?.locals?.emdash;
  if (!adapter?.getPublicMediaUrl) return null;

  const baseUrl = adapter.getPublicMediaUrl(key);
  if (!baseUrl) return null;
  if (isLegacyLocalRuntimeUrl(baseUrl)) return null;

  const widths = opts?.widths ?? RESPONSIVE_DEFAULT_WIDTHS;
  const sizes = opts?.sizes ?? RESPONSIVE_DEFAULT_SIZES;

  return {
    avif: buildResponsiveSrcSet(baseUrl, widths, "avif"),
    webp: buildResponsiveSrcSet(baseUrl, widths, "webp"),
    fallback: buildResponsiveSrcSet(baseUrl, widths, undefined),
    src: baseUrl,
    sizes,
    widths,
  };
}
