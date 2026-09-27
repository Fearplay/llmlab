<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Contextual help rule

Every new input, select, textarea, checkbox, range control, and file upload must have a visible label and a `HelpLabel` or `InfoTip` with a specific `helpKey`. Add Czech and English descriptions and a concrete example to `lib/help-content.ts`. Show a short example beside important AI lab fields. Use `Field` with a required `helpKey` in concept labs. Give important metrics and teaching panels contextual help as well. `pnpm lint` runs `scripts/check-field-help.mjs` and must pass before shipping.
