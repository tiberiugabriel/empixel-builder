import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export type CodeLanguage = "css" | "html" | "js";

interface Props {
  value: string;
  onChange: (v: string) => void;
  language?: CodeLanguage;
  selectorHeader?: string;
  placeholder?: string;
}

const HTML_TAGS = [
  "a", "abbr", "address", "area", "article", "aside", "audio",
  "b", "blockquote", "body", "br", "button",
  "canvas", "caption", "cite", "code",
  "data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt",
  "em", "embed",
  "fieldset", "figcaption", "figure", "footer", "form",
  "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr", "html",
  "i", "iframe", "img", "input", "ins",
  "kbd",
  "label", "legend", "li", "link",
  "main", "map", "mark", "menu", "meta", "meter",
  "nav", "noscript",
  "object", "ol", "optgroup", "option", "output",
  "p", "picture", "pre", "progress",
  "q",
  "rp", "rt", "ruby",
  "s", "samp", "script", "section", "select", "small", "source", "span", "strong", "style", "sub", "summary", "sup", "svg",
  "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track",
  "u", "ul",
  "var", "video",
  "wbr",
];

const HTML_ATTRS_GLOBAL = [
  "id", "class", "style", "title", "lang", "dir", "tabindex", "hidden",
  "data-*", "aria-label", "aria-hidden", "aria-describedby", "role",
  "onclick", "onload", "onchange",
];

const HTML_ATTRS_BY_TAG: Record<string, string[]> = {
  a:      ["href", "target", "rel", "download"],
  img:    ["src", "alt", "width", "height", "loading", "decoding", "srcset", "sizes"],
  input:  ["type", "name", "value", "placeholder", "required", "checked", "disabled", "min", "max", "step", "pattern"],
  form:   ["action", "method", "enctype", "novalidate", "autocomplete"],
  button: ["type", "name", "value", "disabled", "form"],
  iframe: ["src", "title", "loading", "allow", "allowfullscreen", "referrerpolicy", "sandbox"],
  video:  ["src", "controls", "autoplay", "muted", "loop", "playsinline", "poster", "preload"],
  audio:  ["src", "controls", "autoplay", "muted", "loop", "preload"],
  source: ["src", "srcset", "type", "media"],
  link:   ["rel", "href", "type", "media", "crossorigin"],
  meta:   ["name", "content", "charset", "http-equiv", "property"],
  script: ["src", "type", "async", "defer", "crossorigin"],
  label:  ["for"],
  td:     ["colspan", "rowspan"],
  th:     ["colspan", "rowspan", "scope"],
};

interface Suggestion {
  label: string;
  insert: string;
  /** caret offset within `insert` after selection (default = insert.length) */
  caretOffset?: number;
}

const CSS_KEYWORDS = ["selector"];

function getSuggestions(
  value: string,
  caret: number,
  language: CodeLanguage,
): { items: Suggestion[]; replaceFrom: number; replaceTo: number } | null {
  const before = value.slice(0, caret);

  if (language === "css") {
    // Suggest `selector` (and other top-level CSS keywords) when typing a word
    // at the start of a line or after `{`/`}`/`;`.
    const m = before.match(/(^|[\n;{}])\s*([a-zA-Z][a-zA-Z-]*)$/);
    if (m) {
      const partial = m[2].toLowerCase();
      const items = CSS_KEYWORDS
        .filter((k) => k.startsWith(partial))
        .slice(0, 10)
        .map<Suggestion>((k) => ({ label: k, insert: k }));
      if (!items.length) return null;
      return { items, replaceFrom: caret - partial.length, replaceTo: caret };
    }
    return null;
  }

  if (language !== "html") return null;

  // After '<' — suggest tags
  const tagOpen = before.match(/<([a-zA-Z][a-zA-Z0-9]*)?$/);
  if (tagOpen) {
    const partial = (tagOpen[1] ?? "").toLowerCase();
    const items = HTML_TAGS
      .filter((t) => t.startsWith(partial))
      .slice(0, 10)
      .map<Suggestion>((t) => ({ label: t, insert: t }));
    if (!items.length) return null;
    return { items, replaceFrom: caret - partial.length, replaceTo: caret };
  }

  // Inside an open tag — suggest attrs
  const attr = before.match(/<([a-zA-Z][a-zA-Z0-9]*)\s+(?:[^<>]*\s+)?([a-zA-Z-]*)$/);
  if (attr) {
    const tag = attr[1].toLowerCase();
    const partial = (attr[2] ?? "").toLowerCase();
    if (!partial && before[before.length - 1] !== " ") return null;
    const tagAttrs = HTML_ATTRS_BY_TAG[tag] ?? [];
    const all = [...tagAttrs, ...HTML_ATTRS_GLOBAL];
    const items = all
      .filter((a) => a.startsWith(partial))
      .slice(0, 12)
      .map<Suggestion>((a) => {
        if (a.endsWith("*")) {
          const stem = a.slice(0, -1);
          return { label: a, insert: `${stem}=""`, caretOffset: stem.length + 2 };
        }
        return { label: a, insert: `${a}=""`, caretOffset: a.length + 2 };
      });
    if (!items.length) return null;
    return { items, replaceFrom: caret - partial.length, replaceTo: caret };
  }

  return null;
}

export function CodeEditor({
  value,
  onChange,
  language = "css",
  selectorHeader,
  placeholder,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumsRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    items: Suggestion[];
    replaceFrom: number;
    replaceTo: number;
  } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!suggestions) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const r = ta.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 2, left: r.left, width: Math.min(r.width, 240) });
  }, [suggestions]);

  // Auto-grow textarea to its content; outer scroll handled by panel.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  const copyHeader = () => {
    if (!selectorHeader) return;
    navigator.clipboard.writeText(selectorHeader).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const lineCount = value === "" ? 1 : value.split("\n").length;

  const handleScroll = () => {
    if (lineNumsRef.current && textareaRef.current) {
      lineNumsRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const insertCompletion = (sug: Suggestion, replaceFrom: number, replaceTo: number) => {
    const next = value.substring(0, replaceFrom) + sug.insert + value.substring(replaceTo);
    onChange(next);
    const caretPos = replaceFrom + (sug.caretOffset ?? sug.insert.length);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = caretPos;
    });
  };

  const updateSuggestions = (next: string, caret: number) => {
    const sug = getSuggestions(next, caret, language);
    setSuggestions(sug);
    setActiveIdx(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Suggestions navigation
    if (suggestions && suggestions.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.items.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.items.length) % suggestions.items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertCompletion(suggestions.items[activeIdx], suggestions.replaceFrom, suggestions.replaceTo);
        setSuggestions(null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions(null);
        return;
      }
    }

    // Tab key → insert 4 spaces (when no suggestions)
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.substring(0, start) + "    " + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    updateSuggestions(next, e.target.selectionStart);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    updateSuggestions(ta.value, ta.selectionStart);
  };

  // Close suggestions when clicking outside textarea
  useEffect(() => {
    if (!suggestions) return;
    const onDown = (e: MouseEvent) => {
      const ta = textareaRef.current;
      const target = e.target as Node;
      if (ta && !ta.contains(target)) {
        // allow clicks on dropdown — we register dropdown's mousedown handler
        const dropdown = document.querySelector(".epx-code-editor__suggestions");
        if (dropdown && dropdown.contains(target)) return;
        setSuggestions(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [suggestions]);

  const ph =
    placeholder ??
    (language === "html"
      ? `<div class="hello">\n  Hello world\n</div>`
      : language === "css"
      ? `color: red;\nfont-size: 18px;`
      : `console.log("hello");`);

  const dropdownStyle: React.CSSProperties = dropdownPos
    ? {
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }
    : {};

  return (
    <div className="epx-code-editor">
      {selectorHeader && (
        <div className="epx-code-editor__header">
          <button
            type="button"
            className="epx-code-editor__copy-btn"
            onClick={copyHeader}
            title="Copy"
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <rect x="4" y="1" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <rect x="1" y="3" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="var(--epx-surface-code)" />
              </svg>
            )}
          </button>
          <div className="epx-code-editor__selector-scroll">
            <span className="epx-code-editor__selector-kw">selector</span>
            <span className="epx-code-editor__selector-eq"> = </span>
            <span className="epx-code-editor__selector-val">{selectorHeader}</span>
          </div>
        </div>
      )}
      <div className="epx-code-editor__body">
        <div ref={lineNumsRef} className="epx-code-editor__line-nums" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="epx-code-editor__line-num">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="epx-code-editor__textarea"
          value={value}
          placeholder={ph}
          spellCheck={false}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onChange={handleChange}
          onBlur={() => {
            // delay so click on dropdown registers first
            setTimeout(() => setSuggestions(null), 100);
          }}
        />
      </div>
      {suggestions && suggestions.items.length > 0 && dropdownPos && (
        <div className="epx-code-editor__suggestions" style={dropdownStyle}>
          {suggestions.items.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`epx-code-editor__suggestion${i === activeIdx ? " is-active" : ""}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                insertCompletion(s, suggestions.replaceFrom, suggestions.replaceTo);
                setSuggestions(null);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
