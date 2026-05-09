#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = "astro.config.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function findConfig() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function alreadyRegistered(src) {
  return src.includes("empixel-builder") && src.includes("empixelBuilder");
}

function addImport(src) {
  if (src.includes('from "empixel-builder"') || src.includes("from 'empixel-builder'")) {
    return src;
  }
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  const insertAt = lastImportIdx >= 0 ? lastImportIdx + 1 : 0;
  lines.splice(insertAt, 0, 'import { empixelBuilder } from "empixel-builder";');
  return lines.join("\n");
}

function addPlugin(src) {
  return src.replace(
    /plugins:\s*\[([^\]]*)\]/,
    (match, inner) => {
      const trimmed = inner.trim();
      const separator = trimmed.length > 0 ? ", " : "";
      return `plugins: [${trimmed}${separator}empixelBuilder()]`;
    }
  );
}

// ── Page file patching ────────────────────────────────────────────────────────

/** Recursively find all [slug].astro files under a directory */
function findSlugFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findSlugFiles(full, results);
    } else if (entry.name === "[slug].astro") {
      results.push(full);
    }
  }
  return results;
}

/**
 * Patch a single [slug].astro file to add builder rendering.
 * Only modifies files that contain getEmDashEntry and don't already have empixel-builder.
 * Returns the collection name if patched, null otherwise.
 */
function patchPageFile(filePath) {
  let src = fs.readFileSync(filePath, "utf-8");

  if (src.includes("empixel-builder/astro")) return null; // already patched
  if (!src.includes("getEmDashEntry")) return null;        // not an EmDash page

  // Extract collection name from getEmDashEntry("collection", ...)
  const collMatch = src.match(/getEmDashEntry\(["'](\w+)["']/);
  if (!collMatch) return null;
  const collection = collMatch[1];

  // Extract entry variable name from: const { entry: varName, ... } = await getEmDashEntry(...)
  const entryVarMatch = src.match(/entry:\s*(\w+)/);
  const entryVar = entryVarMatch ? entryVarMatch[1] : "page";

  // Parse frontmatter (between first --- and second ---)
  if (!src.startsWith("---")) return null;
  const fmClose = src.indexOf("\n---", 3);
  if (fmClose === -1) return null;

  let frontmatter = src.slice(3, fmClose);       // content inside ---
  let template = src.slice(fmClose + 4);          // everything after closing ---

  // 1. Add builder import after last existing import line
  const fmLines = frontmatter.split("\n");
  let lastImport = -1;
  for (let i = 0; i < fmLines.length; i++) {
    if (fmLines[i].trimStart().startsWith("import ")) lastImport = i;
  }
  fmLines.splice(
    lastImport + 1,
    0,
    `import { getBuilderLayout, BuilderWrapper } from "empixel-builder/astro";`
  );
  frontmatter = fmLines.join("\n");

  // 2. Add getBuilderLayout call before closing --- (after Astro.cache.set line)
  frontmatter = frontmatter.replace(
    /(Astro\.cache\.set\([^)]+\);?)/,
    `$1\n\nconst builderLayout = getBuilderLayout("${collection}", ${entryVar}.data.id);`
  );

  // 3. Wrap the content inside <Base> with BuilderWrapper (slot pattern avoids Astro parser issues)
  template = template.replace(
    /(<Base[^>]*>)([\s\S]*?)(<\/Base>)/,
    (_, open, inner, close) => {
      const indent = "\t";
      return (
        `${open}\n` +
        `${indent}<BuilderWrapper sections={builderLayout}>\n` +
        inner.replace(/^/gm, indent) +
        `${indent}</BuilderWrapper>\n` +
        close
      );
    }
  );

  fs.writeFileSync(filePath, `---${frontmatter}\n---${template}`, "utf-8");
  return collection;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const configPath = findConfig();

if (!configPath) {
  console.error(`Could not find ${CONFIG_FILE}. Run this command from your Astro project root.`);
  process.exit(1);
}

const projectDir = path.dirname(configPath);

// 1. Register plugin in astro.config.mjs
let src = fs.readFileSync(configPath, "utf-8");

if (alreadyRegistered(src)) {
  console.log("✓ empixel-builder already registered in astro.config.mjs");
} else {
  if (!src.includes("plugins:")) {
    console.error(
      "Could not find a plugins: [] array in astro.config.mjs.\n" +
      "Make sure you have emdash({ plugins: [] }) configured, then run this command again."
    );
    process.exit(1);
  }
  src = addImport(src);
  src = addPlugin(src);
  fs.writeFileSync(configPath, src, "utf-8");
  console.log(`✓ empixel-builder added to astro.config.mjs`);
}

// 2. Patch [slug].astro page files (storage table is provisioned by EmDash on first run via ctx.storage)
const pagesDir = path.join(projectDir, "src", "pages");
if (fs.existsSync(pagesDir)) {
  const slugFiles = findSlugFiles(pagesDir);
  let patched = 0;
  for (const file of slugFiles) {
    const collection = patchPageFile(file);
    if (collection) {
      console.log(`✓ Patched ${path.relative(projectDir, file)} (collection: ${collection})`);
      patched++;
    }
  }
  if (patched === 0 && slugFiles.length > 0) {
    console.log("✓ Page files already up to date");
  }
}

console.log("\nRestart your dev server to apply the changes.\n");
