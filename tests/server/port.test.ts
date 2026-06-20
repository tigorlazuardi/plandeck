import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveConfig } from "../../src/server/config.ts";
import { startServer } from "../../src/server/index.ts";

const servers: Array<{ stop: () => void }> = [];

afterEach(async () => {
  for (const s of servers) {
    try {
      s.stop();
    } catch {
      // ignore
    }
  }
  servers.length = 0;
});

describe("startServer port fallback", () => {
  it("starts on configured port when free", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-port-test-"));
    try {
      // Use a high ephemeral port unlikely to be in use
      const config = resolveConfig({ root: tmpDir, port: 59831 }, { env: {} });
      const result = await startServer(config);
      servers.push(result.server);
      expect(result.actualPort).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("falls back to next port when configured port is in use", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-port-test-"));
    try {
      // Occupy a port first
      const occupier = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: () => new Response("occupied"),
      });
      servers.push(occupier);
      const occupiedPort = occupier.port ?? 59832;

      const config = resolveConfig({ root: tmpDir, port: occupiedPort }, { env: {} });
      const result = await startServer(config);
      servers.push(result.server);
      // Should have picked a different port
      expect(result.actualPort).not.toBe(occupiedPort);
      expect(result.actualPort).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("throws when root does not exist", async () => {
    const config = resolveConfig({ root: "/tmp/does-not-exist-vp-test-xyz" }, { env: {} });
    await expect(startServer(config)).rejects.toThrow();
  });

  it("throws when root is not a directory", async () => {
    const tmpFile = path.join(os.tmpdir(), "vp-not-a-dir.txt");
    fs.writeFileSync(tmpFile, "hello");
    try {
      const config = resolveConfig({ root: tmpFile }, { env: {} });
      await expect(startServer(config)).rejects.toThrow();
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });
});
