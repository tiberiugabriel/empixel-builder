import React, { useRef, useState } from "react";
import type { SectionBlock, BreakpointId, BreakpointsConfig } from "../types.js";
import { BREAKPOINT_DEFS } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { getBpIcon } from "./components/BreakpointIcons.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";
import { SpacingControl, SideInput, parseSide, serializeSide, type SpacingValue, type SideValue, type SpacingKeys } from "./controls/SpacingControl.js";
import { BorderRadiusControl, parseRadius, serializeRadius, type RadiusValue } from "./controls/BorderRadiusControl.js";
import { BorderControl, parseBorder, serializeBorder, type BorderConfig } from "./controls/BorderControl.js";
import { BoxShadowControl, parseShadow, serializeShadow, type BoxShadowConfig } from "./controls/BoxShadowControl.js";
import { FieldGroup, SelectRow, TextRow, NumberRow, DimensionControl, IconButtonRow } from "./controls/FieldRow.js";
import { BackgroundControl, parseBackground, serializeBackground } from "./controls/BackgroundControl.js";
import { GapControl, parseGap, serializeGap, type GapValue } from "./controls/GapControl.js";
import { LayoutControl, parseLayout } from "./controls/LayoutControl.js";
import { OverflowControl, parseOverflow, serializeOverflow, type OverflowValue } from "./controls/OverflowControl.js";
import { LinkControl, parseLink, serializeLink, type LinkValue } from "./controls/LinkControl.js";
import { MediaPicker, type MediaRef } from "./controls/MediaPicker.js";
import { ImagePreviewCard } from "./controls/ImagePreviewCard.js";
import { ThemeStyleToggle, getThemeStyleKey } from "./controls/ThemeStyleToggle.js";
import { AlignControl, parseAlign, serializeAlign, type AlignValue } from "./controls/AlignControl.js";
import { TypographyControl, parseTypography, serializeTypography, type TypographyValue } from "./controls/TypographyControl.js";
import { TextStrokeControl, parseTextStroke, serializeTextStroke, type TextStrokeValue } from "./controls/TextStrokeControl.js";
import { TextShadowControl, parseTextShadow, serializeTextShadow, type TextShadowValue } from "./controls/TextShadowControl.js";
import { BlendModeControl, parseBlendMode, serializeBlendMode, type BlendModeValue } from "./controls/BlendModeControl.js";
import { CodeEditor } from "./controls/CodeEditor.js";
import { NumberWithUnits } from "./controls/NumberWithUnits.js";
import { ColorNormalHover } from "./controls/ColorNormalHover.js";
import { IconGroup } from "./controls/IconGroup.js";
import { CssFiltersControl, parseFilter, serializeFilter, type CssFiltersValue } from "./controls/CssFiltersControl.js";
import { VideoSourceControl } from "./controls/VideoSourceControl.js";
import { ColorPicker, getColorDisplay, type ColorFormat } from "./controls/ColorPicker.js";
import type { VideoSourceValue, VideoOverlayValue, DividerConfig, DividerStyle, DividerGradient, DividerGradientStop } from "../types.js";

interface Props {
  block: SectionBlock | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (config: Record<string, any>) => void;
  activeBreakpoint: BreakpointId;
  breakpointsConfig: BreakpointsConfig;
}

function getEffectiveBpPx(bpId: BreakpointId, config: BreakpointsConfig): number {
  const override = config.overrides.find((o) => o.id === bpId);
  if (override) return override.px;
  return BREAKPOINT_DEFS.find((b) => b.id === bpId)?.defaultPx ?? 992;
}

// ─── Tab icons (inline SVG) ───────────────────────────────────────────────────

function IconFields() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="6.75" width="13" height="1.5" rx="0.75" fill="currentColor"/>
      <rect x="1" y="10.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
    </svg>
  );
}

function IconStyle() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7.5 1.5C7.5 1.5 11.5 4.5 11.5 7.5C11.5 9.71 9.71 11.5 7.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconAdvanced() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
      <path d="m22,13.25v-2.5l-2.318-.966c-.167-.581-.395-1.135-.682-1.654l.954-2.318-1.768-1.768-2.318.954c-.518-.287-1.073-.515-1.654-.682l-.966-2.318h-2.5l-.966,2.318c-.581.167-1.135.395-1.654.682l-2.318-.954-1.768,1.768.954,2.318c-.287.518-.515,1.073-.682,1.654l-2.318.966v2.5l2.318.966c.167.581.395,1.135.682,1.654l-.954,2.318,1.768,1.768,2.318-.954c.518.287,1.073.515,1.654.682l.966,2.318h2.5l.966-2.318c.581-.167,1.135-.395,1.654-.682l2.318.954,1.768-1.768-.954-2.318c.287-.518.515-1.073.682-1.654l2.318-.966Z" fill="none" stroke="currentColor" strokeLinecap="square" strokeMiterlimit="10" strokeWidth="2"/>
    </svg>
  );
}

// ─── State & theme icons ──────────────────────────────────────────────────────

function IconStateNormal() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="6.5" r="3" fill="currentColor"/>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35"/>
    </svg>
  );
}

function IconStateHover() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2.5L3 10L5.5 7.5L7 11L8.5 10.4L7 7H10.5L3 2.5Z" fill="currentColor" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Advanced Tab ─────────────────────────────────────────────────────────────

type AdvancedConfig = {
  position?: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  zIndex?: number | string;
  cssId?: string;
  cssClasses?: string;
  customCss?: string;
};

// ─── Divider ──────────────────────────────────────────────────────────────────

export function PanelDivider() {
  return <div className="epx-panel-divider" />;
}

const HTML_TAG_OPTIONS = [
  { value: "",        label: "Default (div)" },
  { value: "div",     label: "div" },
  { value: "header",  label: "header" },
  { value: "footer",  label: "footer" },
  { value: "main",    label: "main" },
  { value: "article", label: "article" },
  { value: "section", label: "section" },
  { value: "aside",   label: "aside" },
  { value: "nav",     label: "nav" },
  { value: "a",       label: "a (link)" },
];

const RESOLUTION_OPTIONS = [
  { value: "full",      label: "Full (original)" },
  { value: "thumbnail", label: "Thumbnail (150 × 150)" },
  { value: "medium",    label: "Medium (300 × 300)" },
  { value: "large",     label: "Large (1024 × 1024)" },
];

const OBJECT_FIT_OPTIONS = [
  { value: "",           label: "Default" },
  { value: "contain",    label: "Contain" },
  { value: "cover",      label: "Cover" },
  { value: "fill",       label: "Fill" },
  { value: "none",       label: "None" },
  { value: "scale-down", label: "Scale Down" },
];

const OBJECT_POSITION_OPTIONS = [
  { value: "",              label: "Default" },
  { value: "center",        label: "Center" },
  { value: "top",           label: "Top" },
  { value: "right",         label: "Right" },
  { value: "bottom",        label: "Bottom" },
  { value: "left",          label: "Left" },
  { value: "top left",      label: "Top Left" },
  { value: "top right",     label: "Top Right" },
  { value: "bottom left",   label: "Bottom Left" },
  { value: "bottom right",  label: "Bottom Right" },
];

const IMAGE_ALIGN_OPTIONS = [
  {
    value: "start", title: "Start",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="2" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "center", title: "Center",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="4.5" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
  {
    value: "end", title: "End",
    icon: <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4"/><rect x="7" y="4" width="5" height="6" rx="0.75" fill="currentColor"/></svg>,
  },
];

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

const POSITION_OPTIONS = [
  { value: "", label: "Default" },
  { value: "relative", label: "Relative" },
  { value: "absolute", label: "Absolute" },
  { value: "fixed", label: "Fixed" },
  { value: "sticky", label: "Sticky" },
];

function AdvancedTab({
  value,
  onChange,
  blockId,
  widthValues,
  heightValues,
  paddingValue,
  marginValue,
  onDimension,
  onSpacing,
  onResetWidth,
  onResetHeight,
}: {
  value: AdvancedConfig;
  onChange: (v: AdvancedConfig) => void;
  blockId: string;
  widthValues: { fix: SideValue; min: SideValue; max: SideValue };
  heightValues: { fix: SideValue; min: SideValue; max: SideValue };
  paddingValue: SpacingValue;
  marginValue: SpacingValue;
  onDimension: (axis: "width" | "height", key: "fix" | "min" | "max", sv: SideValue) => void;
  onSpacing: (key: string, val: SpacingValue) => void;
  onResetWidth: () => void;
  onResetHeight: () => void;
}) {
  const set = (key: keyof AdvancedConfig, val: unknown) =>
    onChange({ ...value, [key]: val });

  const selector = `[data-epx-block="${blockId}"]`;

  const zIndexNum = typeof value.zIndex === "number" ? value.zIndex : (value.zIndex ? Number(value.zIndex) : undefined);

  const hasPosition = !!value.position;

  const offsetValue: SpacingValue = {
    top:    parseSide(value.top),
    right:  parseSide(value.right),
    bottom: parseSide(value.bottom),
    left:   parseSide(value.left),
  };

  const handleOffset = (v: SpacingValue) => {
    const sides: SpacingKeys[] = ["top", "right", "bottom", "left"];
    const next: Partial<AdvancedConfig> = {};
    sides.forEach((s) => {
      next[s] = v[s] ? serializeSide(v[s] as SideValue) : undefined;
    });
    onChange({ ...value, ...next });
  };

  return (
    <div className="epx-right-panel__fields">
      <DimensionControl
        label="Width"
        values={widthValues}
        onChange={(key, v) => onDimension("width", key, v)}
        onReset={onResetWidth}
      />
      <DimensionControl
        label="Height"
        values={heightValues}
        onChange={(key, v) => onDimension("height", key, v)}
        onReset={onResetHeight}
      />
      <SpacingControl
        label="Padding"
        value={paddingValue}
        onChange={(v) => onSpacing("padding", v)}
        sides={["top", "right", "bottom", "left"]}
      />
      <SpacingControl
        label="Margin"
        value={marginValue}
        onChange={(v) => onSpacing("margin", v)}
        sides={["top", "right", "bottom", "left"]}
      />
      <PanelDivider />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <FieldGroup
          isDirty={!!value.position}
          onReset={() => onChange({ ...value, position: "", top: undefined, right: undefined, bottom: undefined, left: undefined })}
        >
          <SelectRow
            label="Position"
            value={value.position ?? ""}
            onChange={(v) => set("position", v)}
            options={POSITION_OPTIONS}
            labelClassName="epx-row-label--section"
          />
        </FieldGroup>

        {hasPosition && (
          <SpacingControl
            label="Offset"
            value={offsetValue}
            onChange={handleOffset}
            sides={["top", "right", "bottom", "left"]}
            forceExpanded
          />
        )}
      </div>

      <FieldGroup
        isDirty={zIndexNum !== undefined}
        onReset={() => set("zIndex", undefined)}
      >
        <NumberRow
          label="Z-Index"
          value={zIndexNum}
          onChange={(v) => set("zIndex", v)}
          labelClassName="epx-row-label--section"
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!value.cssId}
        onReset={() => set("cssId", "")}
      >
        <TextRow
          label="CSS ID"
          value={value.cssId ?? ""}
          onChange={(v) => set("cssId", v)}
          placeholder="#"
          labelClassName="epx-row-label--color"
        />
      </FieldGroup>

      <FieldGroup
        isDirty={!!value.cssClasses}
        onReset={() => set("cssClasses", "")}
      >
        <TextRow
          label="CSS Classes"
          value={value.cssClasses ?? ""}
          onChange={(v) => set("cssClasses", v)}
          placeholder="."
          labelClassName="epx-row-label--color"
        />
      </FieldGroup>

      <div className="epx-field">
        <label className="epx-field__label">Custom CSS</label>
        <CodeEditor
          value={value.customCss ?? ""}
          onChange={(v) => set("customCss", v)}
          language="css"
          selectorHeader={selector}
        />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = "fields" | "style" | "advanced";

export function RightPanel({ block, onChange, activeBreakpoint, breakpointsConfig }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("fields");
  const [radiusMode, setRadiusMode] = useState<"normal" | "hover">("normal");
  const [borderMode, setBorderMode] = useState<"normal" | "hover">("normal");
  const [shadowMode, setShadowMode] = useState<"normal" | "hover">("normal");
  const [bgMode, setBgMode] = useState<"normal" | "hover">("normal");
  const [opacityMode, setOpacityMode] = useState<"normal" | "hover">("normal");
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [videoOverlayPickerOpen, setVideoOverlayPickerOpen] = useState(false);
  const [divColorOpen, setDivColorOpen] = useState(false);
  const [divColorPos, setDivColorPos] = useState({ top: 0, left: 0 });
  const [divColorFormat, setDivColorFormat] = useState<ColorFormat>("HEX");
  const divColorSwatchRef = useRef<HTMLButtonElement>(null);
  const [divGradPickerKey, setDivGradPickerKey] = useState<number | null>(null);
  const [divGradPickerPos, setDivGradPickerPos] = useState({ top: 0, left: 0 });
  const [divGradColorFormat, setDivGradColorFormat] = useState<ColorFormat>("HEX");
  const [trackedId, setTrackedId] = useState(block?.id);

  if (block?.id !== trackedId) {
    setTrackedId(block?.id);
    setRadiusMode("normal");
    setBorderMode("normal");
    setShadowMode("normal");
    setBgMode("normal");
    setOpacityMode("normal");
    setImagePickerOpen(false);
    setVideoOverlayPickerOpen(false);
    setDivColorOpen(false);
    setDivGradPickerKey(null);
  }

  if (!block) {
    return (
      <aside className="epx-right-panel epx-right-panel--empty">
        <div className="epx-right-panel__placeholder">
          <div className="epx-right-panel__placeholder-icon">👈</div>
          <p>Select a block on the canvas to edit its settings</p>
        </div>
      </aside>
    );
  }

  const def = getBlockDef(block.type);
  if (!def) return null;

  const theme = (block.config.theme as string) || "light";
  const handleTheme = (v: string) => onChange({ theme: v });
  const activeStyleKey = getThemeStyleKey(theme);
  const activeStyle = (block.config[activeStyleKey] ?? {}) as Record<string, unknown>;

  const style = (block.config.style ?? {}) as Record<string, unknown>;
  const advanced = (block.config.advanced ?? {}) as AdvancedConfig;

  const paddingValue: SpacingValue = {
    top:    parseSide(style.paddingTop),
    right:  parseSide(style.paddingRight),
    bottom: parseSide(style.paddingBottom),
    left:   parseSide(style.paddingLeft),
  };

  const marginValue: SpacingValue = {
    top:    parseSide(style.marginTop),
    right:  parseSide(style.marginRight),
    bottom: parseSide(style.marginBottom),
    left:   parseSide(style.marginLeft),
  };

  const handleSpacing = (key: string, val: SpacingValue) => {
    const prefix = key === "padding" ? "padding" : "margin";
    const next: Record<string, unknown> = { ...style };
    Object.entries(val).forEach(([side, sv]) => {
      const cssKey = `${prefix}${side.charAt(0).toUpperCase()}${side.slice(1)}`;
      next[cssKey] = serializeSide(sv as SideValue);
    });
    onChange({ style: next });
  };

  const widthValues = {
    fix: parseSide(style.width),
    min: parseSide(style.minWidth),
    max: parseSide(style.maxWidth),
  };
  const heightValues = {
    fix: parseSide(style.height),
    min: parseSide(style.minHeight),
    max: parseSide(style.maxHeight),
  };
  const CSS_KEYS = {
    width:  { fix: "width",  min: "minWidth",  max: "maxWidth"  },
    height: { fix: "height", min: "minHeight", max: "maxHeight" },
  } as const;
  const handleDimension = (axis: "width" | "height", key: "fix" | "min" | "max", sv: SideValue) => {
    onChange({ style: { ...style, [CSS_KEYS[axis][key]]: serializeSide(sv) } });
  };

  const styleHover = (block.config.styleHover ?? {}) as Record<string, unknown>;
  const styleBreakpoints = (block.config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const styleHoverBreakpoints = (block.config.styleHoverBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const isNonDesktop = activeBreakpoint !== "desktop";
  const bpStyleRaw = isNonDesktop ? (styleBreakpoints[activeBreakpoint] ?? {}) : {};
  const bpHoverRaw = isNonDesktop ? (styleHoverBreakpoints[activeBreakpoint] ?? {}) : {};

  const breakpointIndicator = (
    <span className="epx-bp-label-icon" title={activeBreakpoint}>{getBpIcon(activeBreakpoint)}</span>
  );

  const writeBpStyle = (patch: Record<string, unknown>) => {
    const px = getEffectiveBpPx(activeBreakpoint, breakpointsConfig);
    const current = styleBreakpoints[activeBreakpoint] ?? {};
    onChange({ styleBreakpoints: { ...styleBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...patch } } });
  };

  const writeBpHoverStyle = (patch: Record<string, unknown>) => {
    const px = getEffectiveBpPx(activeBreakpoint, breakpointsConfig);
    const current = styleHoverBreakpoints[activeBreakpoint] ?? {};
    onChange({ styleHoverBreakpoints: { ...styleHoverBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...patch } } });
  };

  // Per-breakpoint overrides for top-level config keys (non-CSS fields like
  // dropCap, columns, columnsGap). Mirrors `writeBpStyle`/`bpStyleRaw` but
  // targets `block.config.configBreakpoints[bpId]`.
  const configBreakpoints = (block.config.configBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const bpConfigRaw = isNonDesktop ? (configBreakpoints[activeBreakpoint] ?? {}) : {};
  const writeBpConfig = (patch: Record<string, unknown>) => {
    const px = getEffectiveBpPx(activeBreakpoint, breakpointsConfig);
    const current = configBreakpoints[activeBreakpoint] ?? {};
    onChange({ configBreakpoints: { ...configBreakpoints, [activeBreakpoint]: { ...current, _px: px, ...patch } } });
  };

  const radiusSource = isNonDesktop
    ? (radiusMode === "hover" ? { ...styleHover, ...bpHoverRaw } : { ...activeStyle, ...bpStyleRaw })
    : (radiusMode === "hover" ? styleHover : activeStyle);
  const radiusValue: RadiusValue = parseRadius(radiusSource);
  const handleRadius = (val: RadiusValue) => {
    if (isNonDesktop && radiusMode === "hover") {
      writeBpHoverStyle(serializeRadius(val));
    } else if (isNonDesktop) {
      writeBpStyle(serializeRadius(val));
    } else if (radiusMode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serializeRadius(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serializeRadius(val) } });
    }
  };

  const borderSource = isNonDesktop
    ? (borderMode === "hover" ? { ...styleHover, ...bpHoverRaw } : { ...activeStyle, ...bpStyleRaw })
    : (borderMode === "hover" ? styleHover : activeStyle);
  const borderValue: BorderConfig = parseBorder(borderSource);
  const handleBorder = (val: BorderConfig) => {
    if (isNonDesktop && borderMode === "hover") {
      writeBpHoverStyle(serializeBorder(val));
    } else if (isNonDesktop) {
      writeBpStyle(serializeBorder(val));
    } else if (borderMode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serializeBorder(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serializeBorder(val) } });
    }
  };

  const shadowSource = isNonDesktop
    ? (shadowMode === "hover" ? { ...styleHover, ...bpHoverRaw } : { ...activeStyle, ...bpStyleRaw })
    : (shadowMode === "hover" ? styleHover : activeStyle);
  const shadowValue: BoxShadowConfig = parseShadow(shadowSource);
  const handleShadow = (val: BoxShadowConfig) => {
    if (isNonDesktop && shadowMode === "hover") {
      writeBpHoverStyle(serializeShadow(val));
    } else if (isNonDesktop) {
      writeBpStyle(serializeShadow(val));
    } else if (shadowMode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serializeShadow(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serializeShadow(val) } });
    }
  };

  const bgValue = parseBackground(bgMode === "hover" ? styleHover : activeStyle);
  const handleBackground = (val: ReturnType<typeof parseBackground>) => {
    if (bgMode === "hover") {
      onChange({ styleHover: { ...styleHover, ...serializeBackground(val) } });
    } else {
      onChange({ [activeStyleKey]: { ...activeStyle, ...serializeBackground(val) } });
    }
  };

  const gapSource = isNonDesktop ? { ...style, ...bpStyleRaw } : style;
  const gapValue: GapValue = parseGap(gapSource);
  const handleGap = (val: GapValue) => {
    if (isNonDesktop) {
      writeBpStyle(serializeGap(val));
    } else {
      onChange({ style: { ...style, ...serializeGap(val) } });
    }
  };

  const overflowValue: OverflowValue = parseOverflow(style);
  const handleOverflow = (val: OverflowValue) => {
    onChange({ style: { ...style, ...serializeOverflow(val) } });
  };

  const linkValue: LinkValue = parseLink(block.config);
  const handleLink = (val: LinkValue) => onChange(serializeLink(val));

  const typoSource = isNonDesktop ? { ...style, ...bpStyleRaw } : style;

  const alignValue: AlignValue = parseAlign(typoSource);
  const handleAlign = (val: AlignValue) => {
    if (isNonDesktop) writeBpStyle(serializeAlign(val));
    else onChange({ style: { ...style, ...serializeAlign(val) } });
  };

  const typographyValue: TypographyValue = parseTypography(typoSource);
  const handleTypography = (val: TypographyValue) => {
    if (isNonDesktop) writeBpStyle(serializeTypography(val));
    else onChange({ style: { ...style, ...serializeTypography(val) } });
  };

  const strokeValue: TextStrokeValue = parseTextStroke(typoSource);
  const handleStroke = (val: TextStrokeValue) => {
    if (isNonDesktop) writeBpStyle(serializeTextStroke(val));
    else onChange({ style: { ...style, ...serializeTextStroke(val) } });
  };

  const shadowTextValue: TextShadowValue = parseTextShadow(typoSource);
  const handleTextShadow = (val: TextShadowValue) => {
    if (isNonDesktop) writeBpStyle(serializeTextShadow(val));
    else onChange({ style: { ...style, ...serializeTextShadow(val) } });
  };

  const blendModeValue: BlendModeValue = parseBlendMode(typoSource);
  const handleBlendMode = (val: BlendModeValue) => {
    if (isNonDesktop) writeBpStyle(serializeBlendMode(val));
    else onChange({ style: { ...style, ...serializeBlendMode(val) } });
  };

  const hideStyleTab = block.type === "html";

  const TABS: { id: Tab; icon: React.ReactNode; title: string }[] = [
    { id: "fields", icon: <IconFields />, title: "Fields" },
    ...(hideStyleTab ? [] : [{ id: "style" as Tab, icon: <IconStyle />, title: "Style" }]),
    { id: "advanced", icon: <IconAdvanced />, title: "Advanced" },
  ];

  // If style tab is hidden but currently active, switch to fields.
  if (hideStyleTab && activeTab === "style") {
    setActiveTab("fields");
  }

  return (
    <aside className="epx-right-panel">
      <div className="epx-right-panel__header">
        <span className="epx-right-panel__icon">{def.icon}</span>
        <h2 className="epx-right-panel__title">{def.label}</h2>
      </div>
      <p className="epx-right-panel__description">{def.description}</p>

      <div className="epx-right-panel__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`epx-right-panel__tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {activeTab === "fields" && (
        <div className="epx-right-panel__fields">
          {def.fields
            .filter((field) => !field.showWhen || block.config[field.showWhen.key] === field.showWhen.value)
            .map((field) => (
              <FieldRenderer
                key={field.key}
                field={field}
                value={block.config[field.key]}
                isDirty={JSON.stringify(block.config[field.key]) !== JSON.stringify(def.defaultConfig[field.key])}
                onChange={(val) => onChange({ [field.key]: val })}
              />
            ))}
          {block.type === "text-editor" && (() => {
            // Effective per-breakpoint reads — bp override falls back to base.
            const baseDropCap = !!block.config.dropCap;
            const baseColumns = (block.config.columns as string) ?? "1";
            const baseColumnsCustom = block.config.columnsCustom as number | undefined;
            const baseColumnsGap = (block.config.columnsGap as string) ?? "0px";
            const eff = isNonDesktop ? { ...block.config, ...bpConfigRaw } : block.config;
            const effDropCap = !!eff.dropCap;
            const effColumns = (eff.columns as string) ?? "1";
            const effColumnsCustom = eff.columnsCustom as number | undefined;
            const effColumnsGap = (eff.columnsGap as string) ?? "0px";

            const setKey = (key: string, val: unknown) => {
              if (isNonDesktop) writeBpConfig({ [key]: val });
              else onChange({ [key]: val });
            };

            const dropCapDirty = isNonDesktop
              ? bpConfigRaw.dropCap !== undefined
              : baseDropCap;
            const columnsDirty = isNonDesktop
              ? bpConfigRaw.columns !== undefined || bpConfigRaw.columnsCustom !== undefined
              : baseColumns !== "1" || baseColumnsCustom !== undefined;
            const columnsGapDirty = isNonDesktop
              ? bpConfigRaw.columnsGap !== undefined
              : !!baseColumnsGap && baseColumnsGap !== "0px";

            return (
              <>
                {/* Drop Cap toggle (bp-aware) */}
                <FieldGroup
                  isDirty={dropCapDirty}
                  onReset={() => {
                    if (isNonDesktop) writeBpConfig({ dropCap: undefined });
                    else onChange({ dropCap: false });
                  }}
                >
                  <div className="epx-side-input">
                    <span className="epx-side-input__label epx-side-input__label--row epx-row-label--section">Drop Cap</span>
                    {breakpointIndicator}
                    <label className="epx-toggle" style={{ marginLeft: "auto", paddingRight: 8 }}>
                      <input
                        type="checkbox"
                        checked={effDropCap}
                        onChange={(e) => setKey("dropCap", e.target.checked)}
                      />
                      <span className="epx-toggle__track"><span className="epx-toggle__thumb" /></span>
                    </label>
                  </div>
                </FieldGroup>

                {/* Columns dropdown + inline custom input (bp-aware), scrubable label. */}
                <FieldGroup
                  isDirty={columnsDirty}
                  onReset={() => {
                    if (isNonDesktop) writeBpConfig({ columns: undefined, columnsCustom: undefined });
                    else onChange({ columns: "1", columnsCustom: undefined });
                  }}
                >
                  <SelectRow
                    label="Columns"
                    value={effColumns}
                    onChange={(v) => setKey("columns", v)}
                    options={[
                      { value: "1", label: "1" },
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                      {
                        value: "custom",
                        label: (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.5 1.5a1.414 1.414 0 0 1 2 2L4 10H2v-2L8.5 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ),
                      },
                    ]}
                    labelClassName="epx-row-label--section"
                    labelSuffix={breakpointIndicator}
                    onLabelMouseDown={(e) => {
                      e.preventDefault();
                      const startX = e.clientX;
                      const startCount = effColumns === "custom"
                        ? (effColumnsCustom ?? 1)
                        : Number(effColumns) || 1;
                      document.body.style.cursor = "ew-resize";
                      document.body.style.userSelect = "none";
                      const onMove = (ev: MouseEvent) => {
                        // 8px drag = 1 column step.
                        const next = Math.max(1, Math.round(startCount + (ev.clientX - startX) / 8));
                        if (next <= 3) {
                          const v = String(next);
                          setKey("columns", v);
                          // Clear custom when going back to preset.
                          if (effColumnsCustom !== undefined) setKey("columnsCustom", undefined);
                        } else {
                          setKey("columns", "custom");
                          setKey("columnsCustom", next);
                        }
                      };
                      const onUp = () => {
                        document.body.style.cursor = "";
                        document.body.style.userSelect = "";
                        window.removeEventListener("mousemove", onMove);
                        window.removeEventListener("mouseup", onUp);
                      };
                      window.addEventListener("mousemove", onMove);
                      window.addEventListener("mouseup", onUp);
                    }}
                    leftAddon={effColumns === "custom" ? (
                      <input
                        type="number"
                        className="epx-side-input__num"
                        min={2}
                        step={1}
                        value={effColumnsCustom ?? ""}
                        placeholder="4"
                        onChange={(e) => {
                          const raw = e.target.value;
                          setKey("columnsCustom", raw === "" ? undefined : Number(raw));
                        }}
                      />
                    ) : null}
                  />
                </FieldGroup>

                {/* Columns Gap (bp-aware) — inline SideInput to use a single FieldGroup wrapper. */}
                <FieldGroup
                  isDirty={columnsGapDirty}
                  onReset={() => {
                    if (isNonDesktop) writeBpConfig({ columnsGap: undefined });
                    else onChange({ columnsGap: "0px" });
                  }}
                >
                  <SideInput
                    sideKey=""
                    labelOverride="Columns Gap"
                    value={parseSide(effColumnsGap)}
                    onChange={(next) => {
                      const isEmpty = next.num === 0 && next.unit === "px";
                      setKey("columnsGap", isEmpty ? "" : serializeSide(next));
                    }}
                    units={["px", "rem", "em", "%"]}
                    labelSuffix={breakpointIndicator}
                  />
                </FieldGroup>
              </>
            );
          })()}
          {block.type === "text" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <FieldGroup
                isDirty={!!block.config.htmlTag}
                onReset={() => onChange({ htmlTag: "" })}
              >
                <SelectRow
                  label="HTML Tag"
                  value={(block.config.htmlTag as string) ?? ""}
                  onChange={(v) => onChange({ htmlTag: v })}
                  options={TEXT_TAG_OPTIONS}
                  labelClassName="epx-row-label--section"
                />
              </FieldGroup>
              {(block.config.htmlTag as string) === "a" && (
                <LinkControl value={linkValue} onChange={handleLink} />
              )}
            </div>
          )}
          {block.type === "image" && (() => {
            const img = block.config.image as MediaRef | undefined;
            const resolution = (block.config.resolution as string) ?? "full";
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <ImagePreviewCard
                  image={img}
                  onSelect={() => setImagePickerOpen(true)}
                  onRemove={() => onChange({ image: undefined })}
                  boxed
                />

                <FieldGroup
                  isDirty={resolution !== "full"}
                  onReset={() => onChange({ resolution: "full" })}
                >
                  <SelectRow
                    label="Resolution"
                    value={resolution}
                    onChange={(v) => onChange({ resolution: v })}
                    options={RESOLUTION_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>

                <LinkControl value={linkValue} onChange={handleLink} />

                {imagePickerOpen && (
                  <MediaPicker
                    mimeTypeFilter="image/"
                    onSelect={([ref]) => {
                      if (ref) onChange({ image: ref });
                      setImagePickerOpen(false);
                    }}
                    onClose={() => setImagePickerOpen(false)}
                    selectedIds={img?.id ? [img.id] : []}
                  />
                )}
              </div>
            );
          })()}
          {block.type === "container" && (
            <LayoutControl
              value={parseLayout(isNonDesktop ? { ...block.config, ...bpStyleRaw } : block.config)}
              onChange={(patch) => {
                if (isNonDesktop) writeBpStyle(patch as Record<string, unknown>);
                else onChange(patch as Record<string, unknown>);
              }}
              breakpointIndicator={breakpointIndicator}
            />
          )}
          {block.type === "container" && (
            <GapControl value={gapValue} onChange={handleGap} breakpointIndicator={breakpointIndicator} />
          )}
          {block.type === "container" && (
            <>
              <PanelDivider />
              <OverflowControl value={overflowValue} onChange={handleOverflow} />
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <FieldGroup
                  isDirty={!!block.config.htmlTag}
                  onReset={() => onChange({ htmlTag: "" })}
                >
                  <SelectRow
                    label="HTML Tag"
                    value={(block.config.htmlTag as string) ?? ""}
                    onChange={(v) => onChange({ htmlTag: v })}
                    options={HTML_TAG_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                {(block.config.htmlTag as string) === "a" && (
                  <LinkControl value={linkValue} onChange={handleLink} />
                )}
              </div>
            </>
          )}
          {block.type === "video" && (() => {
            const video = (block.config.video ?? {}) as VideoSourceValue;
            const overlay = (block.config.overlay ?? {}) as VideoOverlayValue;
            const overlayImg = overlay.image;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <VideoSourceControl
                  value={video}
                  onChange={(v) => onChange({ video: v })}
                  breakpointIndicator={breakpointIndicator}
                />
                <PanelDivider />
                <span className="epx-row-label--section" style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Image Overlay</span>
                <ImagePreviewCard
                  image={overlayImg}
                  onSelect={() => setVideoOverlayPickerOpen(true)}
                  onRemove={() => onChange({ overlay: { ...overlay, image: undefined } })}
                  emptyLabel="Select Overlay Image"
                  boxed
                />
                {videoOverlayPickerOpen && (
                  <MediaPicker
                    title="Select Overlay Image"
                    mimeTypeFilter="image/"
                    onSelect={([ref]) => {
                      if (ref) onChange({ overlay: { ...overlay, image: ref } });
                      setVideoOverlayPickerOpen(false);
                    }}
                    onClose={() => setVideoOverlayPickerOpen(false)}
                    selectedIds={overlayImg?.id ? [overlayImg.id] : []}
                  />
                )}
                <FieldGroup
                  isDirty={!!overlay.resolution && overlay.resolution !== "full"}
                  onReset={() => onChange({ overlay: { ...overlay, resolution: undefined } })}
                >
                  <SelectRow
                    label="Resolution"
                    value={overlay.resolution ?? "full"}
                    onChange={(v) => onChange({ overlay: { ...overlay, resolution: v as VideoOverlayValue["resolution"] } })}
                    options={RESOLUTION_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <FieldGroup
                  isDirty={!!overlay.size && overlay.size !== "cover"}
                  onReset={() => onChange({ overlay: { ...overlay, size: undefined } })}
                >
                  <SelectRow
                    label="Size"
                    value={overlay.size ?? "cover"}
                    onChange={(v) => onChange({ overlay: { ...overlay, size: v as VideoOverlayValue["size"] } })}
                    options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "auto", label: "Auto" }]}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <FieldGroup
                  isDirty={!!overlay.position && overlay.position !== "center"}
                  onReset={() => onChange({ overlay: { ...overlay, position: undefined } })}
                >
                  <SelectRow
                    label="Position"
                    value={overlay.position ?? "center"}
                    onChange={(v) => onChange({ overlay: { ...overlay, position: v } })}
                    options={OBJECT_POSITION_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <IconGroup
                  label="Overlay Icon"
                  value={overlay.icon}
                  onChange={(v) => onChange({ overlay: { ...overlay, icon: v } })}
                  showPosition={false}
                />
              </div>
            );
          })()}
          {block.type === "button" && (
            <LinkControl value={linkValue} onChange={handleLink} />
          )}
          {block.type === "icon" && (
            <LinkControl value={linkValue} onChange={handleLink} />
          )}
          {block.type === "divider-spacer" && (() => {
            const divider = (block.config.divider ?? {}) as DividerConfig;
            const setDivider = (patch: Partial<DividerConfig>) =>
              onChange({ divider: { ...divider, ...patch } });
            const dividerActive = divider.style && divider.style !== "none";
            const isGradient = divider.style === "gradient";
            const gradient: DividerGradient = divider.gradient ?? {
              angle: 0,
              stops: [
                { color: "#000000", alpha: 1, pos: 0 },
                { color: "#000000", alpha: 0, pos: 100 },
              ],
            };
            const gradStops: DividerGradientStop[] = gradient.stops ?? [];
            const setGradient = (patch: Partial<DividerGradient>) =>
              setDivider({ gradient: { ...gradient, ...patch } });
            const updateStop = (i: number, patch: Partial<DividerGradientStop>) =>
              setGradient({ stops: gradStops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });
            const addStop = () =>
              setGradient({
                stops: [
                  ...gradStops,
                  { color: "#888888", alpha: 1, pos: Math.min(100, (gradStops[gradStops.length - 1]?.pos ?? 50) + 10) },
                ],
              });
            const removeStop = (i: number) => {
              if (gradStops.length <= 2) return;
              setGradient({ stops: gradStops.filter((_, idx) => idx !== i) });
            };
            const openDivColor = () => {
              if (divColorSwatchRef.current) {
                const r = divColorSwatchRef.current.getBoundingClientRect();
                setDivColorPos({ top: r.bottom + 4, left: r.left - 180 });
              }
              setDivColorOpen((o) => !o);
            };
            const openGradStop = (i: number, el: HTMLElement) => {
              const r = el.getBoundingClientRect();
              setDivGradPickerPos({ top: r.bottom + 4, left: r.left - 180 });
              setDivGradPickerKey((prev) => (prev === i ? null : i));
            };
            // Scrub helpers (mirror BackgroundControl gradient editor patterns)
            const startAngleScrub = (e: React.MouseEvent) => {
              e.preventDefault();
              const startX = e.clientX;
              const startAngle = gradient.angle ?? 0;
              document.body.style.cursor = "ew-resize";
              document.body.style.userSelect = "none";
              const onMove = (ev: MouseEvent) => {
                const next = ((Math.round(startAngle + (ev.clientX - startX)) % 360) + 360) % 360;
                setGradient({ angle: next });
              };
              const onUp = () => {
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            };
            const startStopPosScrub = (i: number) => (e: React.MouseEvent) => {
              e.preventDefault();
              const startX = e.clientX;
              const startPos = gradStops[i].pos;
              document.body.style.cursor = "ew-resize";
              document.body.style.userSelect = "none";
              const onMove = (ev: MouseEvent) => {
                const next = Math.min(100, Math.max(0, Math.round(startPos + (ev.clientX - startX) / 2)));
                updateStop(i, { pos: next });
              };
              const onUp = () => {
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            };
            // Convert UI angle (0=top→bottom, clockwise) to CSS angle.
            // CSS linear-gradient uses 0=bottom→top, 180=top→bottom. So css = (ui + 180) % 360.
            const cssAngle = (((gradient.angle ?? 0) + 180) % 360);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <PanelDivider />
                <span className="epx-row-label--section" style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Divider</span>
                <FieldGroup
                  isDirty={!!divider.style && divider.style !== "none"}
                  onReset={() => setDivider({ style: "none" })}
                >
                  <SelectRow
                    label="Style"
                    value={divider.style ?? "none"}
                    onChange={(v) => setDivider({ style: v as DividerStyle })}
                    options={[
                      { value: "none",     label: "None" },
                      { value: "solid",    label: "Solid" },
                      { value: "dashed",   label: "Dashed" },
                      { value: "dotted",   label: "Dotted" },
                      { value: "double",   label: "Double" },
                      { value: "groove",   label: "Groove" },
                      { value: "ridge",    label: "Ridge" },
                      { value: "gradient", label: "Gradient" },
                      { value: "wavy",     label: "Wavy" },
                      { value: "zigzag",   label: "Zigzag" },
                    ]}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                {dividerActive && (
                  <>
                    <NumberWithUnits
                      label="Width"
                      value={divider.width}
                      onChange={(v) => setDivider({ width: v || undefined })}
                      units={["px", "rem", "em"]}
                    />
                    <NumberWithUnits
                      label="Length"
                      value={divider.length}
                      onChange={(v) => setDivider({ length: v || undefined })}
                      units={["%", "px", "rem", "em", "vw"]}
                    />
                    {!isGradient && (
                      <FieldGroup
                        isDirty={!!divider.color || (divider.colorAlpha !== undefined && divider.colorAlpha < 1)}
                        onReset={() => setDivider({ color: undefined, colorAlpha: undefined })}
                      >
                        <div className="epx-side-input">
                          <span className="epx-side-input__label epx-side-input__label--row">Color</span>
                          <div className="epx-border-color-cell" style={{ flex: 1 }}>
                            <button
                              ref={divColorSwatchRef}
                              type="button"
                              className="epx-border-color-swatch"
                              style={{ background: divider.color || "#000000", opacity: divider.colorAlpha ?? 1 }}
                              onClick={openDivColor}
                            />
                            <span className="epx-border-color-hex">{getColorDisplay(divider.color || "#000000", divColorFormat)}</span>
                            {divColorOpen && (
                              <ColorPicker
                                value={divider.color || "#000000"}
                                alpha={divider.colorAlpha ?? 1}
                                onChange={(hex, a) => setDivider({ color: hex, colorAlpha: a })}
                                onClose={() => setDivColorOpen(false)}
                                position={divColorPos}
                                format={divColorFormat}
                                onFormatChange={setDivColorFormat}
                              />
                            )}
                          </div>
                        </div>
                      </FieldGroup>
                    )}
                    {isGradient && (
                      <div className="epx-bg-ctrl__card" style={{ marginTop: 4 }}>
                        <div className="epx-spacing-ctrl__exp-header">
                          <span className="epx-spacing-ctrl__label">Gradient</span>
                        </div>
                        <div className="epx-bg-ctrl__body">
                          {/* Angle row with scrub label */}
                          <div className="epx-bg-ctrl__stop" style={{ borderTopColor: "transparent", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                            <span
                              className="epx-bg-ctrl__stop-label"
                              style={{ cursor: "ew-resize" }}
                              title="Drag to adjust"
                              onMouseDown={startAngleScrub}
                            >Angle</span>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                              <input
                                type="number"
                                className="epx-bg-ctrl__stop-pos"
                                style={{ width: 46 }}
                                value={gradient.angle ?? 0}
                                min={0}
                                max={360}
                                onChange={(e) => setGradient({ angle: Number(e.target.value) })}
                              />
                              <span className="epx-bg-ctrl__stop-unit">°</span>
                            </div>
                          </div>
                          {/* Stops list — sorted by pos, % scrubable */}
                          {[...gradStops]
                            .map((stop, i) => ({ stop, i }))
                            .sort((a, b) => a.stop.pos - b.stop.pos)
                            .map(({ stop, i }) => (
                              <div key={i} className="epx-bg-ctrl__stop">
                                <button
                                  type="button"
                                  className="epx-bg-ctrl__swatch"
                                  onClick={(e) => openGradStop(i, e.currentTarget)}
                                  title="Pick color"
                                >
                                  <div className="epx-bg-ctrl__swatch-fill" style={{ background: stop.color, opacity: stop.alpha }} />
                                </button>
                                <span className="epx-bg-ctrl__hex" style={{ flex: 1 }}>{getColorDisplay(stop.color, divGradColorFormat)}</span>
                                <input
                                  type="number"
                                  className="epx-bg-ctrl__stop-pos"
                                  value={stop.pos}
                                  min={0}
                                  max={100}
                                  onChange={(e) => updateStop(i, { pos: Number(e.target.value) })}
                                />
                                <span
                                  className="epx-bg-ctrl__stop-unit"
                                  style={{ cursor: "ew-resize" }}
                                  onMouseDown={startStopPosScrub(i)}
                                  title="Drag to adjust"
                                >%</span>
                                <button
                                  type="button"
                                  className="epx-bg-ctrl__stop-remove"
                                  onClick={() => removeStop(i)}
                                  disabled={gradStops.length <= 2}
                                  title="Remove stop"
                                >×</button>
                              </div>
                            ))}
                          <button
                            type="button"
                            className="epx-bg-ctrl__add-btn"
                            onClick={addStop}
                            disabled={gradStops.length >= 8}
                          >+ Add Color Stop</button>
                          {/* Preview bar with draggable markers (uses CSS-mapped angle for visual fidelity) */}
                          {gradStops.length >= 2 && (() => {
                            const sortedStops = [...gradStops].sort((a, b) => a.pos - b.pos);
                            const previewBg = `linear-gradient(${cssAngle}deg, ${sortedStops.map((s) => {
                              const c = s.color.replace("#", "");
                              const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c.slice(0, 6);
                              const n = parseInt(full.padEnd(6, "0"), 16);
                              return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${s.alpha}) ${s.pos}%`;
                            }).join(",")})`;
                            const onMarkerDown = (i: number) => (e: React.MouseEvent) => {
                              e.preventDefault();
                              const bar = (e.currentTarget as HTMLElement).parentElement!;
                              const rect = bar.getBoundingClientRect();
                              document.body.style.cursor = "ew-resize";
                              document.body.style.userSelect = "none";
                              const onMove = (ev: MouseEvent) => {
                                const pct = Math.min(100, Math.max(0, Math.round(((ev.clientX - rect.left) / rect.width) * 100)));
                                updateStop(i, { pos: pct });
                              };
                              const onUp = () => {
                                document.body.style.cursor = "";
                                document.body.style.userSelect = "";
                                window.removeEventListener("mousemove", onMove);
                                window.removeEventListener("mouseup", onUp);
                              };
                              window.addEventListener("mousemove", onMove);
                              window.addEventListener("mouseup", onUp);
                            };
                            return (
                              <div
                                className="epx-bg-ctrl__grad-preview"
                                style={{ background: previewBg }}
                              >
                                {gradStops.map((stop, i) => (
                                  <div
                                    key={i}
                                    className="epx-bg-ctrl__grad-marker"
                                    style={{ left: `${stop.pos}%`, color: stop.color }}
                                    onMouseDown={onMarkerDown(i)}
                                  >
                                    <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--top" />
                                    <div className="epx-bg-ctrl__grad-marker-arrow epx-bg-ctrl__grad-marker-arrow--bottom" />
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {divGradPickerKey !== null && gradStops[divGradPickerKey] && (
                            <ColorPicker
                              value={gradStops[divGradPickerKey].color}
                              alpha={gradStops[divGradPickerKey].alpha}
                              onChange={(hex, a) => updateStop(divGradPickerKey, { color: hex, alpha: a })}
                              onClose={() => setDivGradPickerKey(null)}
                              position={divGradPickerPos}
                              format={divGradColorFormat}
                              onFormatChange={setDivGradColorFormat}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    <FieldGroup
                      isDirty={!!divider.align && divider.align !== "center"}
                      onReset={() => setDivider({ align: "center" })}
                    >
                      <SelectRow
                        label="Align"
                        value={divider.align ?? "center"}
                        onChange={(v) => setDivider({ align: v as DividerConfig["align"] })}
                        options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]}
                        labelClassName="epx-row-label--section"
                      />
                    </FieldGroup>
                    <IconGroup
                      label="Divider Icon"
                      value={divider.icon}
                      onChange={(v) => setDivider({ icon: v })}
                      showPosition={true}
                    />
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === "style" && block.type === "text" && (
        <div className="epx-right-panel__fields">
          <AlignControl
            value={alignValue}
            onChange={handleAlign}
            breakpointIndicator={breakpointIndicator}
          />
          <TypographyControl
            value={typographyValue}
            onChange={handleTypography}
            breakpointIndicator={breakpointIndicator}
          />
          <TextStrokeControl
            value={strokeValue}
            onChange={handleStroke}
            breakpointIndicator={breakpointIndicator}
          />
          <TextShadowControl
            value={shadowTextValue}
            onChange={handleTextShadow}
            breakpointIndicator={breakpointIndicator}
          />
          <BlendModeControl
            value={blendModeValue}
            onChange={handleBlendMode}
            breakpointIndicator={breakpointIndicator}
          />
        </div>
      )}

      {activeTab === "style" && (block.type === "text-editor") && (
        <div className="epx-right-panel__fields">
          <AlignControl
            value={alignValue}
            onChange={handleAlign}
            breakpointIndicator={breakpointIndicator}
          />
          <TypographyControl
            value={parseTypography(style)}
            onChange={(v) => onChange({ style: { ...style, ...serializeTypography(v) } })}
          />
          <TextShadowControl
            value={shadowTextValue}
            onChange={handleTextShadow}
            breakpointIndicator={breakpointIndicator}
          />
          <NumberWithUnits
            label="Paragraph Spacing"
            value={(typoSource.paragraphSpacing as string) || ""}
            onChange={(v) => {
              if (isNonDesktop) writeBpStyle({ paragraphSpacing: v });
              else onChange({ style: { ...style, paragraphSpacing: v } });
            }}
            units={["px", "rem", "em", "%"]}
            breakpointIndicator={breakpointIndicator}
          />
          {(() => {
            const dropCapBpOverride = bpConfigRaw.dropCap as boolean | undefined;
            const dropCapEff = isNonDesktop && typeof dropCapBpOverride === "boolean"
              ? dropCapBpOverride
              : !!block.config.dropCap;
            if (!dropCapEff) return null;
            // Drop-cap settings — bp-aware reads from typoSource (style+bp), writes via writeBpStyle.
            const dcSize = (typoSource.dropCapSize as string) || "";
            const dcLines = (typoSource.dropCapLines as string) || "";
            const dcMR = (typoSource.dropCapMarginRight as string) || "";
            const writeDc = (key: string, v: string) => {
              if (isNonDesktop) writeBpStyle({ [key]: v });
              else onChange({ style: { ...style, [key]: v } });
            };
            return (
              <>
                <PanelDivider />
                <span className="epx-row-label--section" style={{ fontSize: 11, color: "var(--epx-text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Drop Cap</span>
                <NumberWithUnits
                  label="Size"
                  value={dcSize}
                  onChange={(v) => writeDc("dropCapSize", v)}
                  units={["em", "rem", "px"]}
                  breakpointIndicator={breakpointIndicator}
                />
                <NumberWithUnits
                  label="Lines"
                  value={dcLines}
                  onChange={(v) => writeDc("dropCapLines", v)}
                  units={["em", "rem"]}
                  breakpointIndicator={breakpointIndicator}
                />
                <NumberWithUnits
                  label="Margin Right"
                  value={dcMR}
                  onChange={(v) => writeDc("dropCapMarginRight", v)}
                  units={["px", "rem", "em"]}
                  breakpointIndicator={breakpointIndicator}
                />
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "style" && block.type === "video" && (() => {
        const aspect = (block.config.aspectRatio as string) || "16:9";
        const cssFilter = (style.filter as string) || "";
        const filterValue: CssFiltersValue = parseFilter(cssFilter);
        const handleFilter = (v: CssFiltersValue) => {
          const next = serializeFilter(v);
          onChange({ style: { ...style, filter: next || undefined } });
        };
        return (
          <div className="epx-right-panel__fields">
            <FieldGroup
              isDirty={aspect !== "16:9"}
              onReset={() => onChange({ aspectRatio: "16:9" })}
            >
              <SelectRow
                label="Aspect Ratio"
                value={aspect}
                onChange={(v) => onChange({ aspectRatio: v })}
                options={[
                  { value: "1:1",    label: "1:1" },
                  { value: "3:2",    label: "3:2" },
                  { value: "4:3",    label: "4:3" },
                  { value: "16:9",   label: "16:9" },
                  { value: "21:9",   label: "21:9" },
                  { value: "9:16",   label: "9:16 (vertical)" },
                  { value: "custom", label: "Custom" },
                ]}
                labelClassName="epx-row-label--section"
              />
            </FieldGroup>
            {aspect === "custom" && (
              <>
                <NumberWithUnits
                  label="Aspect W"
                  value={(block.config.aspectRatioCustomW as string) || ""}
                  onChange={(v) => onChange({ aspectRatioCustomW: v })}
                  units={["px", "rem", "%"]}
                />
                <NumberWithUnits
                  label="Aspect H"
                  value={(block.config.aspectRatioCustomH as string) || ""}
                  onChange={(v) => onChange({ aspectRatioCustomH: v })}
                  units={["px", "rem", "%"]}
                />
              </>
            )}
            <CssFiltersControl
              value={filterValue}
              onChange={handleFilter}
              breakpointIndicator={breakpointIndicator}
            />
          </div>
        );
      })()}

      {activeTab === "style" && block.type === "icon" && (() => {
        const normalColor = { color: style.iconColor as string | undefined, alpha: typeof style.iconColorAlpha === "number" ? (style.iconColorAlpha as number) : undefined };
        const hoverColor = { color: styleHover.iconColor as string | undefined, alpha: typeof styleHover.iconColorAlpha === "number" ? (styleHover.iconColorAlpha as number) : undefined };
        return (
          <div className="epx-right-panel__fields">
            <AlignControl
              value={alignValue}
              onChange={handleAlign}
              breakpointIndicator={breakpointIndicator}
            />
            <ColorNormalHover
              label="Icon Color"
              normal={normalColor}
              hover={hoverColor}
              onNormalChange={(v) => onChange({ style: { ...style, iconColor: v.color, iconColorAlpha: v.alpha } })}
              onHoverChange={(v) => onChange({ styleHover: { ...styleHover, iconColor: v.color, iconColorAlpha: v.alpha } })}
              breakpointIndicator={breakpointIndicator}
            />
            <NumberWithUnits
              label="Size"
              value={(style.iconBlockSize as string) || ""}
              onChange={(v) => onChange({ style: { ...style, iconBlockSize: v } })}
              units={["px", "rem", "em", "%"]}
              breakpointIndicator={breakpointIndicator}
            />
            <NumberWithUnits
              label="Rotate"
              value={(block.config.rotate as string) || ""}
              onChange={(v) => onChange({ rotate: v })}
              units={["deg", "turn"]}
              allowNegative
            />
          </div>
        );
      })()}

      {activeTab === "style" && block.type === "divider-spacer" && (
        <div className="epx-right-panel__fields">
          <p style={{ fontSize: 12, color: "var(--epx-text-faint)", padding: "12px", textAlign: "center" }}>
            All settings for this block are in the Fields tab.
          </p>
        </div>
      )}

      {activeTab === "style" && (block.type === "container" || block.type === "image" || block.type === "testimonials" || block.type === "faq" || block.type === "pricing" || block.type === "button") && (
        <div className="epx-right-panel__fields">
          {block.type === "button" && (
            <TypographyControl
              value={typographyValue}
              onChange={handleTypography}
              breakpointIndicator={breakpointIndicator}
            />
          )}
          {def.styleFields?.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={block.config[field.key]}
              isDirty={JSON.stringify(block.config[field.key]) !== JSON.stringify(def.defaultConfig[field.key])}
              onChange={(val) => onChange({ [field.key]: val })}
            />
          ))}
          {block.type === "image" && (() => {
            const imgStyle = (block.config.imgStyle ?? {}) as Record<string, unknown>;
            const imgWidthValues = {
              fix: parseSide(imgStyle.width),
              min: parseSide(imgStyle.minWidth),
              max: parseSide(imgStyle.maxWidth),
            };
            const imgHeightValues = {
              fix: parseSide(imgStyle.height),
              min: parseSide(imgStyle.minHeight),
              max: parseSide(imgStyle.maxHeight),
            };
            const IMG_KEYS = {
              width:  { fix: "width",  min: "minWidth",  max: "maxWidth"  },
              height: { fix: "height", min: "minHeight", max: "maxHeight" },
            } as const;
            const writeImgStyle = (patch: Record<string, unknown>) => {
              onChange({ imgStyle: { ...imgStyle, ...patch } });
            };
            const handleImgDim = (axis: "width" | "height", key: "fix" | "min" | "max", sv: SideValue) => {
              writeImgStyle({ [IMG_KEYS[axis][key]]: serializeSide(sv) });
            };
            const objectFit = (imgStyle.objectFit as string) || "";
            const objectPosition = (imgStyle.objectPosition as string) || "";
            const imgAlign = (typoSource.textAlign as string) || "";
            const opacityNormal = style.opacity as number | undefined;
            const opacityHover = styleHover.opacity as number | undefined;
            const opacityActive = opacityMode === "hover" ? opacityHover : opacityNormal;
            const handleImgAlign = (v: string) => {
              if (isNonDesktop) writeBpStyle({ textAlign: v });
              else onChange({ style: { ...style, textAlign: v } });
            };
            const handleOpacity = (v: number | undefined) => {
              if (opacityMode === "hover") onChange({ styleHover: { ...styleHover, opacity: v } });
              else onChange({ style: { ...style, opacity: v } });
            };
            return (
              <>
                <DimensionControl
                  label="Width"
                  values={imgWidthValues}
                  onChange={(key, v) => handleImgDim("width", key, v)}
                  onReset={() => writeImgStyle({ width: "", minWidth: "", maxWidth: "" })}
                />
                <DimensionControl
                  label="Height"
                  values={imgHeightValues}
                  onChange={(key, v) => handleImgDim("height", key, v)}
                  onReset={() => writeImgStyle({ height: "", minHeight: "", maxHeight: "" })}
                />
                <FieldGroup
                  isDirty={!!objectFit}
                  onReset={() => writeImgStyle({ objectFit: "" })}
                >
                  <SelectRow
                    label="Fit"
                    value={objectFit}
                    onChange={(v) => writeImgStyle({ objectFit: v })}
                    options={OBJECT_FIT_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <FieldGroup
                  isDirty={!!objectPosition}
                  onReset={() => writeImgStyle({ objectPosition: "" })}
                >
                  <SelectRow
                    label="Position"
                    value={objectPosition}
                    onChange={(v) => writeImgStyle({ objectPosition: v })}
                    options={OBJECT_POSITION_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <FieldGroup
                  isDirty={!!imgAlign}
                  onReset={() => handleImgAlign("")}
                >
                  <IconButtonRow
                    label="Align"
                    value={imgAlign}
                    onChange={handleImgAlign}
                    options={IMAGE_ALIGN_OPTIONS}
                    labelClassName="epx-row-label--section"
                  />
                </FieldGroup>
                <div className="epx-stateful-ctrl">
                  <div className="epx-state-toggle">
                    <button type="button" className={`epx-state-toggle__btn${opacityMode === "normal" ? " is-active" : ""}`} onClick={() => setOpacityMode("normal")} data-tooltip="Normal">
                      <IconStateNormal />
                    </button>
                    <button type="button" className={`epx-state-toggle__btn${opacityMode === "hover" ? " is-active" : ""}`} onClick={() => setOpacityMode("hover")} data-tooltip="Hover">
                      <IconStateHover />
                    </button>
                  </div>
                  <FieldGroup
                    isDirty={opacityActive !== undefined}
                    onReset={() => handleOpacity(undefined)}
                  >
                    <NumberRow
                      label="Opacity"
                      value={opacityActive}
                      onChange={handleOpacity}
                      labelClassName="epx-row-label--section"
                      step={0.1}
                      min={0}
                      max={1}
                    />
                  </FieldGroup>
                </div>
              </>
            );
          })()}
          {block.type !== "image" && (
            <div className="epx-stateful-ctrl">
              <div className="epx-state-header">
                <div className="epx-state-toggle">
                  <button type="button" className={`epx-state-toggle__btn${bgMode === "normal" ? " is-active" : ""}`} onClick={() => setBgMode("normal")} data-tooltip="Normal">
                    <IconStateNormal />
                  </button>
                  <button type="button" className={`epx-state-toggle__btn${bgMode === "hover" ? " is-active" : ""}`} onClick={() => setBgMode("hover")} data-tooltip="Hover">
                    <IconStateHover />
                  </button>
                </div>
                <ThemeStyleToggle theme={theme} onChange={handleTheme} />
              </div>
              <BackgroundControl value={bgValue} onChange={handleBackground} allowedTypes={bgMode === "hover" ? ["color", "gradient", "image"] : undefined} />
            </div>
          )}
          <div className="epx-stateful-ctrl">
            <div className="epx-state-toggle">
              <button type="button" className={`epx-state-toggle__btn${radiusMode === "normal" ? " is-active" : ""}`} onClick={() => setRadiusMode("normal")} data-tooltip="Normal">
                <IconStateNormal />
              </button>
              <button type="button" className={`epx-state-toggle__btn${radiusMode === "hover" ? " is-active" : ""}`} onClick={() => setRadiusMode("hover")} data-tooltip="Hover">
                <IconStateHover />
              </button>
            </div>
            <BorderRadiusControl value={radiusValue} onChange={handleRadius} breakpointIndicator={breakpointIndicator} />
          </div>
          <div className="epx-stateful-ctrl">
            <div className="epx-state-toggle">
              <button type="button" className={`epx-state-toggle__btn${borderMode === "normal" ? " is-active" : ""}`} onClick={() => setBorderMode("normal")} data-tooltip="Normal">
                <IconStateNormal />
              </button>
              <button type="button" className={`epx-state-toggle__btn${borderMode === "hover" ? " is-active" : ""}`} onClick={() => setBorderMode("hover")} data-tooltip="Hover">
                <IconStateHover />
              </button>
            </div>
            <BorderControl value={borderValue} onChange={handleBorder} breakpointIndicator={breakpointIndicator} />
          </div>
          <div className="epx-stateful-ctrl">
            <div className="epx-state-toggle">
              <button type="button" className={`epx-state-toggle__btn${shadowMode === "normal" ? " is-active" : ""}`} onClick={() => setShadowMode("normal")} data-tooltip="Normal">
                <IconStateNormal />
              </button>
              <button type="button" className={`epx-state-toggle__btn${shadowMode === "hover" ? " is-active" : ""}`} onClick={() => setShadowMode("hover")} data-tooltip="Hover">
                <IconStateHover />
              </button>
            </div>
            <BoxShadowControl value={shadowValue} onChange={handleShadow} breakpointIndicator={breakpointIndicator} />
          </div>
        </div>
      )}

      {activeTab === "advanced" && (
        <AdvancedTab
          value={advanced}
          onChange={(val) => onChange({ advanced: val })}
          blockId={block.id}
          widthValues={widthValues}
          heightValues={heightValues}
          paddingValue={paddingValue}
          marginValue={marginValue}
          onDimension={handleDimension}
          onSpacing={handleSpacing}
          onResetWidth={() => onChange({ style: { ...style, width: "", minWidth: "", maxWidth: "" } })}
          onResetHeight={() => onChange({ style: { ...style, height: "", minHeight: "", maxHeight: "" } })}
        />
      )}
    </aside>
  );
}
