# empixel-builder — Block Previews

## Role
Live preview components in the admin UI Canvas. Show real-time feedback as users edit block properties.

## Architecture

```
src/admin/previews/
├─ index.ts                    # PREVIEW_COMPONENTS map export
├─ TestimonialsPreview.tsx
├─ FaqPreview.tsx
├─ PricingPreview.tsx
├─ ContainerPreview.tsx
├─ SpacerPreview.tsx
├─ TextPreview.tsx
└─ ImagePreview.tsx
```

## Preview Registration (index.ts)

```ts
export interface PreviewProps {
  config: Record<string, unknown>;
  children?: SectionBlock[];
  slots?: SectionBlock[][];
}

export const PREVIEW_COMPONENTS: Record<BlockType, React.ComponentType<PreviewProps>> = {
  testimonials: TestimonialsPreview,
  faq: FaqPreview,
  pricing: PricingPreview,
  spacer: SpacerPreview,
  container: ContainerPreview,
  text: TextPreview,
  image: ImagePreview,
};
```

Every `BlockType` in `types.ts` must have an entry here.

## Preview Pattern

Each preview receives `PreviewProps` (not the full `SectionBlock`):

```tsx
export function TestimonialsPreview({ config, children, slots }: PreviewProps) {
  return (
    <div className="epx-preview-testimonials">
      <h3>{(config.headline as string) || "Testimonials"}</h3>
      {/* Render based on config values */}
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

## Current Previews (7)

1. **TestimonialsPreview** — Grid/carousel of testimonial cards
2. **FaqPreview** — Accordion items list
3. **PricingPreview** — Pricing tiers grid
4. **ContainerPreview** — Renders children recursively via PREVIEW_COMPONENTS
5. **SpacerPreview** — Height indicator bar
6. **TextPreview** — Renders `config.content` with the chosen `htmlTag`
7. **ImagePreview** — Renders `config.image` (via `/_emdash/api/media/file/<storageKey>`) with caption + link

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
