/**
 * Tests that createApp(config) threads the injected config into all route handlers.
 * Proves: CLI <dir> override (root) and filter overrides (include/exclude) reach the routes.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createApp } from "../../src/server/app.ts";
import { resolveConfig } from "../../src/server/config.ts";

let fixtureDir: string;

beforeAll(() => {
  // Create a temp fixture dir that is NOT cwd — simulates `plandeck /some/dir`
  fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-inject-test-"));
  fs.writeFileSync(path.join(fixtureDir, "alpha.md"), "# Alpha");
  fs.writeFileSync(path.join(fixtureDir, "beta.txt"), "beta content");
  fs.writeFileSync(path.join(fixtureDir, "gamma.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  // Hidden file — should be excluded by default
  fs.writeFileSync(path.join(fixtureDir, ".hidden.md"), "# Hidden");
});

afterAll(() => {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
});

describe("createApp — injected root reaches /api/tree", () => {
  it("returns fixtureDir root (not cwd) when config.root is fixtureDir", async () => {
    // This is the core positional-arg bug regression: routes must use injected root
    const config = resolveConfig({ root: fixtureDir }, { env: {} });
    const app = createApp(config);

    const res = await app.request("/api/tree");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.root).toBe(fixtureDir);
    // cwd is not the fixture dir — confirm they differ so the test is non-trivial
    expect(fixtureDir).not.toBe(process.cwd());
  });

  it("lists files from fixtureDir, not cwd", async () => {
    const config = resolveConfig({ root: fixtureDir }, { env: {} });
    const app = createApp(config);

    const res = await app.request("/api/tree");
    const body = (await res.json()) as { tree: Array<{ name: string }> };

    const names = body.tree.map((n) => n.name);
    // alpha.md and beta.txt are in fixtureDir
    expect(names).toContain("alpha.md");
    expect(names).toContain("beta.txt");
  });

  it("title reflects injected config.title when set via override", async () => {
    const config = resolveConfig({ root: fixtureDir, title: "My Override Title" }, { env: {} });
    const app = createApp(config);

    const res = await app.request("/api/tree");
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("My Override Title");
  });
});

describe("createApp — include override reaches /api/tree", () => {
  it("include override filters tree to only matching files", async () => {
    // Only include .md files — beta.txt and gamma.png should be absent
    const config = resolveConfig({ root: fixtureDir, include: ["**/*.md"] }, { env: {} });
    const app = createApp(config);

    const res = await app.request("/api/tree");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { tree: Array<{ name: string }> };
    const names = body.tree.map((n) => n.name);
    expect(names).toContain("alpha.md");
    // beta.txt does not match **/*.md
    expect(names).not.toContain("beta.txt");
  });
});

describe("createApp — confinement uses injected root", () => {
  it("/api/raw serves file from injected root, not cwd", async () => {
    const config = resolveConfig({ root: fixtureDir }, { env: {} });
    const app = createApp(config);

    // gamma.png is in fixtureDir; if root were cwd this would 404
    const res = await app.request("/api/raw/gamma.png");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") ?? "";
    expect(ct).toContain("image/png");
  });

  it("/api/doc serves md file from injected root", async () => {
    const config = resolveConfig({ root: fixtureDir }, { env: {} });
    const app = createApp(config);

    const res = await app.request("/api/doc/alpha.md");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string; content?: string };
    expect(body.kind).toBe("md");
    expect(body.content).toContain("Alpha");
  });
});
