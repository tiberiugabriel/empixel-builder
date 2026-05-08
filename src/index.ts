import type { PluginDescriptor } from "emdash";

export function empixelBuilder(): PluginDescriptor {
  return {
    id: "empixel-builder",
    version: "0.7.0",
    format: "native",
    entrypoint: "empixel-builder/plugin",
    adminEntry: "empixel-builder/admin",
    componentsEntry: "empixel-builder/astro",
    capabilities: ["read:content"],
    adminPages: [
      {
        path: "/editor",
        label: "EmPixel Builder",
        icon: "layout",
      },
    ],
  };
}
