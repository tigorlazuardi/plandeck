import { describe, expect, test } from "bun:test";
import { parseMetaString } from "../../src/client/render/highlight.ts";

describe("parseMetaString", () => {
  test("empty meta → no title, no showLineNumbers, no startLine", () => {
    const result = parseMetaString("");
    expect(result.title).toBeUndefined();
    expect(result.showLineNumbers).toBeUndefined();
    expect(result.startLine).toBeUndefined();
  });

  test("title with double quotes", () => {
    const result = parseMetaString('title="server.ts"');
    expect(result.title).toBe("server.ts");
  });

  test("title with single quotes", () => {
    const result = parseMetaString("title='utils/helpers.ts'");
    expect(result.title).toBe("utils/helpers.ts");
  });

  test("showLineNumbers=false → false", () => {
    const result = parseMetaString("showLineNumbers=false");
    expect(result.showLineNumbers).toBe(false);
  });

  test("showLineNumbers alone (no value) → true", () => {
    const result = parseMetaString("showLineNumbers");
    expect(result.showLineNumbers).toBe(true);
  });

  test("showLineNumbers=true → true", () => {
    const result = parseMetaString("showLineNumbers=true");
    expect(result.showLineNumbers).toBe(true);
  });

  test("startLine=42 → 42", () => {
    const result = parseMetaString("startLine=42");
    expect(result.startLine).toBe(42);
  });

  test("startLine=1 → 1", () => {
    const result = parseMetaString("startLine=1");
    expect(result.startLine).toBe(1);
  });

  test("combined: title + showLineNumbers=false", () => {
    const result = parseMetaString('title="server.ts" showLineNumbers=false');
    expect(result.title).toBe("server.ts");
    expect(result.showLineNumbers).toBe(false);
    expect(result.startLine).toBeUndefined();
  });

  test("combined: title + startLine", () => {
    const result = parseMetaString('title="main.go" startLine=10');
    expect(result.title).toBe("main.go");
    expect(result.startLine).toBe(10);
  });

  test("all three combined", () => {
    const result = parseMetaString('title="app.ts" showLineNumbers=false startLine=99');
    expect(result.title).toBe("app.ts");
    expect(result.showLineNumbers).toBe(false);
    expect(result.startLine).toBe(99);
  });

  test("unknown meta tokens ignored", () => {
    const result = parseMetaString('highlight={1,3} title="foo.ts"');
    expect(result.title).toBe("foo.ts");
    expect(result.showLineNumbers).toBeUndefined();
    expect(result.startLine).toBeUndefined();
  });

  test("defaults: empty meta → line numbers on, start 1 (applied by transformer)", () => {
    // parseMetaString returns undefined for absent fields;
    // the transformer defaults showLineNumbers → true, startLine → 1.
    // Verify that absence means "use default" (not "false" / "0").
    const result = parseMetaString("");
    const showLN = result.showLineNumbers !== false; // transformer logic
    const start = result.startLine ?? 1; // transformer logic
    expect(showLN).toBe(true);
    expect(start).toBe(1);
  });
});
