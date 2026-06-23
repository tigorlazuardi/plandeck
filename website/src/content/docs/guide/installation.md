---
title: Installation
description: Every way to install Plandeck — prebuilt binary, Nix flake, or from source with Bun.
---

Plandeck ships as a **single self-contained binary** with the web UI baked in.
There is no runtime to install and no `node_modules` to ship.

## Prebuilt binary (recommended)

Every release publishes binaries for:

| Platform | Asset |
|---|---|
| Linux x64 | `plandeck-linux-x64` |
| Linux arm64 | `plandeck-linux-arm64` |
| macOS arm64 | `plandeck-darwin-arm64` |
| Windows x64 | `plandeck-windows-x64.exe` |

Download one from the
[Releases page](https://github.com/tigorlazuardi/plandeck/releases), verify it
against `SHA256SUMS.txt`, and mark it executable:

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
chmod +x plandeck-linux-x64
./plandeck-linux-x64 --help
```

## Nix flake

Plandeck runs on bare NixOS with **no `nix-ld`** required — the flake wraps the
release binary under nixpkgs' glibc loader.

```sh
# Run directly
nix run github:tigorlazuardi/plandeck -- <dir> --port 8080
```

Add it to your own flake:

```nix
{
  inputs.plandeck.url = "github:tigorlazuardi/plandeck";
  # ... then reference inputs.plandeck.packages.${system}.default
}
```

Supported systems: `x86_64-linux`, `aarch64-linux`, `aarch64-darwin`.

## From source (Bun)

Requires [Bun](https://bun.sh). Clone the repo and install dependencies:

```sh
git clone https://github.com/tigorlazuardi/plandeck
cd plandeck
bun install
```

Run against a directory:

```sh
bun start <dir>
```

Build the binaries yourself (cross-compiles all four targets from one host):

```sh
bun run build:binary
# outputs to dist-bin/
```
