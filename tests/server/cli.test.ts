import { describe, expect, it } from "bun:test";
import { buildCliOverrides } from "../../src/server/cli.ts";

describe("buildCliOverrides", () => {
  it("returns empty object when no args", () => {
    const overrides = buildCliOverrides({});
    expect(overrides).toEqual({});
  });

  it("maps port to number", () => {
    const overrides = buildCliOverrides({ port: 3000 });
    expect(overrides.port).toBe(3000);
  });

  it("maps host string", () => {
    const overrides = buildCliOverrides({ host: "0.0.0.0" });
    expect(overrides.host).toBe("0.0.0.0");
  });

  it("maps title string", () => {
    const overrides = buildCliOverrides({ title: "My Docs" });
    expect(overrides.title).toBe("My Docs");
  });

  it("maps open boolean", () => {
    const overrides = buildCliOverrides({ open: true });
    expect(overrides.open).toBe(true);
  });

  it("maps dir to root", () => {
    const overrides = buildCliOverrides({ dir: "/some/path" });
    expect(overrides.root).toBe("/some/path");
  });

  it("maps include array", () => {
    const overrides = buildCliOverrides({ include: ["docs", "notes"] });
    expect(overrides.include).toEqual(["docs", "notes"]);
  });

  it("maps exclude array", () => {
    const overrides = buildCliOverrides({ exclude: ["node_modules", ".git"] });
    expect(overrides.exclude).toEqual(["node_modules", ".git"]);
  });

  it("sets includeHidden true when hidden flag set", () => {
    const overrides = buildCliOverrides({ hidden: true });
    expect(overrides.includeHidden).toBe(true);
  });

  it("does not set includeHidden when hidden not set", () => {
    const overrides = buildCliOverrides({});
    expect("includeHidden" in overrides).toBe(false);
  });

  it("sets useGitignore false when noGitignore flag set", () => {
    const overrides = buildCliOverrides({ noGitignore: true });
    expect(overrides.useGitignore).toBe(false);
  });

  it("does not set useGitignore when noGitignore not set", () => {
    const overrides = buildCliOverrides({});
    expect("useGitignore" in overrides).toBe(false);
  });

  it("combines multiple flags", () => {
    const overrides = buildCliOverrides({
      dir: "/docs",
      port: 9000,
      host: "localhost",
      title: "Test",
      open: true,
      include: ["a"],
      exclude: ["b"],
      hidden: true,
      noGitignore: true,
    });
    expect(overrides.root).toBe("/docs");
    expect(overrides.port).toBe(9000);
    expect(overrides.host).toBe("localhost");
    expect(overrides.title).toBe("Test");
    expect(overrides.open).toBe(true);
    expect(overrides.include).toEqual(["a"]);
    expect(overrides.exclude).toEqual(["b"]);
    expect(overrides.includeHidden).toBe(true);
    expect(overrides.useGitignore).toBe(false);
  });
});

describe("CLI args win over ENV via resolveConfig", () => {
  it("CLI port beats VP_PORT env", async () => {
    const { resolveConfig } = await import("../../src/server/config.ts");
    const overrides = buildCliOverrides({ port: 5555 });
    const cfg = resolveConfig(overrides, { env: { VP_PORT: "9999", VP_ROOT: "/tmp" } });
    expect(cfg.port).toBe(5555);
  });

  it("CLI host beats VP_HOST env", async () => {
    const { resolveConfig } = await import("../../src/server/config.ts");
    const overrides = buildCliOverrides({ host: "0.0.0.0" });
    const cfg = resolveConfig(overrides, { env: { VP_HOST: "127.0.0.1", VP_ROOT: "/tmp" } });
    expect(cfg.host).toBe("0.0.0.0");
  });
});
