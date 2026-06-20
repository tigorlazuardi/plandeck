import * as fs from "node:fs";
import * as path from "node:path";
import type { Context } from "hono";
import { resolveConfig } from "./config.ts";

// Safe inline allowlist: ONLY these extensions are served inline with their type.
// All other extensions (including .html, .htm, .svg, .xml, .txt, etc.) are forced
// to download as application/octet-stream to prevent same-origin XSS.
const INLINE_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * Returns { mime, inline } for the given file path.
 * inline=true → serve with the given mime type (safe raster/PDF).
 * inline=false → force download as application/octet-stream.
 */
function mimeFor(filePath: string): { mime: string; inline: boolean } {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  const mime = INLINE_MIME_MAP[ext];
  if (mime) {
    return { mime, inline: true };
  }
  return { mime: "application/octet-stream", inline: false };
}

/**
 * Check path confinement. Returns the resolved absolute path if safe, null otherwise.
 *
 * Security invariants:
 * 1. Decode percent-encoding before ANY check.
 * 2. Reject decoded relpath that is absolute or contains ".." segments.
 * 3. Resolve to absolute and verify it starts with root (+ sep).
 * 4. Use lstatSync (never follows symlinks) — reject symlinks.
 * 5. Reject anything that is not a regular file (dirs → 404).
 */
export function confinedResolve(
  root: string,
  rawRelpath: string,
): { resolved: string } | { error: 403 | 404 } {
  // Step 1: decode percent-encoding.
  // Single decodeURIComponent is intentional — a decode loop would re-open
  // double-encoded traversal attacks (e.g. %252e%252e → %2e%2e → ..).
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawRelpath);
  } catch {
    return { error: 403 };
  }

  // Step 2: reject absolute paths (starts with /)
  if (path.isAbsolute(decoded)) {
    return { error: 403 };
  }

  // Step 3: reject any ".." segments (after decode)
  const parts = decoded.split(/[/\\]/);
  if (parts.some((p) => p === "..")) {
    return { error: 403 };
  }

  // Step 4: resolve to absolute path
  const resolved = path.resolve(root, decoded);

  // Step 5: must be strictly inside root
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return { error: 403 };
  }

  // Step 6: lstat (do NOT follow symlinks) — reject if doesn't exist or is symlink
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    return { error: 404 };
  }

  if (stat.isSymbolicLink()) {
    return { error: 403 };
  }

  if (!stat.isFile()) {
    return { error: 404 };
  }

  // Step 7: realpath re-confinement — closes the intermediate dir-symlink bypass.
  // lstatSync on the LEAF is not enough: if any INTERMEDIATE directory segment is
  // itself a symlink to an outside dir, the OS follows it during path resolution
  // and the leaf lstat sees a regular file. realpathSync resolves all symlinks in
  // every segment, so we can compare real absolute paths and reject anything that
  // escapes root even through an intermediate dir symlink.
  let realRoot: string;
  let realTarget: string;
  try {
    realRoot = fs.realpathSync(root);
    realTarget = fs.realpathSync(resolved);
  } catch {
    // realpathSync throws ENOENT when the path doesn't exist (e.g. raced deletion).
    return { error: 404 };
  }

  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
    return { error: 403 };
  }

  return { resolved };
}

export async function rawHandler(c: Context): Promise<Response> {
  const config = resolveConfig();
  const root = config.root;

  // Hono wildcard param comes as the splat after /api/raw/
  const rawRelpath = c.req.param("relpath") ?? "";

  const result = confinedResolve(root, rawRelpath);

  if ("error" in result) {
    if (result.error === 403) {
      return c.json({ error: "Forbidden" }, 403);
    }
    return c.json({ error: "Not found" }, 404);
  }

  const { resolved } = result;
  const { mime, inline } = mimeFor(resolved);

  // Security headers required on every raw response:
  // - nosniff: prevents browsers from MIME-sniffing away from the declared type.
  // - CSP sandbox: locks down any browser rendering context (belt + suspenders).
  const headers: Record<string, string> = {
    "content-type": mime,
    "x-content-type-options": "nosniff",
    "content-security-policy": "sandbox; default-src 'none'",
  };

  if (!inline) {
    // Force download for any type not in the safe inline allowlist.
    // basename is already validated as an in-root path, so it is safe to use.
    const basename = resolved.slice(resolved.lastIndexOf("/") + 1);
    headers["content-disposition"] = `attachment; filename="${basename}"`;
  }

  // Stream bytes
  const file = Bun.file(resolved);
  return new Response(file, { headers });
}
