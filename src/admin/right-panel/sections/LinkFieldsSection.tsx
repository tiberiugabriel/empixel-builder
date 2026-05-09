import type { FieldRenderProps } from "../../blockDefinitions.js";
import {
  LinkControl,
  parseLink,
  serializeLink,
  type LinkValue,
} from "../../controls/LinkControl.js";

/**
 * Just a `LinkControl` in a Fields tab. Used by `button` and `icon`
 * blocks — both store link state on flat config keys (`linkHref`,
 * `linkNewTab`, `linkNofollow`, `linkCustomAttr`) via parse/serialize.
 *
 * F3.5.6 — extracted from `RightPanel.tsx`'s `block.type === "button"`
 * (~line 952) and `block.type === "icon"` (~line 955) Fields branches.
 */
export function LinkFieldsSection({ block, onChange }: FieldRenderProps) {
  const config = block.config as Record<string, unknown>;
  const linkValue: LinkValue = parseLink(config);
  const handleLink = (val: LinkValue) => onChange(serializeLink(val));
  return <LinkControl value={linkValue} onChange={handleLink} />;
}
