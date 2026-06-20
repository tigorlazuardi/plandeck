import * as fs from "node:fs";
import type { ResolvedConfig } from "../shared/types.ts";
import { createApp } from "./app.ts";

export type ServerHandle = ReturnType<typeof Bun.serve>;

/**
 * Start the Visual Planner server with lifecycle management.
 *
 * - Validates root directory exists and is a directory
 * - Attempts port; on EADDRINUSE increments by 1 up to +10
 * - Prints startup banner with OSC 8 hyperlink
 * - Registers SIGINT/SIGTERM for graceful shutdown
 * - Opens browser if config.open === true
 */
export async function startServer(
  config: ResolvedConfig,
): Promise<{ server: ServerHandle; actualPort: number }> {
  // Bad root guard
  if (!fs.existsSync(config.root)) {
    throw new Error(`Root directory does not exist: ${config.root}`);
  }
  const stat = fs.statSync(config.root);
  if (!stat.isDirectory()) {
    throw new Error(`Root path is not a directory: ${config.root}`);
  }

  // Port fallback: try configured port, increment on EADDRINUSE, cap at +10
  const basePort = config.port;
  let server: ServerHandle | null = null;
  let actualPort = basePort;

  for (let attempt = 0; attempt <= 10; attempt++) {
    const tryPort = basePort + attempt;
    try {
      server = Bun.serve({
        hostname: config.host,
        port: tryPort,
        fetch: createApp(config).fetch,
      });
      actualPort = server.port ?? tryPort;
      break;
    } catch (err) {
      const isAddrInUse =
        err instanceof Error &&
        ((err as NodeJS.ErrnoException).code === "EADDRINUSE" ||
          err.message.includes("EADDRINUSE") ||
          err.message.includes("address already in use"));
      if (isAddrInUse && attempt < 10) {
        continue;
      }
      throw err;
    }
  }

  if (!server) {
    throw new Error(`Could not bind to any port in range ${basePort}–${basePort + 10}`);
  }

  const capturedServer = server;

  // Startup banner
  const url = `http://${config.host}:${actualPort}`;
  // OSC 8 hyperlink: \x1b]8;;<url>\x1b\\ <text> \x1b]8;;\x1b\\
  const hyperlink = `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`;
  console.log(`Visual Planner\nRoot: ${config.root}\nURL:  ${hyperlink}\n`);

  // Graceful shutdown
  const shutdown = () => {
    capturedServer.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Open browser if requested
  if (config.open) {
    try {
      const { default: open } = await import("open");
      await open(url);
    } catch {
      // non-fatal; some environments can't open browser
    }
  }

  return { server: capturedServer, actualPort };
}
