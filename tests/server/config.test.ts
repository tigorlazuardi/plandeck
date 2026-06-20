import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveConfig } from "../../src/server/config.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-config-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("resolveConfig - defaults", () => {
  it("returns built-in defaults when no overrides/env/plandeck config", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.root).toBe(tmpDir);
    expect(cfg.port).toBe(4321);
    expect(cfg.host).toBe("127.0.0.1");
    expect(cfg.open).toBe(false);
    expect(cfg.include).toEqual([]);
    expect(cfg.exclude).toEqual([]);
    expect(cfg.textFiles).toEqual([".md", ".mdx", ".txt"]);
    expect(cfg.nonTextFiles).toEqual([".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"]);
    expect(cfg.maxFileBytes).toBe(5 * 1024 * 1024);
  });

  it("title defaults to basename of root", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.title).toBe(path.basename(tmpDir));
  });
});

describe("resolveConfig - ENV overrides", () => {
  it("PLANDECK_PORT overrides port (parsed as number)", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_PORT: "8080" } });
    expect(cfg.port).toBe(8080);
  });

  it("PLANDECK_HOST overrides host", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_HOST: "0.0.0.0" } });
    expect(cfg.host).toBe("0.0.0.0");
  });

  it("PLANDECK_TITLE overrides title", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_TITLE: "My Docs" } });
    expect(cfg.title).toBe("My Docs");
  });

  it("PLANDECK_OPEN=true → open=true", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_OPEN: "true" } });
    expect(cfg.open).toBe(true);
  });

  it("PLANDECK_OPEN=1 → open=true", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_OPEN: "1" } });
    expect(cfg.open).toBe(true);
  });

  it("PLANDECK_OPEN=false → open=false", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_OPEN: "false" } });
    expect(cfg.open).toBe(false);
  });

  it("PLANDECK_ROOT overrides root", () => {
    const sub = fs.mkdtempSync(path.join(os.tmpdir(), "vp-root-"));
    try {
      const cfg = resolveConfig(undefined, { env: { PLANDECK_ROOT: sub } });
      expect(cfg.root).toBe(sub);
    } finally {
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });
});

describe("resolveConfig - .plandeck.json", () => {
  it("reads include/exclude from plandeck config", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".plandeck.json"),
      JSON.stringify({ include: ["docs/**"], exclude: ["private/**"] }),
    );
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.include).toEqual(["docs/**"]);
    expect(cfg.exclude).toEqual(["private/**"]);
  });

  it("lists REPLACE wholesale (no merge)", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".plandeck.json"),
      JSON.stringify({ textFiles: [".rst", ".tex"] }),
    );
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.textFiles).toEqual([".rst", ".tex"]);
  });

  it("plandeck config title overrides basename default", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.title).toBe("VPC Title");
  });

  it("throws on invalid JSON in plandeck config", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), "{ not json }");
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });

  it("throws on schema violation in plandeck config (bad type)", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ port: "not-a-number" }));
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });
});

describe("resolveConfig - precedence chain", () => {
  it("overrides arg beats plandeck config beats ENV beats defaults (per-key)", () => {
    // ENV sets port=8080, plandeck config sets port=9000, override sets port=1234
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ port: 9000 }));
    const cfg = resolveConfig({ root: tmpDir, port: 1234 }, { env: { PLANDECK_PORT: "8080" } });
    expect(cfg.port).toBe(1234); // override wins
  });

  it("plandeck config beats ENV when override not set", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ port: 9000 }));
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_PORT: "8080" } });
    expect(cfg.port).toBe(9000); // plandeck config beats ENV
  });

  it("ENV beats defaults when no plandeck config or override", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_PORT: "8080" } });
    expect(cfg.port).toBe(8080);
  });

  it("overrides-arg title beats plandeck config title", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir, title: "CLI Title" }, { env: {} });
    expect(cfg.title).toBe("CLI Title");
  });

  it("PLANDECK_TITLE beats basename but loses to plandeck config", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir }, { env: { PLANDECK_TITLE: "ENV Title" } });
    expect(cfg.title).toBe("VPC Title");
  });
});

describe("resolveConfig - title fallback", () => {
  it("title-from-basename only when no layer provides title", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.title).toBe(path.basename(tmpDir));
  });
});

describe("resolveConfig - .plandeck.json strict schema", () => {
  it("throws a clear error when plandeck config contains unknown key 'root'", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".plandeck.json"),
      JSON.stringify({ root: "/some/path", port: 4321 }),
    );
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });

  it("throws a clear error when plandeck config contains any unknown key", () => {
    fs.writeFileSync(path.join(tmpDir, ".plandeck.json"), JSON.stringify({ unknownKey: "value" }));
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });
});

describe("resolveConfig - final validation", () => {
  it("throws when port is <= 0", () => {
    expect(() => resolveConfig({ root: tmpDir, port: 0 }, { env: {} })).toThrow();
  });

  it("throws when port is not integer", () => {
    expect(() => resolveConfig({ root: tmpDir, port: 3.14 }, { env: {} })).toThrow();
  });

  it("throws when textFiles ext does not start with dot", () => {
    expect(() => resolveConfig({ root: tmpDir, textFiles: ["md"] }, { env: {} })).toThrow();
  });
});
