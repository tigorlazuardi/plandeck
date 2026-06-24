import { describe, expect, it } from "bun:test";
import { bracesHint } from "../../src/client/render/Mdx.tsx";

describe("bracesHint", () => {
  it("hints at fenced code / escaping on acorn expression errors", () => {
    const hint = bracesHint("Could not parse expression with acorn");
    expect(hint).not.toBeNull();
    expect(hint).toContain("fenced code block");
  });

  it("matches the generic expression wording", () => {
    expect(bracesHint("Unexpected character in expression")).not.toBeNull();
  });

  it("returns null for unrelated errors", () => {
    expect(bracesHint("Network request failed")).toBeNull();
  });
});
