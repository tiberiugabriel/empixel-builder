import Testimonials from "./Testimonials.astro";
import FaqSection from "./FaqSection.astro";
import PricingSection from "./PricingSection.astro";
import SpacerSection from "./SpacerSection.astro";
import Text from "./Text.astro";
import ImageBlock from "./Image.astro";
import LayoutRenderer from "./LayoutRenderer.astro";

export { getBuilderLayout } from "./db.js";
export { LayoutRenderer };
export { default as BuilderWrapper } from "./BuilderWrapper.astro";

export const blockComponents: Record<string, unknown> = {
  testimonials: Testimonials,
  faq: FaqSection,
  pricing: PricingSection,
  spacer: SpacerSection,
  text: Text,
  image: ImageBlock,
};
