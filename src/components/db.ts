import { createRequire } from "node:module";
import { join } from "node:path";
import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) so they MUST be validated. Loose input
// here is unlikely (host caller), but the cost is one regex test per load.
const COLLECTION_RE = /^[a-z0-9_]+$/;

interface SqliteStatement {
  get(...args: unknown[]): unknown;
}

interface SqliteDb {
  prepare(sql: string): SqliteStatement;
}

const _require = createRequire(import.meta.url);
let _db: SqliteDb | null = null;

function getDb(): SqliteDb {
  if (_db) return _db;
  const Database = _require("better-sqlite3");
  _db = new Database(join(process.cwd(), "data.db"), { readonly: true }) as SqliteDb;
  return _db;
}

export function getBuilderLayout(collection: string, entryId: string, enabled?: boolean): SectionBlock[] | null {
  if (enabled === false) return null;
  if (!COLLECTION_RE.test(collection)) return null;
  try {
    const db = getDb();

    // Attempt 1: Direct lookup (could be ULID or slug depending on what was passed)
    let row = db
      .prepare("SELECT sections, enabled FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
      .get(collection, entryId) as { sections: string; enabled: number } | undefined;

    // Attempt 2: If not found, try to resolve to the other ID type
    if (!row) {
      if (entryId.startsWith("01")) {
        // It's a ULID, maybe the layout was saved with a slug?
        const slugRow = db.prepare(`SELECT slug FROM ec_${collection} WHERE id = ?`).get(entryId) as { slug: string } | undefined;
        if (slugRow && slugRow.slug) {
          row = db
            .prepare("SELECT sections, enabled FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
            .get(collection, slugRow.slug) as { sections: string; enabled: number } | undefined;
        }
      } else {
        // It's a slug, maybe the layout was saved with a ULID?
        const idRow = db.prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`).get(entryId) as { id: string } | undefined;
        if (idRow && idRow.id) {
          row = db
            .prepare("SELECT sections, enabled FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
            .get(collection, idRow.id) as { sections: string; enabled: number } | undefined;
        }
      }
    }

    if (!row || !row.enabled) return null;
    const parsed = JSON.parse(row.sections) as SectionBlock[];
    return stripUnknownBlocks(parsed);
  } catch {
    return null;
  }
}
