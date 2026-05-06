import type React from "react";
import type { BlockType, SectionBlock } from "../../types.js";
import { TestimonialsPreview } from "./TestimonialsPreview.js";
import { FaqPreview } from "./FaqPreview.js";
import { PricingPreview } from "./PricingPreview.js";
import { SpacerPreview } from "./SpacerPreview.js";
import { ContainerPreview } from "./ContainerPreview.js";
import { TextPreview } from "./TextPreview.js";
import { ImagePreview } from "./ImagePreview.js";

export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  testimonials: TestimonialsPreview as React.ComponentType<PreviewProps>,
  faq: FaqPreview as React.ComponentType<PreviewProps>,
  pricing: PricingPreview as React.ComponentType<PreviewProps>,
  spacer: SpacerPreview as React.ComponentType<PreviewProps>,
  container: ContainerPreview as React.ComponentType<PreviewProps>,
  text: TextPreview as React.ComponentType<PreviewProps>,
  image: ImagePreview as React.ComponentType<PreviewProps>,
};
