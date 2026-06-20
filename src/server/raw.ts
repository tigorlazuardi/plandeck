import * as fs from "node:fs";
import * as path from "node:path";
import type { Context } from "hono";
import { resolveConfig } from "./config.ts";

// Extension → MIME type map for raw file serving
const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function mimeFor(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
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
  // Step 1: decode percent-encoding
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawRelpath);
  } catch {
    return { error: 400 as 403 };
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
  const mime = mimeFor(resolved);

  // Stream bytes
  const file = Bun.file(resolved);
  return new Response(file, {
    headers: { "content-type": mime },
  });
}
