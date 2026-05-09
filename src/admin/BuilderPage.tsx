import { useEffect, useState } from "react";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import { Builder } from "./builder/Builder.js";
import { BuilderStyles } from "./builder/BuilderStyles.js";
import { PageSelector } from "./PageSelector.js";

// F4.4 — known entry-level field names exposed by the `/entries` route
// today. The route returns `id, slug, title, builder_enabled,
// created_at, updated_at` per row (`plugin.ts` ~line 344). We surface
// the writable scalars (`title`, `slug`, `id`) as the default palette
// for the LeftPanel "Bound to this entry" section. Authors can rebind
// the resulting `field-binding` block to ANY entry key via the Fields
// tab — the palette is just a one-click shortcut for the obvious
// candidates. Expanding the palette to include `entry.data` keys
// (excerpt, image, body, etc.) is a future PR that needs an
// `/entries/:id` API on Agent A's side.
const DEFAULT_ENTRY_FIELDS: string[] = ["title", "slug", "id"];

export function BuilderPage() {
  const params = new URLSearchParams(window.location.search);
  const initialPageId = params.get("pageId");
  const initialCollection = params.get("collection");

  const needsResolve = !!(initialPageId && initialCollection);
  const [selected, setSelected] = useState<{ id: string; title: string; collection: string } | null>(null);
  const [resolving, setResolving] = useState(needsResolve);

  useEffect(() => {
    if (!initialPageId || !initialCollection) return;
    apiFetch(`/_emdash/api/plugins/empixel-builder/entries?collection=${initialCollection}`)
      .then(res => parseApiResponse<{ data: { id: string; title: string }[] }>(res, "Failed to load entries"))
      .then(({ data }) => {
        const entry = data?.find(e => e.id === initialPageId);
        setSelected(entry
          ? { id: entry.id, title: entry.title, collection: initialCollection }
          : { id: initialPageId, title: initialPageId, collection: initialCollection }
        );
      })
      .catch(() => {
        setSelected({ id: initialPageId, title: initialPageId, collection: initialCollection });
      })
      .finally(() => setResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selected) {
      url.searchParams.set("pageId", selected.id);
      url.searchParams.set("collection", selected.collection);
    } else {
      url.searchParams.delete("pageId");
      url.searchParams.delete("collection");
    }
    history.replaceState(null, "", url.toString());
  }, [selected]);

  if (resolving) return <BuilderStyles />;

  return (
    <>
      {selected ? (
        <Builder
          pageId={selected.id}
          pageTitle={selected.title}
          collection={selected.collection}
          entryFields={DEFAULT_ENTRY_FIELDS}
          onBack={() => setSelected(null)}
        />
      ) : (
        <PageSelector onSelect={(id, title, collection) => setSelected({ id, title, collection })} />
      )}
      <BuilderStyles />
    </>
  );
}
