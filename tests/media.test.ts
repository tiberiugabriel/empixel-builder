import { describe, it, expect, vi } from "vitest";
import {
  resolveMediaUrl,
  resolveResponsiveSrcSet,
  buildResponsiveSrcSet,
  appendImageTransformParams,
  isLegacyLocalRuntimeUrl,
  RESPONSIVE_DEFAULT_WIDTHS,
  RESPONSIVE_DEFAULT_SIZES,
} from "../src/components/media.js";

describe("resolveMediaUrl", () => {
  it("returns null when key is missing", () => {
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl("")).toBeNull();
  });

  it("falls back to legacy local route when no adapter is present", () => {
    expect(resolveMediaUrl("file-abc.png")).toBe(
      "/_emdash/api/media/file/file-abc.png",
    );
  });

  it("URL-encodes the key in the fallback path", () => {
    expect(resolveMediaUrl("with spaces & slash/foo.png")).toBe(
      "/_emdash/api/media/file/with%20spaces%20%26%20slash%2Ffoo.png",
    );
  });

  it("uses the adapter's getPublicMediaUrl when present", () => {
    const getPublicMediaUrl = vi.fn(
      (key: string) => `https://cdn.example.com/media/${key}?v=1`,
    );
    const url = resolveMediaUrl("img-1.jpg", {
      locals: { emdash: { getPublicMediaUrl } },
    });
    expect(getPublicMediaUrl).toHaveBeenCalledWith("img-1.jpg");
    expect(url).toBe("https://cdn.example.com/media/img-1.jpg?v=1");
  });

  it("falls back to the legacy URL when the adapter returns undefined", () => {
    const getPublicMediaUrl = vi.fn(() => undefined);
    expect(
      resolveMediaUrl("img-1.jpg", {
        locals: { emdash: { getPublicMediaUrl } },
      }),
    ).toBe("/_emdash/api/media/file/img-1.jpg");
    expect(getPublicMediaUrl).toHaveBeenCalledWith("img-1.jpg");
  });

  it("falls back when the adapter shape is partial (no getPublicMediaUrl)", () => {
    expect(
      resolveMediaUrl("img-1.jpg", {
        locals: { emdash: {} },
      }),
    ).toBe("/_emdash/api/media/file/img-1.jpg");
  });

  it("falls back when locals is empty", () => {
    expect(resolveMediaUrl("img-1.jpg", { locals: {} })).toBe(
      "/_emdash/api/media/file/img-1.jpg",
    );
  });
});

describe("appendImageTransformParams (F4.10)", () => {
  it("appends ?format & w to a URL with no existing query string", () => {
    expect(appendImageTransformParams("https://cdn/img.png", "webp", 800)).toBe(
      "https://cdn/img.png?format=webp&w=800",
    );
  });

  it("appends with & when the URL already has a query string", () => {
    expect(
      appendImageTransformParams("https://cdn/img.png?v=1", "avif", 1200),
    ).toBe("https://cdn/img.png?v=1&format=avif&w=1200");
  });

  it("omits format when undefined (original-format fallback)", () => {
    expect(appendImageTransformParams("https://cdn/img.png", undefined, 480)).toBe(
      "https://cdn/img.png?w=480",
    );
  });
});

describe("buildResponsiveSrcSet (F4.10)", () => {
  it("emits comma-joined `<url> <w>` entries for the supplied widths", () => {
    expect(
      buildResponsiveSrcSet("https://cdn/img.png", [480, 800], "webp"),
    ).toBe(
      "https://cdn/img.png?format=webp&w=480 480w, https://cdn/img.png?format=webp&w=800 800w",
    );
  });

  it("preserves any existing query string on the base URL", () => {
    expect(
      buildResponsiveSrcSet("https://cdn/img.png?epx=1", [480], "avif"),
    ).toBe("https://cdn/img.png?epx=1&format=avif&w=480 480w");
  });

  it("omits format when called without a format (original-format srcset)", () => {
    expect(buildResponsiveSrcSet("https://cdn/img.png", [480, 800])).toBe(
      "https://cdn/img.png?w=480 480w, https://cdn/img.png?w=800 800w",
    );
  });
});

describe("isLegacyLocalRuntimeUrl (F4.10)", () => {
  it("matches the legacy local-runtime fallback path", () => {
    expect(isLegacyLocalRuntimeUrl("/_emdash/api/media/file/img-1.png")).toBe(true);
  });

  it("does not match adapter-resolved URLs", () => {
    expect(isLegacyLocalRuntimeUrl("https://cdn.example.com/img.png")).toBe(false);
    expect(isLegacyLocalRuntimeUrl("https://r2.cloudflare.com/img.png")).toBe(false);
    expect(isLegacyLocalRuntimeUrl("/media/img.png")).toBe(false);
  });
});

describe("resolveResponsiveSrcSet (F4.10)", () => {
  it("returns null when key is falsy (no media reference)", () => {
    expect(resolveResponsiveSrcSet(undefined)).toBeNull();
    expect(resolveResponsiveSrcSet(null)).toBeNull();
    expect(resolveResponsiveSrcSet("")).toBeNull();
  });

  it("returns null when no adapter is present (legacy fallback would 404 on transforms)", () => {
    expect(resolveResponsiveSrcSet("img-1.png")).toBeNull();
    expect(resolveResponsiveSrcSet("img-1.png", { locals: {} })).toBeNull();
    expect(
      resolveResponsiveSrcSet("img-1.png", { locals: { emdash: {} } }),
    ).toBeNull();
  });

  it("returns null when the adapter resolves to the legacy local-runtime URL", () => {
    // A host could wire `getPublicMediaUrl` to literally return the legacy
    // route (transitional setup). Skip responsive markup for that case so
    // we don't ship `<source>` URLs that 404.
    const getPublicMediaUrl = vi.fn(
      (key: string) => `/_emdash/api/media/file/${key}`,
    );
    expect(
      resolveResponsiveSrcSet("img-1.png", {
        locals: { emdash: { getPublicMediaUrl } },
      }),
    ).toBeNull();
  });

  it("returns null when the adapter returns undefined for the key", () => {
    const getPublicMediaUrl = vi.fn(() => undefined);
    expect(
      resolveResponsiveSrcSet("img-1.png", {
        locals: { emdash: { getPublicMediaUrl } },
      }),
    ).toBeNull();
  });

  it("returns avif/webp/fallback srcsets + sizes when the adapter is wired", () => {
    const getPublicMediaUrl = vi.fn(
      (key: string) => `https://cdn.example.com/img/${key}`,
    );
    const result = resolveResponsiveSrcSet("img-1.png", {
      locals: { emdash: { getPublicMediaUrl } },
    });
    expect(result).not.toBeNull();
    expect(result?.src).toBe("https://cdn.example.com/img/img-1.png");
    expect(result?.sizes).toBe(RESPONSIVE_DEFAULT_SIZES);
    expect(result?.widths).toEqual(RESPONSIVE_DEFAULT_WIDTHS);
    // AVIF
    expect(result?.avif).toContain("format=avif&w=480 480w");
    expect(result?.avif).toContain("format=avif&w=800 800w");
    expect(result?.avif).toContain("format=avif&w=1200 1200w");
    expect(result?.avif).toContain("format=avif&w=1920 1920w");
    // WebP
    expect(result?.webp).toContain("format=webp&w=480 480w");
    expect(result?.webp).toContain("format=webp&w=1920 1920w");
    // Fallback (no format query, just width)
    expect(result?.fallback).toContain("?w=480 480w");
    expect(result?.fallback).toContain("?w=1920 1920w");
    expect(result?.fallback).not.toContain("format=");
  });

  it("preserves a query string on the adapter-resolved URL (Cloudflare-style transform conventions)", () => {
    const getPublicMediaUrl = vi.fn(
      (key: string) => `https://images.example.com/${key}?signed=abc123`,
    );
    const result = resolveResponsiveSrcSet("img-1.png", {
      locals: { emdash: { getPublicMediaUrl } },
    });
    expect(result?.avif).toContain("?signed=abc123&format=avif&w=480 480w");
    expect(result?.webp).toContain("?signed=abc123&format=webp&w=1200 1200w");
    expect(result?.src).toBe("https://images.example.com/img-1.png?signed=abc123");
  });

  it("honors caller-supplied widths and sizes overrides", () => {
    const getPublicMediaUrl = vi.fn(
      (key: string) => `https://cdn/${key}`,
    );
    const result = resolveResponsiveSrcSet("img-1.png", {
      locals: { emdash: { getPublicMediaUrl } },
      widths: [320, 640],
      sizes: "100vw",
    });
    expect(result?.widths).toEqual([320, 640]);
    expect(result?.sizes).toBe("100vw");
    expect(result?.avif).toBe(
      "https://cdn/img-1.png?format=avif&w=320 320w, https://cdn/img-1.png?format=avif&w=640 640w",
    );
  });
});
