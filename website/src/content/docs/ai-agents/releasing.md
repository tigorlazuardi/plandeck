---
title: Releasing & Nix
description: How Plandeck binary releases and the Nix flake are built — the maintainer/agent procedure.
---

Distribution is **binary-only** (npm was deliberately dropped — `Bun.serve` and
`bun:sqlite` are Bun-only and won't run under Node `npx`). A release is a set of
cross-OS, self-contained single-file binaries attached to a GitHub Release.

## Cutting a release

A git tag matching `v*` is the **only** trigger:

```sh
git tag vX.Y.Z          # on main, after the release commit is merged
git push origin vX.Y.Z
```

`.github/workflows/release.yml` then runs on one `ubuntu-latest` runner:

1. `bun install`
2. `bun run build:binary` — vite build → `gen:embedded` → cross-compile 4 targets
3. `sha256sum * > SHA256SUMS.txt`
4. `softprops/action-gh-release@v2` creates the Release and uploads `dist-bin/*`

Bump `version` in `package.json` to match the tag first. `bun build --compile`
cross-targets every OS/arch from a single host, so there is **no build matrix**.

## The load-bearing detail: the SPA is embedded

`bun build --compile` only bakes files imported with `with { type: "file" }`.
The server's `serveStatic({ root: "./dist" })` is cwd-relative, so a binary
launched from a user's folder would have no `./dist` and serve a blank page.

`scripts/gen-embedded.ts` generates `src/server/embedded-assets.ts` with a static
file import per built asset; `app.ts` serves from that map when `HAS_EMBEDDED`.
The committed version of `embedded-assets.ts` is an **empty stub** so dev and
type-checking work; the binary build regenerates it, compiles, then restores the
stub. Never strip or patch the resulting binary — the SPA payload is appended
after the ELF and rewriting it corrupts the offset.

## Nix flake

`flake.nix` wraps the prebuilt release binaries (no build from source). Because
patching a Bun binary corrupts its payload, the flake keeps the binary
byte-for-byte unmodified (`dontStrip`, `dontPatchELF`) and wraps it under
nixpkgs' glibc loader — so it runs on bare NixOS with **no `nix-ld`**.

The flake pins each binary by version + sha256, so **after every release** you
must bump it:

1. Set `version` in `flake.nix` to the new tag (without the `v`).
2. Replace the three `sha256` values with the hex hashes from the release's
   `SHA256SUMS.txt` (`sha256sum` hex equals the nix `fetchurl` hash — no
   conversion needed):

```sh
gh release download vX.Y.Z --repo tigorlazuardi/plandeck \
  --pattern SHA256SUMS.txt --output -
```

Map `plandeck-linux-x64` → `x86_64-linux`, `plandeck-linux-arm64` →
`aarch64-linux`, `plandeck-darwin-arm64` → `aarch64-darwin`. Then `nix build
.#plandeck` to confirm, commit, and push.

:::note
This page mirrors the repo's `releasing-plandeck` agent skill
(`.claude/skills/releasing-plandeck/`), which is the source of truth a coding
agent loads when asked to release or deploy.
:::
