[![npm](https://img.shields.io/npm/v/empixel-builder)](https://www.npmjs.com/package/empixel-builder) [![EmDash](https://img.shields.io/badge/EmDash-v0.9.0%20✅-90EE90)](https://github.com/emdash-cms/emdash)

# EmPixel Builder

> **Work in progress** — this plugin is in active development and may contain bugs. Contributions are welcome!

> **Native plugin only** — empixel-builder uses a custom React admin page and relies on Node.js APIs (SQLite via `better-sqlite3`). It cannot be used in Cloudflare Workers or other edge/serverless environments.

Page builder plugin for [EmDash](https://github.com/emdash-cms/emdash) — drag-and-drop sections with custom styles, saved as JSON.

## Installation

```bash
npm install empixel-builder
```

Then register the plugin automatically:

```bash
npx empixel-builder add
```

This command does two things:

1. Adds the import and registers the plugin in your `astro.config.mjs`
2. Creates the `empixel_builder_layouts` table in `data.db` (EmDash's SQLite database)

> **Note:** Run `npx emdash dev` at least once before running `npx empixel-builder add` so that `data.db` exists. If the database is not found, the table will be created automatically on the first server start.

Restart your dev server after running the command.

### Manual registration

If you prefer to register manually, add the following to `astro.config.mjs`:

```js
import { empixelBuilder } from "empixel-builder";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [empixelBuilder()],
    }),
  ],
});
```

### Options

`empixelBuilder()` accepts an optional configuration object:

| Option         | Type     | Default                       | Description                                                                                                              |
| -------------- | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `databasePath` | `string` | `<process.cwd()>/data.db`     | Path to the SQLite file backing the plugin. Both the plugin runtime and the Astro frontend reader share this connection. |

```js
empixelBuilder({ databasePath: "./custom/path/data.db" });
```

## Usage

Once registered, the **Page Editor** appears in the EmDash admin sidebar at `/_emdash/admin`.

Open the editor, build your page layout with drag-and-drop sections, and save. The layout is stored as JSON in the database and rendered on the frontend via EmDash.

## Requirements

- **Node.js >= 20** (required by `better-sqlite3` 12, which ships native bindings built against Node 20)
- `emdash` >= 0.9.0
- `astro` >= 6.0.0
- `react` >= 19.0.0
- `better-sqlite3` >= 12.0.0 (included with EmDash)

---

_This plugin was built with the help of [Claude AI](https://claude.ai)._
