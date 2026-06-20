import { describe, expect, it } from "bun:test";
import { build } from "../../src/server/search-index.ts";
import type { IndexFile } from "../../src/server/search-index.ts";

function makeFile(overrides: Partial<IndexFile>): IndexFile {
  return {
    path: "doc.md",
    title: "Doc",
    prose: "some content",
    kind: "md",
    ...overrides,
  };
}

describe("build - filtering by kind", () => {
  it("indexes md files", () => {
    const idx = build([makeFile({ path: "a.md", kind: "md", prose: "hello world", title: "A" })]);
    const hits = idx.query("hello");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].path).toBe("a.md");
  });

  it("indexes mdx files", () => {
    const idx = build([makeFile({ path: "b.mdx", kind: "mdx", prose: "react component docs", title: "B" })]);
    const hits = idx.query("react");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("indexes txt files", () => {
    const idx = build([makeFile({ path: "c.txt", kind: "txt", prose: "plain text content", title: "C" })]);
    const hits = idx.query("plain");
    expect(hits.length).toBeGreaterThan(0);
  });

  it("excludes html files", () => {
    const idx = build([makeFile({ path: "d.html", kind: "html", prose: "html content here", title: "D" })]);
    const hits = idx.query("html");
    expect(hits.length).toBe(0);
  });

  it("excludes pdf files", () => {
    const idx = build([makeFile({ path: "e.pdf", kind: "pdf", prose: "pdf content here", title: "E" })]);
    const hits = idx.query("pdf");
    expect(hits.length).toBe(0);
  });

  it("excludes image files", () => {
    const idx = build([makeFile({ path: "f.png", kind: "image", prose: "image alt text", title: "F" })]);
    const hits = idx.query("image");
    expect(hits.length).toBe(0);
  });
});

describe("query - basic search", () => {
  it("returns SearchHit[] with path, title, snippet, rank", () => {
    const idx = build([makeFile({ path: "doc.md", title: "My Doc", prose: "the quick brown fox", kind: "md" })]);
    const hits = idx.query("quick");
    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0];
    expect(hit.path).toBe("doc.md");
    expect(hit.title).toBe("My Doc");
    expect(typeof hit.snippet).toBe("string");
    expect(typeof hit.rank).toBe("number");
  });

  it("snippet contains <mark> around matched terms", () => {
    const idx = build([makeFile({ path: "doc.md", title: "Doc", prose: "the quick brown fox jumps", kind: "md" })]);
    const hits = idx.query("quick");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].snippet).toContain("<mark>");
    expect(hits[0].snippet).toContain("</mark>");
  });

  it("returns empty array for no match", () => {
    const idx = build([makeFile({ path: "doc.md", prose: "hello world", kind: "md" })]);
    const hits = idx.query("nonexistent");
    expect(hits).toEqual([]);
  });

  it("multiple docs: higher-relevance doc ranks first (lower bm25 rank number)", () => {
    const idx = build([
      makeFile({ path: "low.md", title: "Low Relevance", prose: "the quick brown fox", kind: "md" }),
      makeFile({
        path: "high.md",
        title: "High Relevance",
        prose: "quick quick quick quick quick fox",
        kind: "md",
      }),
    ]);
    const hits = idx.query("quick");
    expect(hits.length).toBe(2);
    // BM25 from SQLite FTS5: more negative = more relevant; sorted ascending so most relevant first
    expect(hits[0].path).toBe("high.md");
  });
});

describe("upsert", () => {
  it("adds new entry that can be queried", () => {
    const idx = build([]);
    idx.upsert("new.md", "newly added content", "New Doc");
    const hits = idx.query("newly");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].path).toBe("new.md");
  });

  it("updates existing entry", () => {
    const idx = build([makeFile({ path: "doc.md", prose: "original content", title: "Doc", kind: "md" })]);
    idx.upsert("doc.md", "completely different text now", "Doc Updated");
    const hitsOld = idx.query("original");
    expect(hitsOld.length).toBe(0);
    const hitsNew = idx.query("different");
    expect(hitsNew.length).toBeGreaterThan(0);
    expect(hitsNew[0].title).toBe("Doc Updated");
  });
});

describe("remove", () => {
  it("removes entry so subsequent query returns empty", () => {
    const idx = build([makeFile({ path: "doc.md", prose: "some searchable content", title: "Doc", kind: "md" })]);
    const before = idx.query("searchable");
    expect(before.length).toBeGreaterThan(0);
    idx.remove("doc.md");
    const after = idx.query("searchable");
    expect(after).toEqual([]);
  });
});
