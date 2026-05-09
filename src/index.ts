import type { PluginDescriptor } from "emdash";
import { setDefaultDatabasePath } from "./dbShared.js";

export interface EmpixelBuilderOptions {
  /**
   * Override the path to the SQLite file backing the plugin's layout store.
   * Defaults to `<process.cwd()>/data.db` (the host EmDash site's database).
   * Both the plugin runtime and the frontend reader resolve through the
   * shared `getDb()` factory in `src/dbShared.ts`.
   */
  databasePath?: string;
}

export function empixelBuilder(options?: EmpixelBuilderOptions): PluginDescriptor {
  // Record the path so subsequent `getDb()` calls (from `plugin.ts` and the
  // Astro reader in `components/db.ts`) resolve to it without each call site
  // having to thread the option through.
  setDefaultDatabasePath(options?.databasePath);

  return {
    id: "empixel-builder",
    version: "0.7.1",
    format: "native",
    entrypoint: "empixel-builder/plugin",
    adminEntry: "empixel-builder/admin",
    componentsEntry: "empixel-builder/astro",
    capabilities: ["content:read"],
    adminPages: [
      {
        path: "/editor",
        label: "EmPixel Builder",
        icon: "layout",
      },
    ],
  };
}
