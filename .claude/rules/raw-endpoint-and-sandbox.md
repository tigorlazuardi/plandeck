---
paths:
  - "src/server/raw.ts"
  - "src/client/render/HtmlView.tsx"
  - "src/client/render/PdfView.tsx"
  - "src/client/render/ImageView.tsx"
  - "tests/server/raw.test.ts"
  - "tests/client/HtmlView.test.tsx"
---

# Raw byte endpoint path-confinement + HTML sandbox (slice 2.4)

Security-critical conventions for serving raw bytes and rendering untrusted HTML.
Any slice touching `/api/raw`, asset serving, or an HTML viewer MUST hold this bar.

## Path confinement (`confinedResolve` in `src/server/raw.ts`)

Order matters. Every guard below is required — do NOT drop or weaken any:

1. **Decode once** via `decodeURIComponent` BEFORE the `..` check, so percent-encoded
   traversal (`%2e%2e%2f`) can't bypass. **Single decode only** — a decode *loop* would
   re-open double-encoded traversal (`%252e`). Keep the comment warning against a loop.
2. Reject if `path.isAbsolute(decoded)`.
3. Reject if any path segment === `".."`.
4. Lexical confinement: `path.resolve(root, decoded)` then require
   `resolved === root || resolved.startsWith(root + path.sep)`. Use `root + path.sep`,
   NEVER bare `startsWith(root)` — bare lets a sibling `/<root>-evil` pass.
5. Leaf symlink reject: `lstatSync(resolved)` (NOT `statSync` — stat follows links) →
   reject if `isSymbolicLink()`; require `isFile()` (dir → 404).
6. **Realpath re-confinement (closes the intermediate dir-symlink hole):**
   leaf `lstat` alone is INSUFFICIENT — an intermediate DIRECTORY that is itself a
   symlink to outside root lets `link/secret.txt` resolve lexically inside root while
   the OS follows `link` during resolution, so the leaf looks like a regular in-root file.
   Proven exploit: `GET /api/raw/link/secret.txt` → 200 with out-of-root bytes.
   Fix: `realpathSync` the ROOT once and the resolved TARGET, then require
   `realTarget === realRoot || realTarget.startsWith(realRoot + path.sep)`.
   `realpathSync` throws ENOENT for missing paths → catch → return 404 (not 500).

Error type is `403 | 404` only — no `400`, no `as` casts. Malformed encoding → 403.

**Regression test is mandatory:** create a temp dir OUTSIDE root with a secret, make a
**directory** symlink inside root pointing at it (`fs.symlinkSync(outsideDir, link, 'dir')`),
assert `link/secret.txt` is rejected. On symlink-create failure `console.warn` + return —
never a silent green pass.

Matches the discovery walker philosophy in `server-config-and-discovery.md`
("symlinks not followed, lstat not stat") — extend it to raw serving.

Residual (noted, not gated for a read-only local server): TOCTOU between `realpathSync`
and `Bun.file(resolved)` open. Real hardening is open-fd-then-fstat; out of scope here.

## HTML viewer sandbox (`src/client/render/HtmlView.tsx`)

- Render untrusted doc HTML via `<iframe srcDoc={html}>` (React camelCase `srcDoc`;
  DOM attr is `srcdoc`). NEVER `src` pointing at the app origin.
- Default `sandbox` MUST contain neither `allow-scripts` NOR `allow-same-origin`. Inert
  set: `"allow-forms allow-popups"` (`SANDBOX_INERT`) — JS can't run, can't reach app
  origin/cookies/storage.
- Tests assert the ABSENCE of both dangerous tokens in the default, not mere presence.

### Per-file "Enable scripts" opt-in (`SANDBOX_SCRIPTS`)
A per-file toggle (default OFF, re-armed to OFF on every doc change via `useEffect([html])`)
can switch the sandbox to `"allow-forms allow-popups allow-scripts"` — **adds `allow-scripts`
ONLY, NEVER `allow-same-origin`.** Safe because the frame stays cross/null-origin: scripts
run but cannot read the app's cookies/storage/DOM and cannot strip their own sandbox (that
needs `allow-scripts` AND `allow-same-origin` together). Scripts CAN run arbitrary JS + hit
the network, so the toggle carries an explicit warning (red, `TriangleAlert`). Changing the
sandbox needs an iframe re-mount → key the iframe on the sandbox value. A test asserts that
enabling the toggle adds `allow-scripts` but the sandbox still never contains
`allow-same-origin`. The two allowed values are the `SANDBOX_INERT` / `SANDBOX_SCRIPTS`
constants — do NOT inline other combinations.

### Print-to-PDF exception (`printHtmlDoc` in `export.ts`)
The inline preview iframe is unreachable for printing (no `allow-same-origin`). To
"Print / Save as PDF" an `.html` doc, `printHtmlDoc` builds a **transient, off-screen**
iframe with `sandbox="allow-same-origin allow-modals"`, then calls
`iframe.contentWindow.print()`. Safe ONLY because it STILL omits `allow-scripts` — the
document's own JS stays inert; `allow-same-origin` merely lets the parent reach in to call
`print()`. **NEVER add `allow-scripts` to this iframe.** A test asserts the print iframe's
sandbox contains `allow-same-origin` but never `allow-scripts`.

## Non-text viewers

- `PdfView` / `ImageView` build `src={`/api/raw/${path}`}` — confinement enforced
  server-side; client passes the relpath straight through.
- `ImageView` `onError` → §10 load-fail placeholder card ("couldn't display this file"
  + raw link). DocView dispatch for html/pdf/image is ADDITIVE — never touch md/mdx/txt.
