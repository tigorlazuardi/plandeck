// src/shared/types.ts
export type DocKind = "mdx" | "md" | "txt" | "html" | "pdf" | "image";

export interface TreeNode {
  name: string; // basename
  path: string; // relpath from root, '/'-normalized
  type: "dir" | "file";
  kind?: DocKind; // present for files
  children?: TreeNode[]; // present for dirs
}

export interface Frontmatter {
  title?: string;
  brief?: string;
  [key: string]: unknown; // extra keys ignored
}

export interface DocResponse {
  path: string;
  kind: DocKind;
  frontmatter?: Frontmatter; // mdx | md
  content?: string; // text for mdx|md|txt; raw html for html
  tooLarge?: boolean; // over size cap
  undecodable?: boolean; // text ext failed utf-8 decode
}

export interface SearchHit {
  path: string;
  title: string; // frontmatter.title || basename
  snippet: string; // sanitized excerpt, <mark> around matches
  rank: number; // bm25 (lower = better)
}

export interface TreeResponse {
  root: string;
  title: string;
  tree: TreeNode[];
}
export interface SearchResponse {
  hits: SearchHit[];
}

export type FsEvent =
  | { type: "add" | "change" | "unlink"; path: string; kind?: DocKind }
  | { type: "ready" };

export interface ResolvedConfig {
  root: string;
  port: number;
  host: string;
  title: string;
  open: boolean;
  include: string[];
  exclude: string[];
  textFiles: string[];
  nonTextFiles: string[];
  maxFileBytes: number;
}
