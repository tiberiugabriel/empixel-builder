import React, { useEffect, useRef, useState } from "react";
import type { SectionBlock, BreakpointId, BreakpointsConfig } from "../types.js";
import { BREAKPOINT_DEFS } from "../types.js";
import { getBlockDef } from "./blockDefinitions.js";
import { getBpIcon } from "./components/BreakpointIcons.js";
import { FieldRenderer } from "./fields/FieldRenderer.js";
import { SpacingControl, parseSide, serializeSide, type SpacingValue, type SideValue, type SpacingKeys } from "./controls/SpacingControl.js";
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
import { ThemeStyleToggle, getThemeStyleKey } from "./controls/ThemeStyleToggle.js";
import { AlignControl, parseAlign, serializeAlign, type AlignValue } from "./controls/AlignControl.js";
import { TypographyControl, parseTypography, serializeTypography, type TypographyValue } from "./controls/TypographyControl.js";
import { TextStrokeControl, parseTextStroke, serializeTextStroke, type TextStrokeValue } from "./controls/TextStrokeControl.js";
import { TextShadowControl, parseTextShadow, serializeTextShadow, type TextShadowValue } from "./controls/TextShadowControl.js";
import { BlendModeControl, parseBlendMode, serializeBlendMode, type BlendModeValue } from "./controls/BlendModeControl.js";

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

// ─── CodeEditor ───────────────────────────────────────────────────────────────

function CodeEditor({
  value,
  onChange,
  selector,
}: {
  value: string;
  onChange: (v: string) => void;
  selector: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const copySelector = () => {
    navigator.clipboard.writeText(selector).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const lineCount = value === "" ? 1 : value.split("\n").length;

  // Sync line numbers scroll with textarea scroll
  const handleScroll = () => {
    if (lineNumsRef.current && textareaRef.current) {
      lineNumsRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Tab key → insert 4 spaces (no focus jump)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = textareaRef.current!;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.substring(0, start) + "    " + value.substring(end);
    onChange(next);
    // Restore caret after React re-render
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 4;
    });
  };

  // Keep cursor position stable across onChange re-renders
  const selStart = useRef(0);
  const selEnd = useRef(0);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.selectionStart = selStart.current;
    ta.selectionEnd = selEnd.current;
  });

  const placeholder = `color: red;\nfont-size: 18px;`;

  return (
    <div className="epx-code-editor">
      <div className="epx-code-editor__header">
        <button type="button" className="epx-code-editor__copy-btn" onClick={copySelector} title="Copy selector">
          {copied ? (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="4" y="1" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="3" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="var(--epx-surface-code)"/></svg>
          )}
        </button>
        <div className="epx-code-editor__selector-scroll">
          <span className="epx-code-editor__selector-kw">selector</span>
          <span className="epx-code-editor__selector-eq"> = </span>
          <span className="epx-code-editor__selector-val">{selector}</span>
        </div>
      </div>
      <div className="epx-code-editor__body">
        <div ref={lineNumsRef} className="epx-code-editor__line-nums" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="epx-code-editor__line-num">{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="epx-code-editor__textarea"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={(e) => {
            selStart.current = (e.target as HTMLTextAreaElement).selectionStart;
            selEnd.current = (e.target as HTMLTextAreaElement).selectionEnd;
          }}
          onChange={(e) => {
            selStart.current = e.target.selectionStart;
            selEnd.current = e.target.selectionEnd;
            onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
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
          selector={selector}
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
  const [trackedId, setTrackedId] = useState(block?.id);

  if (block?.id !== trackedId) {
    setTrackedId(block?.id);
    setRadiusMode("normal");
    setBorderMode("normal");
    setShadowMode("normal");
    setBgMode("normal");
    setOpacityMode("normal");
    setImagePickerOpen(false);
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

  const TABS: { id: Tab; icon: React.ReactNode; title: string }[] = [
    { id: "fields", icon: <IconFields />, title: "Fields" },
    { id: "style", icon: <IconStyle />, title: "Style" },
    { id: "advanced", icon: <IconAdvanced />, title: "Advanced" },
  ];

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
                <div className="epx-bg-ctrl__media-row">
                  {img?.storageKey ? (
                    <img
                      className="epx-bg-ctrl__thumb"
                      src={`/_emdash/api/media/file/${img.storageKey}`}
                      alt={img.alt ?? img.filename ?? ""}
                    />
                  ) : (
                    <div className="epx-bg-ctrl__thumb-placeholder">🖼️</div>
                  )}
                  <span className="epx-bg-ctrl__media-name">
                    {img?.filename ?? (img ? "Image selected" : "No image")}
                  </span>
                  <button
                    type="button"
                    className="epx-bg-ctrl__media-btn"
                    onClick={() => setImagePickerOpen(true)}
                  >
                    {img ? "Change" : "Select"}
                  </button>
                  {img && (
                    <button
                      type="button"
                      className="epx-bg-ctrl__stop-remove"
                      onClick={() => onChange({ image: undefined })}
                      title="Clear"
                    >
                      ✕
                    </button>
                  )}
                </div>

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
        </div>
      )}

      {activeTab === "style" && block.type === "text" && (
        <div className="epx-right-panel__fields">
          <AlignControl
            value={alignValue}
            onChange={handleAlign}
            breakpointIndicator={isNonDesktop ? breakpointIndicator : undefined}
          />
          <TypographyControl
            value={typographyValue}
            onChange={handleTypography}
            breakpointIndicator={isNonDesktop ? breakpointIndicator : undefined}
          />
          <TextStrokeControl
            value={strokeValue}
            onChange={handleStroke}
            breakpointIndicator={isNonDesktop ? breakpointIndicator : undefined}
          />
          <TextShadowControl
            value={shadowTextValue}
            onChange={handleTextShadow}
            breakpointIndicator={isNonDesktop ? breakpointIndicator : undefined}
          />
          <BlendModeControl
            value={blendModeValue}
            onChange={handleBlendMode}
            breakpointIndicator={isNonDesktop ? breakpointIndicator : undefined}
          />
        </div>
      )}

      {activeTab === "style" && block.type !== "text" && (
        <div className="epx-right-panel__fields">
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
