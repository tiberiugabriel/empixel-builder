import React, { memo, useEffect, useRef, useState } from "react";

interface PreviewProps {
  config: Record<string, unknown>;
}

function buildSrcdoc(code: string): string {
  const hasFullDoc = /<html[\s>]/i.test(code);
  if (hasFullDoc) return code;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;}</style></head><body>${code}</body></html>`;
}

export const HtmlPreview = memo(function HtmlPreview({ config }: PreviewProps) {
  const code = (config.code as string) || "";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;

    const measure = () => {
      try {
        const doc = f.contentDocument;
        if (!doc || !doc.documentElement) return;
        // Collapse iframe before measuring so user CSS using vh / 100% body
        // height can't feed back. Layout is recomputed synchronously, painted
        // only at next frame — flicker is invisible.
        f.style.height = "0px";
        void doc.documentElement.offsetHeight;
        const h = Math.max(
          doc.documentElement.scrollHeight,
          doc.documentElement.offsetHeight,
          doc.body ? doc.body.scrollHeight : 0,
          doc.body ? doc.body.offsetHeight : 0,
        );
        if (h > 0) {
          f.style.height = `${h}px`;
          setHeight(h);
        }
      } catch {
        /* cross-origin */
      }
    };

    let ro: ResizeObserver | undefined;
    let mo: MutationObserver | undefined;

    const init = () => {
      measure();
      try {
        const doc = f.contentDocument;
        if (!doc) return;
        if (typeof ResizeObserver !== "undefined" && doc.body) {
          ro = new ResizeObserver(() => measure());
          ro.observe(doc.body);
        }
        if (typeof MutationObserver !== "undefined" && doc.body) {
          mo = new MutationObserver(() => measure());
          mo.observe(doc.body, { attributes: true, childList: true, subtree: true, characterData: true });
        }
        const imgs = doc.querySelectorAll("img");
        imgs.forEach((img) => img.addEventListener("load", measure));
      } catch {
        /* cross-origin */
      }
    };

    f.addEventListener("load", init);
    if (f.contentDocument && f.contentDocument.readyState === "complete") init();

    return () => {
      f.removeEventListener("load", init);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [code]);

  if (!code.trim()) {
    return <span style={{ color: "#bbb", fontStyle: "italic", fontSize: 12 }}>HTML block</span>;
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      scrolling="no"
      srcDoc={buildSrcdoc(code)}
      style={{ width: "100%", height: height || 0, border: 0, display: "block" }}
    />
  );
});
