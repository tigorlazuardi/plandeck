import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { TreeResponse } from "../shared/types.ts";

const app = new Hono();

app.get("/api/tree", (c) => {
  const response: TreeResponse = {
    root: process.cwd(),
    title: "Visual Planner",
    tree: [],
  };
  return c.json(response);
});

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
