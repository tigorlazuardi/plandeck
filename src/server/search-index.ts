import { Database } from "bun:sqlite";
import type { DocKind, SearchHit } from "../shared/types.ts";

export interface IndexFile {
  path: string;
  title: string;
  prose: string;
  kind: DocKind;
}

export interface SearchIndex {
  query(q: string): SearchHit[];
  upsert(path: string, prose: string, title: string): void;
  remove(path: string): void;
}

const INDEXED_KINDS = new Set<DocKind>(["md", "mdx", "txt"]);

// Escape HTML special chars in FTS5 snippet, then restore only <mark>/<mark> tags
function sanitizeSnippet(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}

export function build(files: IndexFile[]): SearchIndex {
  const db = new Database(":memory:");

  db.run(`
    CREATE VIRTUAL TABLE fts_docs USING fts5(
      path UNINDEXED,
      title,
      body,
      tokenize='porter ascii'
    )
  `);

  const insert = db.prepare("INSERT INTO fts_docs(path, title, body) VALUES (?, ?, ?)");

  for (const file of files) {
    if (!INDEXED_KINDS.has(file.kind)) continue;
    insert.run(file.path, file.title, file.prose);
  }

  return {
    query(q: string): SearchHit[] {
      if (!q.trim()) return [];
      try {
        const rows = db
          .prepare(
            `SELECT path, title,
              snippet(fts_docs, 2, '<mark>', '</mark>', '…', 16) as snippet,
              bm25(fts_docs) as rank
             FROM fts_docs
             WHERE fts_docs MATCH ?
             ORDER BY rank`,
          )
          .all(q) as { path: string; title: string; snippet: string; rank: number }[];
        return rows.map((r) => ({
          path: r.path,
          title: r.title,
          snippet: sanitizeSnippet(r.snippet),
          rank: r.rank,
        }));
      } catch {
        return [];
      }
    },

    upsert(path: string, prose: string, title: string): void {
      db.run("DELETE FROM fts_docs WHERE path = ?", [path]);
      db.run("INSERT INTO fts_docs(path, title, body) VALUES (?, ?, ?)", [path, title, prose]);
    },

    remove(path: string): void {
      db.run("DELETE FROM fts_docs WHERE path = ?", [path]);
    },
  };
}
