import * as path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { SearchResponse, TreeResponse } from "../shared/types.ts";
import { resolveConfig } from "./config.ts";
import { discover } from "./discovery.ts";
import { toProse } from "./prose.ts";
import { rawHandler } from "./raw.ts";
import { build } from "./search-index.ts";
import type { SearchIndex } from "./search-index.ts";

const app = new Hono();

// Lazy-initialized search index (built on first /api/search call)
let searchIndex: SearchIndex | null = null;

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
