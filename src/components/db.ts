import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";
import { getDb as getSharedDb } from "../dbShared.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) so they MUST be validated. Loose input
// here is unlikely (host caller), but the cost is one regex test per load.
const COLLECTION_RE = /^[a-z0-9_]+$/;

// EmDash ULIDs — 26-char Crockford base32. Used to short-circuit the slug
// → ULID resolution when the host already passed a canonical id.
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function getBuilderLayout(collection: string, entryId: string, enabled?: boolean): SectionBlock[] | null {
  if (enabled === false) return null;
  if (!COLLECTION_RE.test(collection)) return null;
  try {
    // Shared handle owned by `dbShared.ts`; the plugin runtime opens the
    // same file for writes, so this reader piggy-backs on that connection
    // instead of opening a second one. The default path is
    // `<process.cwd()>/data.db` unless `empixelBuilder({ databasePath })`
    // overrode it at plugin construction time.
    const db = getSharedDb();

    // Resolve slug → ULID up front when the caller passed a slug. Layouts on
    // disk are ULID-keyed (after `runSlugToUlidMigration_v1`), so a single
    // direct query is enough — the previous slug↔ULID fallback chain is gone.
    let lookupId = entryId;
    if (!ULID_RE.test(entryId)) {
      const idRow = db
        .prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`)
        .get(entryId) as { id: string } | undefined;
      if (idRow && idRow.id) lookupId = idRow.id;
    }

    const row = db
      .prepare("SELECT sections, enabled FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
      .get(collection, lookupId) as { sections: string; enabled: number } | undefined;

    if (!row || !row.enabled) return null;
    const parsed = JSON.parse(row.sections) as SectionBlock[];
    return stripUnknownBlocks(parsed);
  } catch {
    return null;
  }
}
