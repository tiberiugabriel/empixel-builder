import type { FieldRenderProps } from "../../blockDefinitions.js";
import { FieldGroup, SelectRow } from "../../controls/FieldRow.js";
import {
  LinkControl,
  parseLink,
  serializeLink,
  type LinkValue,
} from "../../controls/LinkControl.js";

const TEXT_TAG_OPTIONS = [
  { value: "",     label: "Default (p)" },
  { value: "h1",   label: "H1" },
  { value: "h2",   label: "H2" },
  { value: "h3",   label: "H3" },
  { value: "h4",   label: "H4" },
  { value: "h5",   label: "H5" },
  { value: "h6",   label: "H6" },
  { value: "span", label: "span" },
  { value: "div",  label: "div" },
  { value: "a",    label: "a (link)" },
];

/**
 * Text-block Fields-tab extras — HTML Tag select + LinkControl when tag is `a`.
 * F3.5.6 — extracted from `RightPanel.tsx` `block.type === "text"` Fields branch.
 */
export function TextFieldsExtras({ block, onChange }: FieldRenderProps) {
  const config = block.config as Record<string, unknown>;
  const htmlTag = (config.htmlTag as string) ?? "";
  const linkValue: LinkValue = parseLink(config);
  const handleLink = (val: LinkValue) => onChange(serializeLink(val));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <FieldGroup
        isDirty={!!htmlTag}
        onReset={() => onChange({ htmlTag: "" })}
      >
        <SelectRow
          label="HTML Tag"
          value={htmlTag}
          onChange={(v) => onChange({ htmlTag: v })}
          options={TEXT_TAG_OPTIONS}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>
      {htmlTag === "a" && (
        <LinkControl value={linkValue} onChange={handleLink} />
      )}
    </div>
  );
}
