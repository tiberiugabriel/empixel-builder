import React, { memo } from "react";

const THEMES: Record<string, React.CSSProperties> = {
  light: { background: "#fff", color: "#111" },
  dark: { background: "#111", color: "#fff" },
};

interface Testimonial { quote?: string; author?: string; role?: string; company?: string }

export const TestimonialsPreview = memo(function TestimonialsPreview({ config }: { config: Record<string, unknown> }) {
  const theme = THEMES[config.theme as string] ?? THEMES.light;
  const items: Testimonial[] = Array.isArray(config.items) ? (config.items as Testimonial[]) : [];
  const first = items[0];

  return (
    <div style={{ ...theme, padding: "14px" }}>
      {!!config.headline && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>{String(config.headline)}</div>}
      {first ? (
        <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontStyle: "italic", opacity: 0.8, marginBottom: 6 }}>"{first.quote?.slice(0, 80)}"</div>
          <div style={{ fontSize: 11, fontWeight: 600 }}>{first.author}</div>
          {!!first.role && <div style={{ fontSize: 10, opacity: 0.6 }}>{first.role}{first.company ? `, ${first.company}` : ""}</div>}
        </div>
      ) : (
        <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "10px 12px", fontStyle: "italic", fontSize: 11, color: "#bbb", textAlign: "center" }}>
          No testimonials yet
        </div>
      )}
      {items.length > 1 && <div style={{ fontSize: 10, color: "#888", marginTop: 6, textAlign: "center" }}>+{items.length - 1} more</div>}
    </div>
  );
});
