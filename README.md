# Plandeck

Local read-only doc viewer. Serve any directory of Markdown, MDX, HTML, PDF, images, and plain text files as a searchable web app with live reload.

📖 **Documentation:** <https://tigorlazuardi.github.io/plandeck/> — guides, configuration, MDX blocks, and an [`llms.txt`](https://tigorlazuardi.github.io/plandeck/llms.txt) for driving Plandeck with an AI agent.

## Install

```sh
bun install
```

### Prebuilt binary

Each release ships self-contained single-file binaries (no runtime needed) for
linux x64/arm64, macOS arm64, and windows x64 — grab one from the
[Releases](https://github.com/tigorlazuardi/plandeck/releases) page, `chmod +x`,
and run it in any directory.

### Nix flake

Runs on bare NixOS — no `nix-ld` required (the flake wraps the release binary
under nixpkgs' glibc loader).

```sh
# Run directly
nix run github:tigorlazuardi/plandeck -- <dir> --port 8080

# Or add to a flake
inputs.plandeck.url = "github:tigorlazuardi/plandeck";
# ... then `inputs.plandeck.packages.${system}.default` in your packages
```

Supported systems: `x86_64-linux`, `aarch64-linux`, `aarch64-darwin`.

## Usage

### Development mode

```sh
bun dev
```

Starts Vite dev server with HMR. Requires a running backend (`bun start <dir>` in another terminal, or set `VITE_API_BASE`).

### Serve a directory

```sh
bun start <dir>
```

Builds and serves `<dir>` on `http://localhost:3000`. Flags:

| Flag | Default | Description |
|---|---|---|
| `--port` / `-p` | `3000` | Port to listen on |
| `--host` | `127.0.0.1` | Host to bind |
| `--title` | dir basename | App title shown in header |
| `--open` | false | Open browser on start |
| `--include` / `-i` | `**/*` | Glob patterns to include (repeatable) |
| `--exclude` / `-e` | `.git/**` | Glob patterns to exclude (repeatable) |
| `--hidden` | false | Include hidden files/dirs |
| `--no-gitignore` | false | Disable `.gitignore` filtering |

## `.plandeck.json`

Place a `.plandeck.json` in the served directory to set defaults:

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

All fields optional. CLI flags override config file values.

## Custom MDX blocks

| Block | Props | Description |
|---|---|---|
| `<Callout>` | `type` (info/warn/success/danger), `title` | Highlighted callout box |
| `<CodeTabs>` | children: `<pre>` blocks with `data-tab` | Tabbed code snippets |
| `<Decision>` | `title`, `status` (proposed/accepted/rejected) | Architecture decision record |
| `<HtmlBlock>` | `height` | Sandboxed HTML preview (no scripts) |

Mermaid diagrams render in fenced code blocks with `language-mermaid`.

## Testing

```sh
# Unit + component tests
bun test

# Lint + type check
bun run check

# E2E (requires podman)
bun run e2e
```

E2E runs a live backend against `tests/e2e/fixtures/` inside the official Playwright container via podman. No host browser required.
