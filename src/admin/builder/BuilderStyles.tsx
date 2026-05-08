// CSS lives in `./styles/builder.css` since v0.6+ (audit M2). Importing the
// stylesheet at module scope is enough — Vite/Astro injects it into the
// document on first load. The component below stays for compat with the
// original render-time API in BuilderPage; it returns null so it adds no DOM.
//
// Build pipeline: `tsc` doesn't copy CSS, so `package.json#scripts.build`
// also runs `cp -r src/admin/builder/styles dist/admin/builder/styles`.
import "./styles/builder.css";

export function BuilderStyles() {
  return null;
}
