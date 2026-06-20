import * as fs from "node:fs";
import * as path from "node:path";
import chokidar from "chokidar";
import ignore, { type Ignore } from "ignore";
import type { FsEvent, ResolvedConfig } from "../shared/types.ts";
import { kindFor } from "./kind.ts";

export interface Watcher {
  subscribe(cb: (event: FsEvent) => void): () => void;
  close(): Promise<void>;
}

function loadGitignore(root: string): Ignore {
  const ig = ignore();
  const gitignorePath = path.join(root, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf-8"));
  }
  return ig;
}

function shouldIgnore(absPath: string, config: ResolvedConfig, ig: Ignore): boolean {
  const relPath = path.relative(config.root, absPath).replace(/\\/g, "/");

  // Check if any path segment is dot-prefixed (hidden)
  const segments = relPath.split("/");
  for (const seg of segments) {
    if (seg.startsWith(".")) return true;
  }

  // Check if any segment is node_modules (common exclusion like .git)
  for (const seg of segments) {
    if (seg === "node_modules") return true;
  }

  // Check gitignore
  try {
    if (ig.ignores(relPath)) return true;
  } catch {
    // ignore errors from invalid paths
  }

  // Check config.exclude globs
  for (const pattern of config.exclude) {
    try {
      if (new Bun.Glob(pattern).match(relPath)) return true;
    } catch {
      // ignore invalid globs
    }
  }

  return false;
}

export function createWatcher(config: ResolvedConfig): Watcher {
  // Load gitignore once at creation time (no FS reads inside ignored fn)
  const ig = loadGitignore(config.root);

  const listeners = new Set<(event: FsEvent) => void>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function emit(event: FsEvent): void {
    for (const cb of listeners) {
      cb(event);
    }
  }

  function scheduleEmit(absPath: string, type: "add" | "change" | "unlink"): void {
    const existing = debounceTimers.get(absPath);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      debounceTimers.delete(absPath);
      const relPath = path.relative(config.root, absPath).replace(/\\/g, "/");
      const basename = path.basename(absPath);
      const kind = kindFor(basename, config) ?? undefined;
      emit({ type, path: relPath, kind });
    }, 150);

    debounceTimers.set(absPath, timer);
  }

  const chokidarWatcher = chokidar.watch(config.root, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    ignored: (absPath: string) => shouldIgnore(absPath, config, ig),
  });

  chokidarWatcher.on("add", (absPath: string) => {
    scheduleEmit(absPath, "add");
  });

  chokidarWatcher.on("change", (absPath: string) => {
    scheduleEmit(absPath, "change");
  });

  chokidarWatcher.on("unlink", (absPath: string) => {
    scheduleEmit(absPath, "unlink");
  });

  chokidarWatcher.on("ready", () => {
    emit({ type: "ready" });
  });

  return {
    subscribe(cb: (event: FsEvent) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async close(): Promise<void> {
      // Clear all debounce timers
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      await chokidarWatcher.close();
    },
  };
}
