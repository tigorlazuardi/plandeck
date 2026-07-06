import { describe, expect, test } from "bun:test";
import { stripHtmlComments } from "../../src/client/render/stripHtmlComments.ts";

describe("stripHtmlComments", () => {
  test("removes a block-level comment", () => {
    const out = stripHtmlComments("# Title\n\n<!-- hidden -->\n\nVisible.");
    expect(out).not.toContain("hidden");
    expect(out).toContain("Visible.");
    expect(out).toContain("# Title");
  });

  test("removes an inline comment mid-paragraph", () => {
    const out = stripHtmlComments("Before <!-- secret --> after.");
    expect(out).not.toContain("secret");
    expect(out).toBe("Before  after.");
  });

  test("removes a multi-line comment", () => {
    const out = stripHtmlComments("a\n\n<!--\nmany\nlines\n-->\n\nb");
    expect(out).not.toContain("many");
    expect(out).not.toContain("lines");
    expect(out).toContain("a");
    expect(out).toContain("b");
  });

  test("preserves a comment inside a fenced code block", () => {
    const src = "text\n\n```html\n<!-- keep me -->\n```\n\nmore";
    const out = stripHtmlComments(src);
    expect(out).toContain("<!-- keep me -->");
  });

  test("preserves a comment inside a tilde fence", () => {
    const src = "~~~\n<!-- kept -->\n~~~";
    expect(stripHtmlComments(src)).toContain("<!-- kept -->");
  });

  test("preserves a comment inside an inline code span", () => {
    const out = stripHtmlComments("Use `<!-- x -->` for comments.");
    expect(out).toContain("`<!-- x -->`");
  });

  test("strips outside code but keeps inside code on the same doc", () => {
    const src = "<!-- gone -->\n\n`<!-- kept -->`";
    const out = stripHtmlComments(src);
    expect(out).not.toContain("gone");
    expect(out).toContain("`<!-- kept -->`");
  });

  test("leaves an unterminated comment literal", () => {
    const src = "text <!-- no close";
    expect(stripHtmlComments(src)).toBe("text <!-- no close");
  });

  test("no-op when there are no comments", () => {
    const src = "# Plain\n\n```js\nconst x = 1;\n```\n";
    expect(stripHtmlComments(src)).toBe(src);
  });
});
