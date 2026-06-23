---
title: Serving a directory
description: Run Plandeck against a folder and control discovery with CLI flags.
---

Plandeck serves a single directory tree. Pass it as the first argument, or omit
it to serve the current working directory.

```sh
plandeck ./my-docs
# or, inside the directory:
cd my-docs && plandeck
```

From source the entry point is `bun start <dir>`.

## What gets discovered

Plandeck walks the directory and lists common documentation files:

- **Markdown** (`.md`) and **MDX** (`.mdx`)
- **HTML** (rendered in a sandboxed frame — scripts never run)
- **PDF**, **images** (`.png`, `.jpg`, …), and **plain text**

Discovery respects `.gitignore` and skips hidden files and folders by default.
Symlinks are not followed, and files above a size cap (5 MB by default) are
skipped.

## CLI flags

| Flag | Default | Description |
|---|---|---|
| `--port` / `-p` | `3000` | Port to listen on |
| `--host` | `127.0.0.1` | Host to bind |
| `--title` | dir basename | App title shown in the header |
| `--open` | `false` | Open the browser on start |
| `--include` / `-i` | `**/*` | Glob patterns to include |
| `--exclude` / `-e` | `.git/**` | Glob patterns to exclude |
| `--hidden` | `false` | Include hidden files and directories |
| `--no-gitignore` | `false` | Disable `.gitignore` filtering |

:::note
`--include` / `--exclude` take **comma-separated** glob patterns, not repeated
flags. The last value of a repeated flag wins.
:::

If the chosen port is busy, Plandeck increments it (up to +10) and prints the
actual URL it bound to.

For persistent defaults, commit a [`.plandeck.json`](/plandeck/guide/configuration/) into
the served directory instead of typing flags every time.
