import { useState } from "react";
import type { FieldRenderProps } from "../../blockDefinitions.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import {
  LinkControl,
  parseLink,
  serializeLink,
  type LinkValue,
} from "../../controls/LinkControl.js";
import { MediaPicker, type MediaRef } from "../../controls/MediaPicker.js";
import { ImagePreviewCard } from "../../controls/ImagePreviewCard.js";

const RESOLUTION_OPTIONS = [
  { value: "full",      label: "Full (original)" },
  { value: "thumbnail", label: "Thumbnail (150 × 150)" },
  { value: "medium",    label: "Medium (300 × 300)" },
  { value: "large",     label: "Large (1024 × 1024)" },
];

/**
 * Image-block Fields-tab content — `ImagePreviewCard` (preview + Select /
 * Change / Remove buttons), Resolution selector, LinkControl, and the
 * `MediaPicker` portal.
 *
 * F3.5.6 — extracted from `RightPanel.tsx`'s imperative
 * `block.type === "image"` Fields branch (~lines 798–838). Backs the
 * `{ kind: "custom", render: ImageFieldsSection }` entry in the image
 * block's `fieldsTab`.
 */
export function ImageFieldsSection({ block, onChange }: FieldRenderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const config = block.config as Record<string, unknown>;
  const img = config.image as MediaRef | undefined;
  const resolution = (config.resolution as string) ?? "full";
  const linkValue: LinkValue = parseLink(config);
  const handleLink = (val: LinkValue) => onChange(serializeLink(val));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <ImagePreviewCard
        image={img}
        onSelect={() => setPickerOpen(true)}
        onRemove={() => onChange({ image: undefined })}
        boxed
      />

      <FieldGroup
        isDirty={resolution !== "full"}
        onReset={() => onChange({ resolution: "full" })}
      >
        <SelectRow
          label="Resolution"
          value={resolution}
          onChange={(v) => onChange({ resolution: v })}
          options={RESOLUTION_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>

      <LinkControl value={linkValue} onChange={handleLink} />

      {pickerOpen && (
        <MediaPicker
          mimeTypeFilter="image/"
          onSelect={([ref]) => {
            if (ref) onChange({ image: ref });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
          selectedIds={img?.id ? [img.id] : []}
        />
      )}
    </div>
  );
}
