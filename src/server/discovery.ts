import * as fs from "node:fs";
import * as path from "node:path";
import ignore, { type Ignore } from "ignore";
import type { ResolvedConfig, TreeNode } from "../shared/types.ts";
import { kindFor } from "./kind.ts";

// NOTE: Files over config.maxFileBytes are still listed (not dropped).
// They will be flagged later at render/index time. See spec §5.

/**
 * Recursively discover all files/dirs in config.root.
 * Returns top-level TreeNode[] sorted: dirs first (alpha CI), then files (alpha CI).
 *
 * Rules:
 * - Skip symlinks (lstat.isSymbolicLink())
 * - Skip hidden (dot-prefixed) files AND dirs by default
 * - Accumulate .gitignore matchers down the tree (nested gitignore semantics)
 * - Include/exclude via Bun.Glob; explicit include can re-include hidden/gitignored
 * - Files whose kindFor() returns null are dropped
 * - Dirs omitted if they have no discovered descendants
 */
export function discover(config: ResolvedConfig): TreeNode[] {
  // Start with an empty parent ignore; walkDir loads root's .gitignore on first call
  return walkDir(config.root, config.root, ignore(), config);
}

/**
 * Walk a directory and return sorted TreeNode[].
 * Loads dirPath's own .gitignore (if present) and inherits parentIgnore from ancestors.
 * This unified function is used for both root and all subdirectories.
 */
function walkDir(
  dirPath: string,
  root: string,
  parentIgnore: Ignore,
  config: ResolvedConfig,
): TreeNode[] {
  // Load this dir's .gitignore (if any) — creates a scoped ignore for this subtree.
  // This handles root on first call and every subdir on recursive calls uniformly.
  const localIgnore = ignore();
  localIgnore.add(parentIgnore); // inherit parent rules
  const localGitignorePath = path.join(dirPath, ".gitignore");
  if (fs.existsSync(localGitignorePath)) {
    localIgnore.add(fs.readFileSync(localGitignorePath, "utf-8"));
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const entry of entries) {
    const absPath = path.join(dirPath, entry.name);
    const relPath = toRelPath(root, absPath);

    // Skip symlinks (security: no root escape, no loops)
    const stat = fs.lstatSync(absPath);
    if (stat.isSymbolicLink()) continue;

    const isHidden = entry.name.startsWith(".");

    // Check if explicit include matches (allows override of hidden/gitignore)
    const explicitlyIncluded = isExplicitlyIncluded(relPath, config.include);

    if (entry.isDirectory()) {
      // A dir can be re-entered if any include pattern names a descendant (dir/**)
      const includeReachesInside = includeCouldReachDir(relPath, config.include);

      // Skip hidden dirs unless explicitly included (by file path) OR include reaches inside
      if (isHidden && !explicitlyIncluded && !includeReachesInside) continue;

      // Check gitignore (skip if ignored, unless explicitly included or include reaches inside)
      if (!explicitlyIncluded && !includeReachesInside && isGitignored(localIgnore, `${relPath}/`))
        continue;

      // Check exclude (dir exclude prunes subtree)
      if (isExcluded(relPath, config.exclude)) continue;

      // Recurse — pass localIgnore (which includes this dir's .gitignore)
      const children = walkDir(absPath, root, localIgnore, config);

      // Only include dir if it has discovered descendants
      if (children.length > 0) {
        dirs.push({
          name: entry.name,
          path: relPath,
          type: "dir",
          children,
        });
      }
    } else if (entry.isFile()) {
      // Skip hidden files unless explicitly included
      if (isHidden && !explicitlyIncluded) continue;

      // Check gitignore (skip if ignored, unless explicitly included)
      if (!explicitlyIncluded && isGitignored(localIgnore, relPath)) continue;

      // Check exclude
      if (isExcluded(relPath, config.exclude)) continue;

      // Check include filter (if set, file must match)
      if (config.include.length > 0 && !isIncluded(relPath, config.include)) continue;

      // Classify by kind; null = not discoverable
      const kind = kindFor(entry.name, config);
      if (kind === null) continue;

      files.push({
        name: entry.name,
        path: relPath,
        type: "file",
        kind,
      });
    }
  }

  // Sort: dirs alpha CI, then files alpha CI
  dirs.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  files.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return [...dirs, ...files];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Relpath from root, always using forward slashes. */
function toRelPath(root: string, absPath: string): string {
  return path.relative(root, absPath).replace(/\\/g, "/");
}

/** Check if a relpath is gitignored by the accumulated ignore matcher. */
function isGitignored(ig: Ignore, relPath: string): boolean {
  try {
    return ig.ignores(relPath);
  } catch {
    return false;
  }
}

/**
 * Check if an explicit include glob matches the relpath (for files).
 * Used to override hidden/gitignore suppression.
 */
function isExplicitlyIncluded(relPath: string, include: string[]): boolean {
  if (include.length === 0) return false;
  return include.some((pattern) => {
    try {
      return new Bun.Glob(pattern).match(relPath);
    } catch {
      return false;
    }
  });
}

/**
 * Check if any include pattern could match a descendant of the given directory.
 * Used so hidden/gitignored DIRECTORIES are not pruned when an include glob
 * like "dir/**" explicitly names a path inside them.
 *
 * Strategy: a pattern can reach inside dirRelPath if:
 *   1. The pattern starts with dirRelPath + "/" (literal prefix), OR
 *   2. The pattern with trailing /** stripped Glob-matches dirRelPath itself
 *      (covers patterns like "dir/**" where stripping /** gives "dir").
 */
function includeCouldReachDir(dirRelPath: string, include: string[]): boolean {
  if (include.length === 0) return false;
  const prefix = `${dirRelPath}/`;
  return include.some((pattern) => {
    // Direct prefix: pattern is "dir/..." → we'd reach inside
    if (pattern.startsWith(prefix)) return true;
    // Strip trailing /** and check if dir matches the base
    const stripped = pattern.replace(/\/\*\*$/, "");
    if (stripped !== pattern) {
      // pattern had a trailing /**
      try {
        if (new Bun.Glob(stripped).match(dirRelPath)) return true;
      } catch {
        // ignore
      }
    }
    return false;
  });
}

/** Check if relpath matches any include glob (non-override check). */
function isIncluded(relPath: string, include: string[]): boolean {
  return include.some((pattern) => {
    try {
      return new Bun.Glob(pattern).match(relPath);
    } catch {
      return false;
    }
  });
}

/** Check if relpath matches any exclude glob. */
function isExcluded(relPath: string, exclude: string[]): boolean {
  return exclude.some((pattern) => {
    try {
      return new Bun.Glob(pattern).match(relPath);
    } catch {
      return false;
    }
  });
}
