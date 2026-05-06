import React, { memo } from "react";

export const TextPreview = memo(function TextPreview({ config }: { config: Record<string, unknown> }) {
  const content = (config.content as string) || "";
  if (!content) {
    return (
      <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Text block</span>
    );
  }
  return (
    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</span>
  );
});
