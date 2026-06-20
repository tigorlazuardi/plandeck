---
paths: ["src/server/search-index.ts", "src/server/prose.ts", "src/client/shell/SearchBox.tsx"]
---

# Search snippet XSS — load-bearing invariant

`SearchBox` renders FTS5 snippets via `dangerouslySetInnerHTML`. FTS5 `snippet()` does NOT
escape HTML. Two defense layers; the render-time escape is the REAL gate.

## Render-time gate (load-bearing — do not relax)
`sanitizeSnippet` (search-index.ts) MUST: HTML-escape `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`
**first**, then restore ONLY the exact `<mark>` / `</mark>` delimiters FTS5 inserts. The only
live tags the snippet may ever contain are **attribute-free `<mark>`/`</mark>`**.
- Never restore attributes or any other tag. Any change letting attributes/other tags
  through = XSS. (Opus-reviewed; bypass attempts — `<img onerror>`, `</mark><script>`,
  `&lt;script&gt;`, literal `<mark onload=>` — all stay escaped.)
- FTS5 delimiter is a literal `<mark>`, so an attacker doc literally containing `<mark>`
  yields an extra attribute-free `<mark>` — cosmetic only, not exploitable.

## Index-time defense-in-depth
`prose.ts` `toProse` strips mdast node types `html`, `mdxJsxFlowElement`,
`mdxJsxTextElement` (markdown raw-HTML AND MDX JSX whose text children would otherwise
survive `mdast-util-to-string`). NOTE: `.txt` is indexed as raw passthrough (no strip) —
safe ONLY because the render-time gate above holds. Keep both layers.
