import Text from "./Text.astro";
import ImageBlock from "./Image.astro";
import TextEditor from "./TextEditor.astro";
import Video from "./Video.astro";
import Button from "./Button.astro";
import Icon from "./Icon.astro";
import Html from "./Html.astro";
import DividerSpacer from "./DividerSpacer.astro";
import LayoutRenderer from "./LayoutRenderer.astro";

export { getBuilderLayout } from "./db.js";
export { LayoutRenderer };
export { default as BuilderWrapper } from "./BuilderWrapper.astro";

export const blockComponents: Record<string, unknown> = {
  text: Text,
  image: ImageBlock,
  "text-editor": TextEditor,
  video: Video,
  button: Button,
  icon: Icon,
  html: Html,
  "divider-spacer": DividerSpacer,
};
