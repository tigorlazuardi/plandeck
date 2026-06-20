import { app } from "./app.ts";

const port = Number(process.env.VP_PORT ?? 8787);
const host = "127.0.0.1";

const server = Bun.serve({
  hostname: host,
  port,
  fetch: app.fetch,
});

console.log(`Visual Planner running at http://${host}:${server.port}`);
