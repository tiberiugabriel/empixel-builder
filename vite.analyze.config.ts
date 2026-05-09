import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * F4.3 — Bundle-analysis config for `npm run analyze`.
 *
 * The plugin ships `tsc`-compiled JS today (no Vite of its own). The
 * EmDash host application is what bundles the admin entry into a
 * browser chunk. This config replicates the host's bundling work
 * locally so we can measure what the admin app contributes to the
 * consumer bundle:
 *
 * - Entry: `src/admin/index.tsx` (the same module the host imports as
 *   `empixel-builder/admin`).
 * - Externals: peer deps that the host already provides (React,
 *   ReactDOM, EmDash plugin-utils, dnd-kit). They show as zero in
 *   the report, which is the same signal the host bundler sees.
 *
 * Run via `vite-bundle-visualizer -c vite.analyze.config.ts ...`. The
 * visualizer wraps `vite build` + `rollup-plugin-visualizer` and emits
 * `stats.html` (treemap) plus the standard build manifest under
 * `dist-analyze/`.
 */
export default defineConfig({
  build: {
    outDir: "dist-analyze",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/admin/index.tsx"),
      formats: ["es"],
      fileName: "admin",
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-dom/client",
        "react-dom/server",
        "emdash",
        "emdash/plugin-utils",
        "@emdash-cms/admin",
        "@dnd-kit/core",
        "@dnd-kit/sortable",
        "@dnd-kit/utilities",
      ],
    },
  },
  esbuild: {
    jsx: "automatic",
  },
});
