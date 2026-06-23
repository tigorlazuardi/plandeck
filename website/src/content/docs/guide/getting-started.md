---
title: Getting Started
description: Install a Plandeck binary and serve a directory of docs in under a minute.
---

Plandeck turns any directory of documents into a searchable, live-reloading
website. It is **read-only** — you point it at a folder, it renders what is
there. Nothing is uploaded; everything stays on your machine.

## 1. Get a binary

Download the binary for your platform from the
[Releases page](https://github.com/tigorlazuardi/plandeck/releases), then make
it executable:

```sh
chmod +x plandeck-linux-x64
```

Prefer Nix? `nix run github:tigorlazuardi/plandeck -- <dir>`. See
[Installation](/plandeck/guide/installation/) for every method.

## 2. Serve a directory

```sh
./plandeck-linux-x64 ./my-docs
```

With no directory argument, Plandeck serves the current working directory:

```sh
cd my-docs && ./plandeck-linux-x64
```

It prints a clickable URL (default `http://127.0.0.1:3000`) and opens a sidebar
listing every discovered document.

## 3. Browse

- **Sidebar** — every Markdown, MDX, HTML, PDF, image, and text file, filtered
  by `.gitignore` and your config.
- **Search** — full-text search across Markdown/MDX/text content.
- **Live reload** — edit a file on disk and the open page updates itself.

## Next steps

- [Serve a directory](/plandeck/guide/serving/) — all CLI flags.
- [Configuration](/plandeck/guide/configuration/) — defaults via `.plandeck.json`.
- [MDX blocks](/plandeck/guide/mdx-blocks/) — rich components for plan documents.

:::tip[Driving Plandeck with an AI agent?]
Point your model at [`/plandeck/llms.txt`](/plandeck/llms.txt). It links scoped
documentation sets so the agent loads only the slice it needs instead of the
whole site. See [Using with AI Agents](/plandeck/ai-agents/overview/).
:::
