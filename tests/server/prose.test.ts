import { describe, expect, it } from "bun:test";
import { toProse } from "../../src/server/prose.ts";

describe("toProse - txt", () => {
  it("returns text as-is for kind=txt", async () => {
    const text = "Hello world\nThis is plain text.";
    const result = await toProse(text, "txt");
    expect(result).toBe(text);
  });
});

describe("toProse - md", () => {
  it("strips heading markers", async () => {
    const text = "# Heading\n\nSome content here.";
    const result = await toProse(text, "md");
    expect(result).not.toContain("#");
    expect(result).toContain("Heading");
    expect(result).toContain("Some content here");
  });

  it("strips code fences", async () => {
    const text = "Some text\n\n```\nconst x = 1;\n```\n\nMore text.";
    const result = await toProse(text, "md");
    expect(result).not.toContain("```");
    expect(result).toContain("Some text");
  });

  it("strips frontmatter", async () => {
    const text = "---\ntitle: Foo\ndate: 2024-01-01\n---\n\nBody content here.";
    const result = await toProse(text, "md");
    expect(result).not.toContain("title:");
    expect(result).not.toContain(`${"Foo".slice(0, 3)}---`);
    expect(result).not.toMatch(/^---/);
    expect(result).toContain("Body content here");
  });

  it("frontmatter title does NOT appear in prose output", async () => {
    const text = "---\ntitle: MyTitle\n---\n\nActual body.";
    const result = await toProse(text, "md");
    // frontmatter title value should not leak into prose
    expect(result).not.toContain("MyTitle");
    expect(result).toContain("Actual body");
  });

  it("collapses extra whitespace", async () => {
    const text = "# Title\n\nParagraph one.\n\nParagraph two.";
    const result = await toProse(text, "md");
    // should not have multiple consecutive newlines/spaces preserved verbatim
    expect(result.trim()).not.toMatch(/\s{3,}/);
  });
});

describe("toProse - html node stripping (XSS prevention)", () => {
  it("strips raw <script> HTML nodes from md prose", async () => {
    const text = "Some text\n\n<script>alert(1)</script>\n\nMore content.";
    const result = await toProse(text, "md");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Some text");
    expect(result).toContain("More content");
  });

  it("strips <img onerror> HTML nodes from md prose", async () => {
    const text = "Before\n\n<img src=x onerror=alert(1)>\n\nAfter.";
    const result = await toProse(text, "md");
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
    expect(result).toContain("Before");
    expect(result).toContain("After");
  });

  it("strips raw HTML nodes from mdx prose", async () => {
    const text = "# Title\n\n<script>alert(1)</script>\n\nBody.";
    const result = await toProse(text, "mdx");
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert(1)");
    expect(result).toContain("Body");
  });
});

describe("toProse - mdx", () => {
  it("strips JSX tags like <Callout>...</Callout>", async () => {
    const text = "# Title\n\n<Callout>This is a callout</Callout>\n\nSome prose.";
    const result = await toProse(text, "mdx");
    expect(result).not.toContain("<Callout>");
    expect(result).not.toContain("</Callout>");
    expect(result).toContain("Some prose");
  });

  it("strips frontmatter in mdx mode", async () => {
    const text = "---\ntitle: Foo\n---\n\n<Alert>warning</Alert>\n\nBody text.";
    const result = await toProse(text, "mdx");
    expect(result).not.toContain("title:");
    expect(result).toContain("Body text");
  });

  it("strips heading markers in mdx mode", async () => {
    const text = "## Section\n\n<Component prop='val' />\n\nContent.";
    const result = await toProse(text, "mdx");
    expect(result).not.toContain("#");
    expect(result).toContain("Section");
    expect(result).toContain("Content");
  });
});
