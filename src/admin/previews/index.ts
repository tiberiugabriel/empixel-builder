import type React from "react";
import type { BlockType, BreakpointId, SectionBlock } from "../../types.js";
import { ContainerPreview } from "./ContainerPreview.js";
import { TextPreview } from "./TextPreview.js";
import { ImagePreview } from "./ImagePreview.js";
import { TextEditorPreview } from "./TextEditorPreview.js";
import { VideoPreview } from "./VideoPreview.js";
import { ButtonPreview } from "./ButtonPreview.js";
import { IconPreview } from "./IconPreview.js";
import { HtmlPreview } from "./HtmlPreview.js";
import { DividerSpacerPreview } from "./DividerSpacerPreview.js";
import { FieldBindingPreview } from "./FieldBindingPreview.js";

export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
  activeBreakpoint?: BreakpointId;
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  container: ContainerPreview as React.ComponentType<PreviewProps>,
  text: TextPreview as React.ComponentType<PreviewProps>,
  image: ImagePreview as React.ComponentType<PreviewProps>,
  "text-editor": TextEditorPreview as React.ComponentType<PreviewProps>,
  video: VideoPreview as React.ComponentType<PreviewProps>,
  button: ButtonPreview as React.ComponentType<PreviewProps>,
  icon: IconPreview as React.ComponentType<PreviewProps>,
  html: HtmlPreview as React.ComponentType<PreviewProps>,
  "divider-spacer": DividerSpacerPreview as React.ComponentType<PreviewProps>,
  // F4.4 — `field-binding` preview. Canvas can't resolve the actual
  // `entry.data[config.field]` value at preview time (no host
  // `entry` in scope), so the preview renders a small badge naming
  // the bound field instead of the resolved value. The frontend
  // `FieldBinding.astro` does the real lookup.
  "field-binding": FieldBindingPreview as React.ComponentType<PreviewProps>,
};
