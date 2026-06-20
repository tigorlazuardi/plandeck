---
paths: ["src/client/render/**", "src/client/blocks/**"]
---

# MDX runtime rendering + custom blocks

Slice 2.1 conventions for rendering `.mdx` in the browser.

## Runtime evaluate + provider
- `Mdx.tsx` compiles at runtime: `evaluate(content, { ...runtime, useMDXComponents,
  remarkPlugins: [remarkGfm] })` in a `useEffect`, where
  `runtime = import * as runtime from 'react/jsx-runtime'` and `useMDXComponents` from
  `@mdx-js/react`. The returned component is wrapped in `MDXProvider` with the block
  `components` map (`src/client/blocks/index.ts`).
- **Error handling, two paths, both render the ParseErrorCard, never throw past the
  boundary:** a class `ErrorBoundary` catches render-time throws; the async `.catch()`
  catches compile errors. Keep both.
- `useEffect` async evaluate should guard against stale resolves (a `cancelled` flag in
  cleanup) — otherwise a fast content switch can flicker the previous doc.

## Block component contract
- `Callout` `type?: info|warn|success|danger` (default info), `title?`.
- `CodeTabs` reads child fenced-code metas `tab="..."`; optional `default` meta; fallback
  to lang/index.
- `Decision` `status?: proposed|accepted|rejected` (default proposed), `title`.
- `HtmlBlock` renders its child ```html fence into `<iframe srcDoc=...>` with
  **`sandbox=""` (empty string = zero capabilities)** — NEVER add `allow-scripts` or
  `allow-same-origin`. (Distinct from the `/api/raw` + HtmlView sandbox in
  [[raw-endpoint-and-sandbox]], same principle.)
