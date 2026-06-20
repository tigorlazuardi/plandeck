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
  it("returns built-in defaults when no overrides/env/vpconfig", () => {
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
  it("VP_PORT overrides port (parsed as number)", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_PORT: "8080" } });
    expect(cfg.port).toBe(8080);
  });

  it("VP_HOST overrides host", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_HOST: "0.0.0.0" } });
    expect(cfg.host).toBe("0.0.0.0");
  });

  it("VP_TITLE overrides title", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_TITLE: "My Docs" } });
    expect(cfg.title).toBe("My Docs");
  });

  it("VP_OPEN=true → open=true", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_OPEN: "true" } });
    expect(cfg.open).toBe(true);
  });

  it("VP_OPEN=1 → open=true", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_OPEN: "1" } });
    expect(cfg.open).toBe(true);
  });

  it("VP_OPEN=false → open=false", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_OPEN: "false" } });
    expect(cfg.open).toBe(false);
  });

  it("VP_ROOT overrides root", () => {
    const sub = fs.mkdtempSync(path.join(os.tmpdir(), "vp-root-"));
    try {
      const cfg = resolveConfig(undefined, { env: { VP_ROOT: sub } });
      expect(cfg.root).toBe(sub);
    } finally {
      fs.rmSync(sub, { recursive: true, force: true });
    }
  });
});

describe("resolveConfig - .vpconfig.json", () => {
  it("reads include/exclude from vpconfig", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".vpconfig.json"),
      JSON.stringify({ include: ["docs/**"], exclude: ["private/**"] }),
    );
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.include).toEqual(["docs/**"]);
    expect(cfg.exclude).toEqual(["private/**"]);
  });

  it("lists REPLACE wholesale (no merge)", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".vpconfig.json"),
      JSON.stringify({ textFiles: [".rst", ".tex"] }),
    );
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.textFiles).toEqual([".rst", ".tex"]);
  });

  it("vpconfig title overrides basename default", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.title).toBe("VPC Title");
  });

  it("throws on invalid JSON in vpconfig", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), "{ not json }");
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });

  it("throws on schema violation in vpconfig (bad type)", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ port: "not-a-number" }));
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });
});

describe("resolveConfig - precedence chain", () => {
  it("overrides arg beats vpconfig beats ENV beats defaults (per-key)", () => {
    // ENV sets port=8080, vpconfig sets port=9000, override sets port=1234
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ port: 9000 }));
    const cfg = resolveConfig({ root: tmpDir, port: 1234 }, { env: { VP_PORT: "8080" } });
    expect(cfg.port).toBe(1234); // override wins
  });

  it("vpconfig beats ENV when override not set", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ port: 9000 }));
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_PORT: "8080" } });
    expect(cfg.port).toBe(9000); // vpconfig beats ENV
  });

  it("ENV beats defaults when no vpconfig or override", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_PORT: "8080" } });
    expect(cfg.port).toBe(8080);
  });

  it("overrides-arg title beats vpconfig title", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir, title: "CLI Title" }, { env: {} });
    expect(cfg.title).toBe("CLI Title");
  });

  it("VP_TITLE beats basename but loses to vpconfig", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ title: "VPC Title" }));
    const cfg = resolveConfig({ root: tmpDir }, { env: { VP_TITLE: "ENV Title" } });
    expect(cfg.title).toBe("VPC Title");
  });
});

describe("resolveConfig - title fallback", () => {
  it("title-from-basename only when no layer provides title", () => {
    const cfg = resolveConfig({ root: tmpDir }, { env: {} });
    expect(cfg.title).toBe(path.basename(tmpDir));
  });
});

describe("resolveConfig - .vpconfig.json strict schema", () => {
  it("throws a clear error when vpconfig contains unknown key 'root'", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".vpconfig.json"),
      JSON.stringify({ root: "/some/path", port: 4321 }),
    );
    expect(() => resolveConfig({ root: tmpDir }, { env: {} })).toThrow();
  });

  it("throws a clear error when vpconfig contains any unknown key", () => {
    fs.writeFileSync(path.join(tmpDir, ".vpconfig.json"), JSON.stringify({ unknownKey: "value" }));
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
