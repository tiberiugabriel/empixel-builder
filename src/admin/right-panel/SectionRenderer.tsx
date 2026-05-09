import React, { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import type { BreakpointId, SectionBlock, IconGroupValue } from "../../types.js";
import type { StyleSection } from "../blockDefinitions.js";
import { ThemeStyleToggle } from "../controls/ThemeStyleToggle.js";
import { IconGroup } from "../controls/IconGroup.js";
import {
  AlignmentSection,
  TypographySection,
  TextStrokeSection,
  TextShadowSection,
  BlendModeSection,
  FilterSection,
  OverflowSection,
  SpacingSection,
} from "./sections/BpAwareStyleSections.js";
import {
  BorderRadiusSection,
  BorderSection,
  BoxShadowSection,
} from "./sections/StatefulStyleSection.js";
import { OpacitySection } from "./sections/OpacitySection.js";
import { ImgVisualSection } from "./sections/ImgVisualSection.js";
import { VideoSourceSection } from "./sections/VideoSourceSection.js";
import { DividerLineSection } from "./sections/DividerLineSection.js";

/**
 * F4.3 — `BackgroundSection` pulls in `BackgroundControl` (~939 LOC,
 * the heaviest control in the admin bundle) plus the helpers it
 * exports (`parseBackground` / `serializeBackground`). Lazy-import
 * the wrapper here so the entire branch only loads when the active
 * block exposes a `kind: "background"` style section AND the user
 * actually opens the Style tab. Most blocks open the Right panel on
 * the Fields tab — the Background chunk never enters the initial
 * graph for those flows.
 */
const BackgroundSection = lazy(() =>
  import("./sections/BackgroundSection.js").then((m) => ({
    default: m.BackgroundSection,
  })),
);

/**
 * Pure dispatcher for the declarative Style tab (F3.5.3).
 *
 * Maps each `StyleSection.kind` to the matching control under
 * `controls/` (or one of the extracted wrappers under `sections/`).
 * No business logic — just a switch. F3.5.6 wires it into
 * `RightPanel.tsx`'s Style tab and deletes the imperative branches.
 *
 * Exhaustiveness: the `default` branch calls `assertNever(section)` so
 * adding a new variant to the `StyleSection` discriminated union
 * causes a TypeScript error here until a matching case is added.
 */

export interface SectionRendererProps {
  section: StyleSection;
  block: SectionBlock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (next: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
}

function assertNever(_x: never): never {
  throw new Error("SectionRenderer: unhandled StyleSection.kind");
}

export function SectionRenderer({ section, block, onChange, activeBreakpoint }: SectionRendererProps): ReactNode {
  const common = { block, onChange, activeBreakpoint };
  switch (section.kind) {
    case "theme": {
      const theme = (block.config.theme as string) || "light";
      return <ThemeStyleToggle theme={theme} onChange={(v) => onChange({ theme: v })} />;
    }
    case "spacing":
      return <SpacingSection {...common} targets={section.targets} />;
    case "background":
      return (
        <Suspense
          fallback={
            <div
              className="epx-bg-ctrl epx-bg-ctrl--loading"
              aria-busy="true"
              style={{ minHeight: 220 }}
            />
          }
        >
          <BackgroundSection {...common} modes={section.modes} />
        </Suspense>
      );
    case "border":
      return <BorderSection {...common} />;
    case "borderRadius":
      return <BorderRadiusSection {...common} />;
    case "boxShadow":
      return <BoxShadowSection {...common} />;
    case "typography":
      // section.props (typography subset filter) is not yet wired into
      // TypographyControl — F3.5.6 may extend the control or apply it
      // here. Until then we render the full stack.
      void section.props;
      return <TypographySection {...common} />;
    case "textStroke":
      return <TextStrokeSection {...common} />;
    case "textShadow":
      return <TextShadowSection {...common} />;
    case "alignment":
      return <AlignmentSection {...common} />;
    case "blendMode":
      return <BlendModeSection {...common} />;
    case "filter":
      return <FilterSection {...common} />;
    case "overflow":
      return <OverflowSection {...common} />;
    case "opacity":
      return <OpacitySection {...common} />;
    case "imgVisual":
      return <ImgVisualSection {...common} />;
    case "videoSource":
      return <VideoSourceSection {...common} />;
    case "iconGroup": {
      // Style-tab IconGroup section. No block currently declares this;
      // the schema reserves it for future icon/button/divider Style-tab
      // pickers. Reads from `block.config.icon` and writes back via
      // onChange.
      const value = (block.config.icon ?? {}) as IconGroupValue;
      return <IconGroup value={value} onChange={(v: IconGroupValue) => onChange({ icon: v })} />;
    }
    case "dividerLine":
      return <DividerLineSection {...common} />;
    case "custom":
      return section.render({ block, onChange, activeBreakpoint });
    default:
      return assertNever(section);
  }
}
