import React, { memo } from "react";
import type { BreakpointId, RichTextValue } from "../../types.js";

interface PreviewProps {
  config: Record<string, unknown>;
  activeBreakpoint?: BreakpointId;
}

interface PortableSpan {
  _type?: "span";
  _key?: string;
  text?: string;
  marks?: string[];
}

interface PortableMarkDef {
  _key?: string;
  _type?: string;
  href?: string;
}

interface PortableBlock {
  _type?: string;
  _key?: string;
  style?: string;
  level?: number;
  listItem?: string;
  children?: PortableSpan[];
  markDefs?: PortableMarkDef[];
  asset?: { storageKey?: string; url?: string };
  storageKey?: string;
  url?: string;
  alt?: string;
}

function renderSpan(span: PortableSpan, markDefs: PortableMarkDef[], key: string): React.ReactNode {
  let node: React.ReactNode = span.text ?? "";
  const marks = span.marks ?? [];
  for (const m of marks) {
    if (m === "strong") node = <strong key={key + "_s"}>{node}</strong>;
    else if (m === "em") node = <em key={key + "_e"}>{node}</em>;
    else if (m === "code") node = <code key={key + "_c"}>{node}</code>;
    else if (m === "underline") node = <u key={key + "_u"}>{node}</u>;
    else if (m === "strike-through") node = <s key={key + "_st"}>{node}</s>;
    else {
      const def = markDefs.find((d) => d._key === m);
      if (def && def._type === "link" && def.href) {
        node = <a key={key + "_l"} href={def.href}>{node}</a>;
      }
    }
  }
  return <React.Fragment key={key}>{node}</React.Fragment>;
}

function renderBlock(block: PortableBlock, idx: number): React.ReactNode {
  const key = block._key ?? `b-${idx}`;

  if (block._type === "image") {
    const sk = block.asset?.storageKey ?? block.storageKey;
    const url = block.url ?? block.asset?.url ?? (sk ? `/_emdash/api/media/file/${sk}` : undefined);
    if (!url) return null;
    return <img key={key} src={url} alt={block.alt ?? ""} style={{ maxWidth: "100%", height: "auto", display: "block", margin: "8px 0" }} />;
  }

  if (block._type !== "block") return null;

  const children = (block.children ?? []).map((c, i) => renderSpan(c, block.markDefs ?? [], `${key}-${i}`));
  const style = block.style ?? "normal";

  switch (style) {
    case "h1": return <h1 key={key}>{children}</h1>;
    case "h2": return <h2 key={key}>{children}</h2>;
    case "h3": return <h3 key={key}>{children}</h3>;
    case "h4": return <h4 key={key}>{children}</h4>;
    case "h5": return <h5 key={key}>{children}</h5>;
    case "h6": return <h6 key={key}>{children}</h6>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    default: return <p key={key} style={{ margin: "0 0 8px" }}>{children}</p>;
  }
}

function renderPortableText(content: RichTextValue): React.ReactNode {
  if (!Array.isArray(content) || content.length === 0) return null;
  return (content as PortableBlock[]).map((b, i) => renderBlock(b, i));
}

export const TextEditorPreview = memo(function TextEditorPreview({ config, activeBreakpoint }: PreviewProps) {
  // Per-breakpoint merge for text-editor's config-level keys.
  const cfgBps = (config.configBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const stBps = (config.styleBreakpoints ?? {}) as Record<string, Record<string, unknown>>;
  const isNonDesktop = activeBreakpoint && activeBreakpoint !== "desktop";
  const cfgBp = isNonDesktop ? cfgBps[activeBreakpoint!] ?? {} : {};
  const stBp = isNonDesktop ? stBps[activeBreakpoint!] ?? {} : {};

  const dropCap =
    (cfgBp.dropCap as boolean | undefined) ?? !!config.dropCap;
  const columnsRaw = ((cfgBp.columns as string | undefined) ?? (config.columns as string)) ?? "1";
  const columnsCustom =
    (cfgBp.columnsCustom as number | undefined) ?? (config.columnsCustom as number | undefined);
  const colCount = columnsRaw === "custom" ? (columnsCustom ?? 2) : Number(columnsRaw) || 1;
  const columnsGapRaw = ((cfgBp.columnsGap as string | undefined) ?? (config.columnsGap as string)) ?? "";
  const columnsGap = columnsGapRaw.trim() ? columnsGapRaw : "0px";

  const baseStyle = (config.style ?? {}) as Record<string, unknown>;
  // For drop-cap inputs + paragraphSpacing + linkColor, merge bp style (already handled by Canvas wrapper but we need scoped CSS for ::first-letter etc.)
  const effStyle = isNonDesktop ? { ...baseStyle, ...stBp } : baseStyle;
  const linkColor = (effStyle.linkColor as string) || "";
  const linkAlpha = typeof effStyle.linkColorAlpha === "number" ? (effStyle.linkColorAlpha as number) : 1;
  const paragraphSpacing = (effStyle.paragraphSpacing as string) || "";

  const isEmpty = !Array.isArray(config.content) || (config.content as RichTextValue).length === 0;

  if (isEmpty) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>Text Editor block</span>;
  }

  const wrapStyle: React.CSSProperties = {
    columnCount: colCount,
    columnGap: columnsGap,
  };

  const scopedCss: string[] = [];
  if (dropCap) {
    scopedCss.push(`.epx-textedit-preview > *:first-child::first-letter{
      font-size:${(effStyle.dropCapSize as string) || "3em"};
      line-height:${(effStyle.dropCapLines as string) || "0.85"};
      float:left;
      margin-right:${(effStyle.dropCapMarginRight as string) || "6px"};
      margin-top:4px;
    }`);
  }
  if (paragraphSpacing) {
    scopedCss.push(`.epx-textedit-preview p + p{margin-top:${paragraphSpacing};}`);
  }
  if (linkColor) {
    scopedCss.push(`.epx-textedit-preview a{color:${linkColor};opacity:${linkAlpha};}`);
  }

  return (
    <div className="epx-textedit-preview" style={wrapStyle}>
      {renderPortableText(config.content as RichTextValue)}
      {scopedCss.length > 0 && <style dangerouslySetInnerHTML={{ __html: scopedCss.join("") }} />}
    </div>
  );
});
