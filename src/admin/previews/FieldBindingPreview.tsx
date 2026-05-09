import React, { memo } from "react";

interface PreviewProps {
  config: Record<string, unknown>;
}

// F4.4 — `field-binding` preview. Canvas wraps every preview in
// `<div data-epx-block={id}>`, so the chrome CSS emitted by
// `buildBlockChromeCss` targets that outer div — the inner badge here
// is purely informational. We can't resolve the actual entry value at
// preview time (the canvas runs in the admin UI without the host
// page's `entry` in scope), so the preview shows a small badge that
// names the bound field (or "<unbound>" when `config.field` is empty)
// instead of the resolved value. Authors get a clear visual cue that
// this block reads from the entry rather than carrying its own
// content.
export const FieldBindingPreview = memo(function FieldBindingPreview({ config }: PreviewProps) {
  const field = ((config.field as string) || "").trim();
  const label = field ? `<bound: ${field}>` : "<unbound>";
  // Inline `margin: 0` neutralises browser-default margins on the
  // inner `<span>` so spacing comes only from the author's configured
  // padding/margin on the wrapping `[data-epx-block]` div.
  return (
    <span
      style={{
        margin: 0,
        display: "inline-block",
        padding: "2px 8px",
        fontSize: 12,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        color: field ? "#0b5ed7" : "#888",
        background: field ? "rgba(11,94,215,0.08)" : "rgba(0,0,0,0.05)",
        borderRadius: 4,
        fontStyle: field ? "normal" : "italic",
      }}
    >
      {label}
    </span>
  );
});
