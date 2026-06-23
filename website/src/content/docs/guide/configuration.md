---
title: Configuration
description: Set persistent defaults with .plandeck.json and understand the config layering order.
---

Plandeck reads configuration from three layers. Persistent defaults live in a
`.plandeck.json` file committed alongside your docs.

## `.plandeck.json`

Place it in the directory you serve:

```json
{
  "title": "My Docs",
  "port": 4000,
  "include": ["docs/**", "plans/**"],
  "exclude": ["**/node_modules/**", "**/.git/**"],
  "textFiles": [".env.example", ".toml"],
  "nonTextFiles": [".wasm"],
  "maxFileBytes": 5242880
}
```

All fields are optional.

| Field | Description |
|---|---|
| `title` | App title in the header |
| `port` | Default port |
| `host` | Default bind host |
| `include` / `exclude` | Glob patterns for discovery |
| `textFiles` | Extra extensions treated as searchable text |
| `nonTextFiles` | Extensions shown but **not** indexed for search |
| `maxFileBytes` | Per-file size cap (bytes) |

## Layering order

Later layers override earlier ones:

```
built-in defaults  <  PLANDECK_* env vars  <  .plandeck.json  <  CLI flags
```

So a `--port` flag beats a `port` in `.plandeck.json`, which beats
`PLANDECK_PORT`, which beats the built-in default.

### Environment variables

`PLANDECK_ROOT`, `PLANDECK_PORT`, `PLANDECK_HOST`, `PLANDECK_TITLE`, and
`PLANDECK_OPEN` map to their respective settings — handy in containers or
service definitions.

## Text vs non-text files

Text files are rendered **and** indexed for full-text search. Non-text files
(PDF, images, binaries) are rendered/displayed but not indexed. Use `textFiles`
and `nonTextFiles` to adjust which extensions fall into each bucket.
