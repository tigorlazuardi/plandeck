import * as fs from "node:fs";
import * as path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import type { DocResponse, SearchResponse, TreeResponse } from "../shared/types.ts";
import { resolveConfig } from "./config.ts";
import { discover } from "./discovery.ts";
import { kindFor } from "./kind.ts";
import { toProse } from "./prose.ts";
import { confinedResolve, rawHandler } from "./raw.ts";
import { build } from "./search-index.ts";
import type { SearchIndex } from "./search-index.ts";
import { createWatcher } from "./watcher.ts";

const app = new Hono();

// Lazy-initialized search index (built on first /api/search call)
let searchIndex: SearchIndex | null = null;

// Shared watcher singleton — lazy-initialized on first SSE connection
let sharedWatcher: ReturnType<typeof createWatcher> | null = null;

function getSharedWatcher(): ReturnType<typeof createWatcher> {
  if (!sharedWatcher) {
    const config = resolveConfig();
    sharedWatcher = createWatcher(config);

    // Wire watcher events to update the search index incrementally
    sharedWatcher.subscribe(async (event) => {
      if (event.type === "ready") return;
      if (event.type === "unlink") {
        if (searchIndex) {
          searchIndex.remove(event.path);
        }
        return;
      }
      // add or change — update index if text kind
      const config2 = resolveConfig();
      const basename = path.basename(event.path);
      const kind = kindFor(basename, config2);
      if (kind === "md" || kind === "mdx" || kind === "txt") {
        const absPath = path.join(config2.root, event.path);
        try {
          const text = fs.readFileSync(absPath, "utf-8");
          const prose = await toProse(text, kind);
          if (searchIndex) {
            searchIndex.upsert(event.path, prose, basename);
          }
        } catch {
          // file unreadable — skip index update
        }
      }
    });
  }
  return sharedWatcher;
}

async function getSearchIndex(): Promise<SearchIndex> {
  if (searchIndex) return searchIndex;

  const config = resolveConfig();
  const tree = discover(config);

  // Flatten tree to all file nodes
  function flattenNodes(nodes: ReturnType<typeof discover>): ReturnType<typeof discover> {
    const result: ReturnType<typeof discover> = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children) result.push(...flattenNodes(node.children));
    }
    return result;
  }

  const fileNodes = flattenNodes(tree).filter((n) => n.type === "file" && n.kind);

  // Build index files: read each file and convert to prose
  const indexFiles = await Promise.all(
    fileNodes.map(async (node) => {
      const absPath = path.join(config.root, node.path);
      let prose = "";
      try {
        const text = await Bun.file(absPath).text();
        const kind = node.kind as "md" | "mdx" | "txt" | "html" | "pdf" | "image";
        if (kind === "md" || kind === "mdx" || kind === "txt") {
          prose = await toProse(text, kind);
        }
      } catch {
        // skip unreadable files
      }
      return {
        path: node.path,
        title: node.name,
        prose,
        kind: node.kind ?? "md",
      };
    }),
  );

  searchIndex = build(indexFiles);
  return searchIndex;
}

app.get("/api/events", (c) => {
  c.header("X-Accel-Buffering", "no");
  return streamSSE(c, async (stream) => {
    const watcher = getSharedWatcher();
    const unsub = watcher.subscribe((event) => {
      stream.writeSSE({ data: JSON.stringify(event) });
    });
    await new Promise<void>((resolve) => {
      c.req.raw.signal.addEventListener("abort", () => {
        unsub();
        resolve();
      });
    });
  });
});

app.get("/api/search", async (c) => {
  const q = c.req.query("q");
  if (!q || !q.trim()) {
    return c.json({ error: "q parameter is required" }, 400);
  }
  const idx = await getSearchIndex();
  const hits = idx.query(q);
  const response: SearchResponse = { hits };
  return c.json(response);
});

app.get("/api/tree", (c) => {
  // Resolve config per-request so it always reflects the current FS state.
  const config = resolveConfig();
  const tree = discover(config);
  const response: TreeResponse = {
    root: config.root,
    title: config.title,
    tree,
  };
  return c.json(response);
});

// Document endpoint — returns DocResponse JSON for text/html kinds
app.get("/api/doc/:relpath{.*}", async (c) => {
  const config = resolveConfig();
  const rawRelpath = c.req.param("relpath") ?? "";
  const confinement = confinedResolve(config.root, rawRelpath);

  if ("error" in confinement) {
    return c.json(
      { error: confinement.error === 403 ? "Forbidden" : "Not found" },
      confinement.error,
    );
  }

  const { resolved } = confinement;
  const basename = path.basename(resolved);
  const kind = kindFor(basename, config);

  if (!kind) {
    return c.json({ error: "Not found" }, 404);
  }

  // Non-text kinds (pdf, image) have no content to serve here — raw endpoint serves bytes
  if (kind === "pdf" || kind === "image") {
    const response: DocResponse = { path: rawRelpath, kind };
    return c.json(response);
  }

  // Text/html kinds — read file content
  const file = Bun.file(resolved);
  const size = file.size;

  if (size > config.maxFileBytes) {
    const response: DocResponse = { path: rawRelpath, kind, tooLarge: true };
    return c.json(response);
  }

  let content: string;
  try {
    content = await file.text();
  } catch {
    const response: DocResponse = { path: rawRelpath, kind, undecodable: true };
    return c.json(response);
  }

  // Parse frontmatter for mdx/md — simple YAML front-matter extraction (title + brief only)
  if (kind === "mdx" || kind === "md") {
    let body = content;
    const frontmatter: { title?: string; brief?: string } = {};

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (fmMatch) {
      const yamlBlock = fmMatch[1] ?? "";
      body = fmMatch[2] ?? "";
      // Extract title and brief from YAML via simple regex (sufficient for known keys)
      const titleMatch = yamlBlock.match(/^title:\s*(.+)$/m);
      const briefMatch = yamlBlock.match(/^brief:\s*(.+)$/m);
      if (titleMatch?.[1]) frontmatter.title = titleMatch[1].trim().replace(/^['"]|['"]$/g, "");
      if (briefMatch?.[1]) frontmatter.brief = briefMatch[1].trim().replace(/^['"]|['"]$/g, "");
    }

    const response: DocResponse = {
      path: rawRelpath,
      kind,
      frontmatter,
      content: body,
    };
    return c.json(response);
  }

  const response: DocResponse = { path: rawRelpath, kind, content };
  return c.json(response);
});

// Raw file endpoint — must be BEFORE static middleware to avoid shadowing
app.get("/api/raw/:relpath{.*}", rawHandler);

// Serve static dist/ in production
app.use(
  "/*",
  serveStatic({
    root: "./dist",
  }),
);

// SPA fallback: non-/api routes that didn't match a static file get index.html
app.get("/*", async (c) => {
  const path = c.req.path;
  if (path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  const file = Bun.file("./dist/index.html");
  if (await file.exists()) {
    return new Response(file, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return c.html(
    '<!doctype html><html><head><meta charset="UTF-8"/></head><body><div id="root"></div></body></html>',
  );
});

export { app };
