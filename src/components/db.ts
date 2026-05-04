import { createRequire } from "node:module";
import { join } from "node:path";
import type { SectionBlock } from "../types.js";

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
  try {
    const row = getDb()
      .prepare("SELECT sections, enabled FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
      .get(collection, entryId) as { sections: string; enabled: number } | undefined;
    if (!row || !row.enabled) return null;
    return JSON.parse(row.sections) as SectionBlock[];
  } catch {
    return null;
  }
}
