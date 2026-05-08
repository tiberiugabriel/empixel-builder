import React, { memo } from "react";
import type { VideoConfig, VideoSourceValue, VideoOverlayValue } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
}

const RATIO_PADDING: Record<string, string> = {
  "1:1":   "100%",
  "3:2":   "66.67%",
  "4:3":   "75%",
  "16:9":  "56.25%",
  "21:9":  "42.86%",
  "9:16":  "177.78%",
};

export const VideoPreview = memo(function VideoPreview({ config }: PreviewProps) {
  const video = ((config as unknown as VideoConfig).video ?? {}) as VideoSourceValue;
  const overlay = ((config as unknown as VideoConfig).overlay ?? {}) as VideoOverlayValue;
  const aspect = (config.aspectRatio as string) || "16:9";

  const overlayUrl = overlay.image?.storageKey
    ? `/_emdash/api/media/file/${overlay.image.storageKey}`
    : undefined;

  const hasSource = !!(video.url || video.media);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        paddingTop: RATIO_PADDING[aspect] ?? "56.25%",
        background: "#0f172a",
        overflow: "hidden",
        borderRadius: 4,
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {overlayUrl ? (
          <img
            src={overlayUrl}
            alt={overlay.image?.alt ?? overlay.image?.filename ?? ""}
            style={{ width: "100%", height: "100%", objectFit: (overlay.size as React.CSSProperties["objectFit"]) ?? "cover", objectPosition: overlay.position ?? "center" }}
          />
        ) : (
          <span style={{ color: "#94a3b8", fontSize: 11 }}>{hasSource ? "▶" : "Video block"}</span>
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>▶</div>
        </div>
      </div>
    </div>
  );
});
