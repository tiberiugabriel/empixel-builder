import type { PluginDescriptor } from "emdash";

/**
 * Plugin options. As of v0.9.0 this shape is empty — the
 * `databasePath` option (introduced in v0.7.1, removed in v0.9.0) is
 * gone because the plugin no longer opens its own SQLite handle. All
 * reads + writes go through EmDash's `ctx.storage` multi-driver
 * abstraction; the database driver is configured at the EmDash root in
 * `astro.config.mjs`, not on the plugin.
 *
 * Defined as an alias of `Record<string, never>` so future options can
 * be added without a breaking signature change while keeping ESLint's
 * `no-empty-object-type` happy.
 */
export type EmpixelBuilderOptions = Record<string, never>;

export function empixelBuilder(_options?: EmpixelBuilderOptions): PluginDescriptor {
  return {
    id: "empixel-builder",
    version: "1.0.0",
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
