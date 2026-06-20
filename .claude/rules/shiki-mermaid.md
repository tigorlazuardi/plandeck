---
paths: ["src/client/render/**", "tests/client/**"]
---

# Shiki highlight + Mermaid (slice 2.3)

## APIs
- `@shikijs/rehype` v4: default export is the lazy `rehypeShiki`. Use
  `@shikijs/rehype/core` → `rehypeShikiFromHighlighter(highlighter, opts)` with a pre-built
  singleton highlighter. Options `{ theme: 'github-light' | 'github-dark' }`. Set
  `onError: () => {}` to silence unknown-lang errors (e.g. `mermaid`).
- `mermaid` v11: `initialize({ startOnLoad: false, theme: 'default' | 'dark' })` +
  `render(id, text) → Promise<{ svg }>`. Import lazily via `import('mermaid')` inside
  `useEffect`. Set via `containerRef.current.innerHTML = svg`.

## Pipeline wiring
- Intercept `language-mermaid` fences in a custom `pre` component (BOTH `Markdown.tsx` and
  `Mdx.tsx`): check `children.props.className.includes('language-mermaid')` → render
  `<Mermaid>`; do NOT register mermaid as a shiki language.
- A custom `pre` MUST spread `...rest` (`<pre {...rest}>{children}</pre>`) — Shiki adds
  `class="shiki <theme>"` to the hast `pre`; dropping rest silently loses highlighting.
- Theme follows Mantine color-scheme; re-render mermaid on scheme change.
- `mermaid.render()` SVG via `innerHTML` is safe without DOMPurify in this local-only,
  read-only, no-network viewer (no script execution via innerHTML in that context, nothing
  to exfiltrate). See [[search-xss-invariant]] for the dynamic-HTML gate that IS load-bearing.

## Test gotchas (bun:test + happy-dom)
- Any component calling a Mantine hook (e.g. `useMantineColorScheme`) needs a
  `MantineProvider` wrapper in the test render, else "MantineProvider was not found".
- `tests/client/HtmlView.test.tsx` uses `mock.module('@mantine/core')` with a PARTIAL stub
  that pollutes the module cache for later tests in the same worker. Adding a component that
  imports a new Mantine export means adding that export to the stub or downstream tests fail
  ("Export named X not found"). See [[client-conventions]].
- Shiki DOM-output tests: pre-warm the highlighter singleton in `beforeAll` (call
  `getHighlighter()`), else the async effect exceeds bun's 5000ms per-test timeout.
