import { useState } from "react";
import type { FieldRenderProps } from "../../blockDefinitions.js";
import type { VideoSourceValue, VideoOverlayValue } from "../../../types.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import { VideoSourceControl } from "../../controls/VideoSourceControl.js";
import { MediaPicker, type MediaRef } from "../../controls/MediaPicker.js";
import { ImagePreviewCard } from "../../controls/ImagePreviewCard.js";
import { IconGroup } from "../../controls/IconGroup.js";
import { getBpIcon } from "../../components/BreakpointIcons.js";

const RESOLUTION_OPTIONS = [
  { value: "full",      label: "Full (original)" },
  { value: "thumbnail", label: "Thumbnail (150 × 150)" },
  { value: "medium",    label: "Medium (300 × 300)" },
  { value: "large",     label: "Large (1024 × 1024)" },
];

const OBJECT_POSITION_OPTIONS = [
  { value: "",              label: "Default" },
  { value: "center",        label: "Center" },
  { value: "top",           label: "Top" },
  { value: "right",         label: "Right" },
  { value: "bottom",        label: "Bottom" },
  { value: "left",          label: "Left" },
  { value: "top left",      label: "Top Left" },
  { value: "top right",     label: "Top Right" },
  { value: "bottom left",   label: "Bottom Left" },
  { value: "bottom right",  label: "Bottom Right" },
];

function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

/**
 * Fields-tab content for the `video` block. Bundles:
 *
 * - `VideoSourceControl` (provider auto-detect, src input, autoplay /
 *   mute / controls / lazyLoad toggles, etc.) — bp-aware via the
 *   control's own `breakpointIndicator` prop.
 * - "Image Overlay" group — image picker via `ImagePreviewCard` +
 *   `MediaPicker`, resolution / size / position selects, IconGroup.
 *
 * F3.5.6 — extracted from `RightPanel.tsx`'s imperative
 * `block.type === "video"` Fields branch (~lines 875–951). Backs the
 * `{ kind: "custom", render: VideoFieldsSection }` entry in the
 * video block's `fieldsTab`.
 *
 * The picker open state is local — same as the legacy implementation
 * (`videoOverlayPickerOpen` lived on `RightPanel`'s `useState`). The
 * F3.5.6 swap moves it down here so a single block-mount owns it.
 */
export function VideoFieldsSection({ block, onChange, activeBreakpoint }: FieldRenderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const config = block.config as Record<string, unknown>;
  const video = (config.video ?? {}) as VideoSourceValue;
  const overlay = (config.overlay ?? {}) as VideoOverlayValue;
  const overlayImg = overlay.image as MediaRef | undefined;

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <VideoSourceControl
        value={video}
        onChange={(v) => onChange({ video: v })}
        breakpointIndicator={breakpointIndicator}
      />
      <PanelDivider />
      <span
        className="epx-row-label--section"
        style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        Image Overlay
      </span>
      <ImagePreviewCard
        image={overlayImg}
        onSelect={() => setPickerOpen(true)}
        onRemove={() => onChange({ overlay: { ...overlay, image: undefined } })}
        emptyLabel="Select Overlay Image"
        boxed
      />
      {pickerOpen && (
        <MediaPicker
          title="Select Overlay Image"
          mimeTypeFilter="image/"
          onSelect={([ref]) => {
            if (ref) onChange({ overlay: { ...overlay, image: ref } });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          selectedIds={overlayImg?.id ? [overlayImg.id] : []}
        />
      )}
      <FieldGroup
        isDirty={!!overlay.resolution && overlay.resolution !== "full"}
        onReset={() => onChange({ overlay: { ...overlay, resolution: undefined } })}
      >
        <SelectRow
          label="Resolution"
          value={overlay.resolution ?? "full"}
          onChange={(v) => onChange({ overlay: { ...overlay, resolution: v as VideoOverlayValue["resolution"] } })}
          options={RESOLUTION_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      <FieldGroup
        isDirty={!!overlay.size && overlay.size !== "cover"}
        onReset={() => onChange({ overlay: { ...overlay, size: undefined } })}
      >
        <SelectRow
          label="Size"
          value={overlay.size ?? "cover"}
          onChange={(v) => onChange({ overlay: { ...overlay, size: v as VideoOverlayValue["size"] } })}
          options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "auto", label: "Auto" }]}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      <FieldGroup
        isDirty={!!overlay.position && overlay.position !== "center"}
        onReset={() => onChange({ overlay: { ...overlay, position: undefined } })}
      >
        <SelectRow
          label="Position"
          value={overlay.position ?? "center"}
          onChange={(v) => onChange({ overlay: { ...overlay, position: v } })}
          options={OBJECT_POSITION_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      <IconGroup
        label="Overlay Icon"
        value={overlay.icon}
        onChange={(v) => onChange({ overlay: { ...overlay, icon: v } })}
        showPosition={false}
      />
    </div>
  );
}
