---
name: releasing-plandeck
description: How to cut a release or deploy plandeck. Use whenever publishing a new version, building distributable binaries, tagging a release, or debugging the GitHub Actions release workflow. Releases are binary-only (no npm); a git tag `v*` is the sole trigger, and the SPA must be embedded into the bun binary or it serves a blank page.
---

# Releasing plandeck

Distribution is **binary-only** (npm was explicitly dropped — `Bun.serve` +
`bun:sqlite` are bun-only, won't run under node `npx`). A release = cross-OS
self-contained single-file binaries attached to a GitHub Release.

## Cut a release (the whole procedure)

```bash
git tag vX.Y.Z          # on main, after the release commit is merged
git push origin vX.Y.Z
```

That's it. The tag push is the **only** trigger. `.github/workflows/release.yml`
(`on: push: tags: ["v*"]`) then, on one `ubuntu-latest` runner:

1. `bun install`
2. `bun run build:binary` — vite build → `gen:embedded` → cross-compile 4 targets
3. `sha256sum * > SHA256SUMS.txt`
4. `softprops/action-gh-release@v2` creates the Release and uploads all of `dist-bin/*`

Bump `version` in `package.json` to match the tag before tagging. Watch it with
`gh run watch <id> --exit-status`; verify assets with
`gh release view vX.Y.Z --json assets`.

### After every release: bump the Nix flake

`flake.nix` wraps the **prebuilt release binaries** (pinned by version + sha256),
so a new release does NOT update the flake automatically. After the release
publishes, edit `flake.nix`:

1. Set `version` to the new tag (without the `v`).
2. Replace the three `sha256` values. They are the hex hashes in the release's
   `SHA256SUMS.txt` — `sha256sum` hex == nix `fetchurl` hash, no conversion:

```sh
gh release download vX.Y.Z --repo tigorlazuardi/plandeck --pattern SHA256SUMS.txt --output -
```

Map `plandeck-linux-x64` → `x86_64-linux`, `plandeck-linux-arm64` →
`aarch64-linux`, `plandeck-darwin-arm64` → `aarch64-darwin`. Then
`nix build .#plandeck` to confirm, commit, push.

## Targets (cross-compiled from ONE host)

`bun build --compile --target=<t>` cross-targets every OS/arch from a single
runner — **no OS matrix needed**. `scripts/compile.ts` builds:

| target | output |
| --- | --- |
| `bun-linux-x64` | `plandeck-linux-x64` |
| `bun-linux-arm64` | `plandeck-linux-arm64` |
| `bun-darwin-arm64` | `plandeck-darwin-arm64` |
| `bun-windows-x64` | `plandeck-windows-x64.exe` |

First compile of a new target downloads that target's bun runtime (slow once).

## The load-bearing gotcha: the SPA must be EMBEDDED

`bun build --compile` only bakes files imported with `with { type: "file" }`.
The server originally served the SPA via `serveStatic({ root: "./dist" })` —
**cwd-relative**, so a binary launched from a user's plan directory has no
`./dist` and serves a blank `<div id="root"></div>`.

Mechanism that fixes it (do not break this chain):

- `scripts/gen-embedded.ts` globs `dist/**`, emits `src/server/embedded-assets.ts`
  with one static `with { type: "file" }` import per (content-hashed) file plus an
  `EMBEDDED` url-path → file-path map and `HAS_EMBEDDED = true`.
- `src/server/embedded-assets.ts` is **committed as an empty stub**
  (`HAS_EMBEDDED = false`, `EMBEDDED = {}`) so dev + `bun run check` typecheck
  without a build. `build:binary` regenerates it, compiles, then
  `git checkout -- src/server/embedded-assets.ts` **restores the stub** — keep
  the worktree clean.
- `src/server/app.ts` branches on `HAS_EMBEDDED`: embedded → serve from the map
  with `mimeFor(ext)`; else → on-disk `serveStatic("./dist")` for dev/`bun run start`.

Rules when touching this:
- The committed `embedded-assets.ts` must stay the empty stub. If `git status`
  shows it dirty after a binary build, the restore step failed — reset it.
- `dist-bin/` is gitignored; never commit binaries.
- New static asset extensions must be added to `mimeFor()` in `app.ts` or they
  ship as `application/octet-stream`.

## Nix gotcha: never patchelf/strip a bun binary

The same appended-payload mechanism breaks Nix packaging. `autoPatchelfHook`
(and `strip`) rewrite the ELF, shift the trailer, and the binary silently falls
back to the plain bun runtime (prints bun's help instead of running plandeck).
`flake.nix` therefore keeps the binary **byte-for-byte unmodified**
(`dontStrip`, `dontPatchELF`) and wraps it under the glibc loader via
`makeWrapper` + `stdenv.cc.bintools.dynamicLinker --library-path …`. This runs on
bare NixOS with no `nix-ld`. If a future change makes `nix run` print bun help,
something started modifying the binary again.

## Verifying a binary actually works

Run it from a **foreign cwd** (not the repo) — that's the case the embedding
fixes. `/` must return the real `index.html` (has a `<script>` tag), not the
blank placeholder:

```bash
cd /tmp && PLANDECK_PORT=9911 /path/to/dist-bin/plandeck-linux-x64 &
curl -s localhost:9911/ | grep -q '<script' && echo OK
```

## CI vs Release

- `ci.yml` (push/PR to main): 3-OS matrix runs check + tests + build. Does NOT
  build binaries or run e2e (e2e is local/podman only).
- `release.yml` (tag `v*`): builds + publishes binaries. Does not run tests —
  rely on CI having passed on main before tagging.
- Both pin `actions/checkout@v5` + `oven-sh/setup-bun@v2`. `bun-version: latest`.

## Related

- Embedded-serving + config-DI internals: `.claude/rules/server-config-di.md`,
  `server-runtime.md`.
- Windows CI needs LF line endings — `.gitattributes` forces `* text=auto eol=lf`
  (Biome's formatter rejects CRLF).
