// Allow `import X from "./Foo.astro"` to typecheck under bare `tsc` without
// the Astro toolchain. Astro CLI / IDE plugin re-checks these files itself.
declare module "*.astro" {
  const Component: unknown;
  export default Component;
}

// CSS imports (audit M2) — admin entry imports a stylesheet for side-effect.
// tsc preserves the import statement; consumer bundlers (Vite/Astro) resolve
// the file and inject it into the document.
declare module "*.css";
