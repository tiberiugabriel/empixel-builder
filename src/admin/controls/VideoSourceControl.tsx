import React, { useRef, useState } from "react";
import type { VideoSourceValue, VideoProvider, ImageMediaRef } from "../../types.js";
import { MediaPicker } from "./MediaPicker.js";
import type { MediaRef } from "./MediaPicker.js";
import { ImagePreviewCard } from "./ImagePreviewCard.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./ColorPicker.js";
import { FieldGroup } from "./FieldRow.js";
import { IconReset } from "./SpacingControl.js";

interface Props {
  value: VideoSourceValue | undefined;
  onChange: (v: VideoSourceValue) => void;
  breakpointIndicator?: React.ReactNode;
}

function detectProvider(url: string | undefined): VideoProvider | undefined {
  if (!url) return undefined;
  if (/youtu\.?be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/\.(mp4|webm|mov|ogv|m4v)(\?|$)/i.test(url)) return "custom";
  return undefined;
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="epx-side-input">
      <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">{label}</span>
      <label className="epx-toggle" style={{ marginLeft: "auto", paddingRight: 8 }}>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span className="epx-toggle__track"><span className="epx-toggle__thumb" /></span>
      </label>
    </div>
  );
}

export function VideoSourceControl({ value, onChange, breakpointIndicator }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [colorFormat, setColorFormat] = useState<ColorFormat>("HEX");
  const swatchRef = useRef<HTMLButtonElement>(null);

  const v: VideoSourceValue = value ?? { src: "url" };
  const isDirty = !!(v.media || v.url || v.controlsColor);

  const providerFromUrl = detectProvider(v.url);
  const effectiveProvider: VideoProvider | undefined = v.src === "media"
    ? (v.media?.filename && /\.(mp4|webm|mov|ogv|m4v)(\?|$)/i.test(v.media.filename) ? "custom" : v.provider)
    : providerFromUrl ?? v.provider;

  const set = <K extends keyof VideoSourceValue>(key: K, val: VideoSourceValue[K]) =>
    onChange({ ...v, [key]: val });

  const handleMediaSelect = (ref: MediaRef | undefined) => {
    onChange({ ...v, media: ref as ImageMediaRef | undefined });
  };

  const handleUrl = (url: string) => {
    const provider = detectProvider(url);
    onChange({ ...v, url, provider: provider ?? v.provider });
  };

  const openColor = () => {
    if (swatchRef.current) {
      const r = swatchRef.current.getBoundingClientRect();
      setColorPos({ top: r.bottom + 4, left: r.left - 180 });
    }
    setColorOpen((o) => !o);
  };

  return (
    <div className={`epx-spacing-ctrl${isDirty ? " is-dirty" : ""}`}>
      {!expanded ? (
        <div className="epx-spacing-ctrl__row">
          <div className="epx-spacing-ctrl__collapsed">
            <span className="epx-side-input__label epx-side-input__label--full" style={{ cursor: "default" }}>Video Source</span>
            {breakpointIndicator}
            <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(true)}>▾</button>
          </div>
          {isDirty && (
            <button type="button" className="epx-reset-btn" onClick={() => onChange({ src: "url" })} title="Reset">
              <IconReset />
            </button>
          )}
        </div>
      ) : (
        <div className="epx-spacing-ctrl__expanded">
          <div className="epx-spacing-ctrl__exp-header">
            <span className="epx-spacing-ctrl__label">Video Source</span>
            {breakpointIndicator}
            <div className="epx-spacing-ctrl__exp-actions">
              {isDirty && (
                <button type="button" className="epx-reset-btn" onClick={() => onChange({ src: "url" })} title="Reset">
                  <IconReset />
                </button>
              )}
              <button type="button" className="epx-spacing-ctrl__caret" onClick={() => setExpanded(false)}>▴</button>
            </div>
          </div>

          <div className="epx-bg-ctrl__src-toggle">
            <button
              type="button"
              className={`epx-bg-ctrl__src-btn${(v.src ?? "url") === "media" ? " is-active" : ""}`}
              onClick={() => set("src", "media")}
            >Media</button>
            <button
              type="button"
              className={`epx-bg-ctrl__src-btn${(v.src ?? "url") === "url" ? " is-active" : ""}`}
              onClick={() => set("src", "url")}
            >URL</button>
          </div>

          {(v.src ?? "url") === "media" ? (
            <ImagePreviewCard
              image={v.media}
              onSelect={() => setPickerOpen(true)}
              onRemove={() => handleMediaSelect(undefined)}
              emptyLabel="Select Video"
              boxed
            />
          ) : (
            <div className="epx-bg-ctrl__url-row">
              <input
                type="url"
                className="epx-bg-ctrl__url-input"
                value={v.url ?? ""}
                placeholder="YouTube | Vimeo | .mp4 | .webm | .mov"
                onChange={(e) => handleUrl(e.target.value)}
              />
            </div>
          )}

          {pickerOpen && (
            <MediaPicker
              title="Select Video"
              mimeTypeFilter="video/"
              accept="video/*"
              onSelect={([ref]) => { handleMediaSelect(ref); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
              selectedIds={v.media?.id ? [v.media.id] : []}
            />
          )}

          {effectiveProvider && (
            <>
              <ToggleRow label="Autoplay" value={!!v.autoplay} onChange={(b) => set("autoplay", b)} />
              <ToggleRow label="Mute"     value={!!v.mute}     onChange={(b) => set("mute", b)} />
              <ToggleRow label="Controls" value={v.controls ?? true} onChange={(b) => set("controls", b)} />
              <ToggleRow label="Lazy Load" value={v.lazyLoad ?? true} onChange={(b) => set("lazyLoad", b)} />

              {(effectiveProvider === "youtube" || effectiveProvider === "vimeo") && (
                <ToggleRow label="Captions" value={!!v.captions} onChange={(b) => set("captions", b)} />
              )}

              {effectiveProvider === "vimeo" && (
                <>
                  <ToggleRow label="Show Title"    value={!!v.introTitle}    onChange={(b) => set("introTitle", b)} />
                  <ToggleRow label="Show Portrait" value={!!v.introPortrait} onChange={(b) => set("introPortrait", b)} />
                  <ToggleRow label="Show Byline"   value={!!v.introByline}   onChange={(b) => set("introByline", b)} />
                </>
              )}

              {(effectiveProvider === "youtube" || effectiveProvider === "vimeo") && (
                <FieldGroup
                  isDirty={!!v.controlsColor}
                  onReset={() => set("controlsColor", undefined)}
                >
                  <div className="epx-side-input">
                    <span className="epx-side-input__label epx-side-input__label--row">Controls Color</span>
                    <div className="epx-border-color-cell" style={{ flex: 1 }}>
                      <button
                        ref={swatchRef}
                        type="button"
                        className="epx-border-color-swatch"
                        style={{ background: v.controlsColor || "#ffffff" }}
                        onClick={openColor}
                      />
                      <span className="epx-border-color-hex">{getColorDisplay(v.controlsColor || "#ffffff", colorFormat)}</span>
                      {colorOpen && (
                        <ColorPicker
                          value={v.controlsColor || "#ffffff"}
                          alpha={1}
                          onChange={(hex) => set("controlsColor", hex)}
                          onClose={() => setColorOpen(false)}
                          position={colorPos}
                          format={colorFormat}
                          onFormatChange={setColorFormat}
                        />
                      )}
                    </div>
                  </div>
                </FieldGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
