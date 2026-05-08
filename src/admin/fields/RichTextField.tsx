import React, { useEffect, useState } from "react";
import type { RichTextValue } from "../../types.js";

interface Props {
  value: RichTextValue;
  onChange: (v: RichTextValue) => void;
  placeholder?: string;
}

// Lazy-load PortableTextEditor + Lingui I18nProvider from the host's
// `@emdash-cms/admin` + `@lingui/*` packages (peerDeps; provided by host).
type EditorComponent = React.ComponentType<{
  value?: RichTextValue;
  onChange?: (v: RichTextValue) => void;
  placeholder?: string;
  className?: string;
}>;

interface ProviderComponent extends React.FC<{ i18n: unknown; children: React.ReactNode }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface Bundle {
  Editor: EditorComponent;
  Provider: ProviderComponent;
  i18n: unknown;
}

let cached: Bundle | null | undefined = undefined;
let loadPromise: Promise<Bundle | null> | null = null;

function loadBundle(): Promise<Bundle | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminMod: any = await import(/* @vite-ignore */ "@emdash-cms/admin");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linguiCore: any = await import(/* @vite-ignore */ "@lingui/core");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linguiReact: any = await import(/* @vite-ignore */ "@lingui/react");
      const Editor = (adminMod?.PortableTextEditor ?? adminMod?.default?.PortableTextEditor) as EditorComponent | undefined;
      const Provider = (linguiReact?.I18nProvider ?? linguiReact?.default?.I18nProvider) as ProviderComponent | undefined;
      const i18n = linguiCore?.i18n ?? linguiCore?.default?.i18n;
      if (!Editor || !Provider || !i18n) {
        cached = null;
        return null;
      }
      // Activate a default locale so useLingui() resolves.
      try {
        if (typeof i18n.load === "function") i18n.load("en", {});
        if (typeof i18n.activate === "function") i18n.activate("en");
      } catch { /* already activated */ }
      cached = { Editor, Provider, i18n };
      return cached;
    } catch {
      cached = null;
      return null;
    }
  })();
  return loadPromise;
}

export function RichTextField({ value, onChange, placeholder }: Props) {
  const [bundle, setBundle] = useState<Bundle | null | undefined>(cached);

  useEffect(() => {
    if (bundle !== undefined) return;
    loadBundle().then((b) => setBundle(b));
  }, [bundle]);

  if (bundle === undefined) {
    return <div className="epx-field__loading" style={{ fontSize: 12, color: "var(--epx-text-faint)" }}>Loading editor…</div>;
  }

  if (bundle === null) {
    const json = JSON.stringify(value, null, 2);
    return (
      <div>
        <p style={{ fontSize: 11, color: "#c0392b" }}>
          Rich text editor unavailable. Edit raw Portable Text JSON below.
        </p>
        <textarea
          className="epx-field__textarea"
          rows={6}
          value={json}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (Array.isArray(parsed)) onChange(parsed);
            } catch { /* ignore until valid */ }
          }}
        />
      </div>
    );
  }

  const { Editor, Provider, i18n } = bundle;

  return (
    <Provider i18n={i18n}>
      <Editor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="epx-rich-text"
      />
    </Provider>
  );
}
