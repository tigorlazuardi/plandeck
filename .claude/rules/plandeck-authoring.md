---
paths:
  - "docs/**/*.md"
  - "docs/**/*.mdx"
  - "plans/**/*.md"
  - "plans/**/*.mdx"
---

# Authoring docs browsed through Plandeck

These files are browsed through Plandeck (a read-only viewer). Follow the
`plandeck-authoring` skill when writing them:

- Prefer **`.md`** for prose; use **`.mdx`** only for the custom blocks.
- Custom blocks: `<Callout>` (`type` info/warn/success/danger, `title`),
  `<CodeTabs>` (child fences with `tab="..."`), `<Decision>` (`title`, `status`
  proposed/accepted/rejected), `<HtmlBlock>` (sandboxed, scripts disabled).
- Use ` ```mermaid ` fences for diagrams (work in `.md` and `.mdx`).
- Keep files out of `.gitignore`d / hidden paths so they stay discoverable;
  split docs over the 5 MB cap.
- HTML/SVG are inert downloads — use `<HtmlBlock>` for sandboxed previews.

> Adjust the `paths:` globs above to wherever this repo keeps its
> Plandeck-served docs.
