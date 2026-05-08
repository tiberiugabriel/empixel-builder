# empixel-builder — Block Previews

## Role
Live preview components in the admin UI Canvas. Show real-time feedback as users edit block properties.

## Architecture

```
src/admin/previews/
├─ index.ts                    # PREVIEW_COMPONENTS map export (9 entries)
├─ ContainerPreview.tsx
├─ TextPreview.tsx
├─ ImagePreview.tsx
├─ TextEditorPreview.tsx       # v0.6 — column-count + drop cap, plain-text fallback
├─ VideoPreview.tsx            # v0.6 — aspect-ratio framed; image overlay if set
├─ ButtonPreview.tsx           # v0.6 — flex direction follows iconPosition
├─ IconPreview.tsx             # v0.6 — img w/ size + rotate transform
├─ HtmlPreview.tsx             # v0.6 — dangerouslySetInnerHTML mirrors frontend
└─ DividerSpacerPreview.tsx    # v0.6 — fixed-height block + optional divider line + icon
```

## Preview Registration (index.ts)

```ts
export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
  activeBreakpoint?: BreakpointId; // v0.6+ — Canvas passes this so previews can bp-merge config
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  container: ContainerPreview,
  text: TextPreview,
  image: ImagePreview,
  "text-editor": TextEditorPreview,
  video: VideoPreview,
  button: ButtonPreview,
  icon: IconPreview,
  html: HtmlPreview,
  "divider-spacer": DividerSpacerPreview,
};
```

Every `BlockType` in `types.ts` must have an entry here.

## Preview Pattern

Each preview receives `PreviewProps` (not the full `SectionBlock`):

```tsx
export function TextPreview({ config }: PreviewProps) {
  return (
    <div className="epx-preview-text">
      {(config.content as string) || "Empty text block"}
    </div>
  );
}
```

## Key Principles

### Live Updates
Previews **must reflect config changes in real time**. No hardcoded values.

❌ Bad:
```tsx
<h2>Default CTA Title</h2>
```

✅ Good:
```tsx
<h2>{(config.headline as string) || "CTA Section"}</h2>
```

### Minimal Component
- Only render what matters for preview (structure, not full HTML)
- Omit business logic
- No data fetching, no side effects

### Props (PreviewProps)
- `config` — `block.config` (flat object)
- `children` — child blocks (for container)
- `slots` — slot arrays (for columns)

## Current Previews (9)

1. **ContainerPreview** — Renders children recursively via PREVIEW_COMPONENTS
2. **TextPreview** — Renders `config.content` with the chosen `htmlTag`
3. **ImagePreview** — Renders `config.image` (via `/_emdash/api/media/file/<storageKey>`) with caption + link
4. **TextEditorPreview** (v0.6) — Joins Portable Text content as plain text, applies column-count + optional drop cap
5. **VideoPreview** (v0.6) — Aspect-ratio framed div; renders overlay image if set; centered ▶ marker
6. **ButtonPreview** (v0.6) — Inline-flex `<button>` with text + optional icon; `flex-direction` follows `iconPosition`
7. **IconPreview** (v0.6) — Aligned `<img>` with size + rotate transform
8. **HtmlPreview** (v0.6) — `dangerouslySetInnerHTML` mirrors frontend trusted-input behavior
9. **DividerSpacerPreview** (v0.6) — Fixed-height block; if divider active, inline-flex line(s) + optional centered icon

(SpacerPreview removed in v0.6 — replaced by DividerSpacerPreview after one-time DB migration.)
(TestimonialsPreview / FaqPreview / PricingPreview removed post-v0.6 — variant B, no DB migration. Old layouts that still contain those types render no preview and show "Unknown block" placeholder.)

## v0.6+ — TextEditorPreview / HtmlPreview

- **TextEditorPreview** receives `activeBreakpoint` and bp-merges `dropCap`, `columns`, `columnsCustom`, `columnsGap` from `configBreakpoints[activeBreakpoint]`, plus drop-cap settings + paragraph spacing + link color from `styleBreakpoints[activeBreakpoint]`. Renders Portable Text via mini renderer (paragraph/heading/marks/image type) so canvas reflects actual formatting; no longer just plain text.
- **HtmlPreview** also renders inside iframe with `sandbox="allow-scripts allow-same-origin"`. Auto-resize via `useEffect` reads `iframe.contentDocument` after `load` + `ResizeObserver` + `MutationObserver` + img loads. Iframe collapsed to `0px` before measuring to defeat `vh`/`100%` body height feedback loops.

## Container Preview Pattern

```tsx
export function ContainerPreview({ config, children }: PreviewProps) {
  return (
    <div className="epx-container-preview" style={{ padding: "8px" }}>
      {children?.map((child) => {
        const ChildPreview = PREVIEW_COMPONENTS[child.type];
        if (!ChildPreview) return null;
        return (
          <ChildPreview
            key={child.id}
            config={child.config}
            children={child.children}
            slots={child.slots}
          />
        );
      })}
    </div>
  );
}
```

## How Canvas Uses Previews

Canvas looks up preview by `block.type`:

```tsx
const Preview = PREVIEW_COMPONENTS[block.type];
if (!Preview) return null;
return (
  <Preview
    config={block.config}
    children={block.children}
    slots={block.slots}
  />
);
```

## Styling Previews

Read theme/style from config:

```tsx
const bgColor = (config.style as Record<string, string>)?.backgroundColor || "transparent";
<div style={{ backgroundColor: bgColor }}>
```

Or use theme class:
```tsx
<div className={`theme-${(config.theme as string) || "light"}`}>
```

## TODO

- [ ] Create previews for all new blocks (1:1 with blockDefinitions additions):
  - HeroPreview
  - FeaturesGridPreview
  - ImageTextPreview
  - CtaPreview
  - StatsPreview
  - GalleryPreview
  - ColumnsPreview
  - HeadingPreview
  - ParagraphPreview
- [ ] Add preview CSS file (previews.css) for scoped preview styling
- [ ] Make previews respond to style changes (read from `config.style`)
- [ ] Test nested container preview rendering (3+ levels)
