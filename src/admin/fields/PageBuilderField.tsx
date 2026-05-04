import React from "react";
import { apiFetch } from "emdash/plugin-utils";

interface Props {
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
  id?: string;
  required?: boolean;
  options?: Record<string, unknown>;
  minimal?: boolean;
}

function getEntryContext(): { collection: string; id: string } | null {
  const match = window.location.pathname.match(/\/content\/([^/]+)\/([^/?#]+)/);
  return match ? { collection: match[1], id: decodeURIComponent(match[2]) } : null;
}

export function PageBuilderField({ value, onChange, minimal }: Props) {
  const ctx = getEntryContext();
  const enabled = !!value;

  const openBuilder = () => {
    if (!ctx) return;
    const back = window.location.pathname + window.location.search;
    window.location.href =
      `/_emdash/admin/plugins/empixel-builder/editor` +
      `?pageId=${encodeURIComponent(ctx.id)}` +
      `&collection=${encodeURIComponent(ctx.collection)}` +
      `&back=${encodeURIComponent(back)}`;
  };

  if (!ctx) {
    return <div className="epx-fw-error">Could not determine entry from URL.</div>;
  }

  return (
    <div className={`epx-fw${minimal ? " epx-fw--minimal" : ""}${enabled ? " is-enabled" : ""}`}>
      <div className="epx-fw__body">
        <p className="epx-fw__title">EmPixel Builder</p>
      </div>
      <div className="epx-fw__actions">
        <label className="epx-fw__toggle" title={enabled ? "Disable builder" : "Enable builder"}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={async (e) => {
              const checked = e.target.checked;
              onChange(checked);
              if (ctx) {
                // Call the API immediately so empixel_builder_layouts is updated
                try {
                  await apiFetch("/_emdash/api/plugins/empixel-builder/toggle", {
                    method: "POST",
                    body: JSON.stringify({ entryId: ctx.id, collection: ctx.collection, enabled: checked }),
                  });
                } catch (err) {
                  console.error("Failed to toggle builder state:", err);
                }
              }
            }}
          />
          <span className="epx-fw__toggle-track">
            <span className="epx-fw__toggle-thumb" />
          </span>
        </label>
        {enabled && (
          <button className="epx-fw__btn" onClick={openBuilder} type="button">
            Open Builder
          </button>
        )}
      </div>
      <style>{`
        .epx-fw {
          --epx-bg: #f8faff;
          --epx-border: #e2e8f0;
          --epx-text: #3b82f6;
          --epx-enabled-bg-start: #eff6ff;
          --epx-enabled-bg-end: #f0f4ff;
          --epx-enabled-border: #bfdbfe;
          --epx-track-bg: #cbd5e1;
          --epx-track-active: #2563eb;
          --epx-thumb-bg: #fff;
          --epx-btn-bg: #2563eb;
          --epx-btn-hover: #1d4ed8;
          --epx-btn-text: #fff;

          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--epx-bg);
          border: 1.5px solid var(--epx-border);
          border-radius: 10px;
          transition: border-color 0.15s, background 0.15s;
        }

        @media (prefers-color-scheme: dark) {
          .epx-fw {
            --epx-bg: #1e293b;
            --epx-border: #334155;
            --epx-text: #3b82f6;
            --epx-enabled-bg-start: #d8e7ff;
            --epx-enabled-bg-end: #d8e7ff;
            --epx-enabled-border: #3b82f6;
            --epx-track-bg: #475569;
            --epx-track-active: #3b82f6;
            --epx-thumb-bg: #f8fafc;
            --epx-btn-bg: #3b82f6;
            --epx-btn-hover: #60a5fa;
          }
        }
        
        [data-mode="dark"] .epx-fw {
          --epx-bg: #1e293b;
          --epx-border: #334155;
          --epx-text: #e2e8f0;
          --epx-enabled-bg-start: #172554;
          --epx-enabled-bg-end: #1e3a8a;
          --epx-enabled-border: #3b82f6;
          --epx-track-bg: #475569;
          --epx-track-active: #3b82f6;
          --epx-thumb-bg: #f8fafc;
          --epx-btn-bg: #3b82f6;
          --epx-btn-hover: #60a5fa;
        }

        .epx-fw.is-enabled {
          background: linear-gradient(135deg, var(--epx-enabled-bg-start) 0%, var(--epx-enabled-bg-end) 100%);
          border-color: var(--epx-enabled-border);
        }
        .epx-fw--minimal { padding: 8px 12px; border-radius: 6px; }
        .epx-fw__body { flex: 1; min-width: 0; }
        .epx-fw__title { margin: 0; font-size: 13px; font-weight: 700; color: var(--epx-text); transition: color 0.15s; }
        .epx-fw__actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .epx-fw__toggle { position: relative; display: inline-flex; cursor: pointer; }
        .epx-fw__toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
        .epx-fw__toggle-track {
          display: flex;
          align-items: center;
          width: 36px;
          height: 20px;
          border-radius: 10px;
          background: var(--epx-track-bg);
          transition: background 0.2s;
          padding: 2px;
          box-sizing: border-box;
        }
        .epx-fw__toggle input:checked + .epx-fw__toggle-track { background: var(--epx-track-active); }
        .epx-fw__toggle-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--epx-thumb-bg);
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          flex-shrink: 0;
        }
        .epx-fw__toggle input:checked + .epx-fw__toggle-track .epx-fw__toggle-thumb {
          transform: translateX(16px);
        }
        .epx-fw__btn {
          padding: 7px 16px;
          background: var(--epx-btn-bg);
          color: var(--epx-btn-text);
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .epx-fw__btn:hover { background: var(--epx-btn-hover); }
        .epx-fw-error { font-size: 13px; color: #ef4444; }
      `}</style>
    </div>
  );
}
