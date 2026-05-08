import type React from "react";
import type { BlockType, BreakpointId, SectionBlock } from "../../types.js";
import { TestimonialsPreview } from "./TestimonialsPreview.js";
import { FaqPreview } from "./FaqPreview.js";
import { PricingPreview } from "./PricingPreview.js";
import { ContainerPreview } from "./ContainerPreview.js";
import { TextPreview } from "./TextPreview.js";
import { ImagePreview } from "./ImagePreview.js";
import { TextEditorPreview } from "./TextEditorPreview.js";
import { VideoPreview } from "./VideoPreview.js";
import { ButtonPreview } from "./ButtonPreview.js";
import { IconPreview } from "./IconPreview.js";
import { HtmlPreview } from "./HtmlPreview.js";
import { DividerSpacerPreview } from "./DividerSpacerPreview.js";

export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
  activeBreakpoint?: BreakpointId;
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  testimonials: TestimonialsPreview as React.ComponentType<PreviewProps>,
  faq: FaqPreview as React.ComponentType<PreviewProps>,
  pricing: PricingPreview as React.ComponentType<PreviewProps>,
  container: ContainerPreview as React.ComponentType<PreviewProps>,
  text: TextPreview as React.ComponentType<PreviewProps>,
  image: ImagePreview as React.ComponentType<PreviewProps>,
  "text-editor": TextEditorPreview as React.ComponentType<PreviewProps>,
  video: VideoPreview as React.ComponentType<PreviewProps>,
  button: ButtonPreview as React.ComponentType<PreviewProps>,
  icon: IconPreview as React.ComponentType<PreviewProps>,
  html: HtmlPreview as React.ComponentType<PreviewProps>,
  "divider-spacer": DividerSpacerPreview as React.ComponentType<PreviewProps>,
};
