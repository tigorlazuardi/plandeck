import { describe, expect, it } from "bun:test";
import { kindFor } from "../../src/server/kind.ts";
import type { ResolvedConfig } from "../../src/shared/types.ts";

function makeConfig(overrides?: Partial<ResolvedConfig>): ResolvedConfig {
  return {
    root: "/tmp/root",
    port: 4321,
    host: "127.0.0.1",
    title: "Test",
    open: false,
    include: [],
    exclude: [],
    textFiles: [".md", ".mdx", ".txt", ".trace.json"],
    nonTextFiles: [".html", ".htm", ".pdf", ".jpg", ".jpeg", ".png"],
    maxFileBytes: 5 * 1024 * 1024,
    ...overrides,
  };
}

describe("kindFor - trace compound suffix", () => {
  it("maps foo.trace.json to 'trace'", () => {
    const cfg = makeConfig();
    expect(kindFor("foo.trace.json", cfg)).toBe("trace");
  });

  it("is case-insensitive: FOO.TRACE.JSON to 'trace'", () => {
    const cfg = makeConfig();
    expect(kindFor("FOO.TRACE.JSON", cfg)).toBe("trace");
  });

  it("a plain data.json (not trace) is not discovered by default", () => {
    const cfg = makeConfig();
    expect(kindFor("data.json", cfg)).toBeNull();
  });

  it("respects textFiles membership: .trace.json absent from config → not discovered", () => {
    const cfg = makeConfig({ textFiles: [".md", ".mdx", ".txt"] });
    expect(kindFor("foo.trace.json", cfg)).toBeNull();
  });

  it(".mdx is unchanged", () => {
    const cfg = makeConfig();
    expect(kindFor("doc.mdx", cfg)).toBe("mdx");
  });

  it(".md is unchanged", () => {
    const cfg = makeConfig();
    expect(kindFor("doc.md", cfg)).toBe("md");
  });

  it(".txt is unchanged", () => {
    const cfg = makeConfig();
    expect(kindFor("notes.txt", cfg)).toBe("txt");
  });

  it("non-text ext unchanged: .pdf", () => {
    const cfg = makeConfig();
    expect(kindFor("report.pdf", cfg)).toBe("pdf");
  });
});
