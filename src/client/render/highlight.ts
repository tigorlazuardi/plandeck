import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { type Highlighter, createHighlighter } from "shiki";

let _highlighter: Highlighter | null = null;

export async function getHighlighter(): Promise<Highlighter> {
  if (_highlighter) return _highlighter;
  _highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [
      "typescript",
      "javascript",
      "tsx",
      "jsx",
      "json",
      "bash",
      "sh",
      "css",
      "html",
      "markdown",
      "mdx",
      "python",
      "yaml",
      "go",
      "sql",
      "log",
    ],
  });
  return _highlighter;
}

// Aliases for languages Shiki has no grammar for. Map them to the closest
// loaded grammar so fenced blocks still get highlighted instead of silent-plain.
// logql (Loki) has no Shiki grammar — "log" gives sensible log-line coloring.
const LANG_ALIASES: Record<string, string> = {
  logql: "log",
  promql: "log",
  logfmt: "log",
  golang: "go",
};

export function rehypeShikiOptions(colorScheme: "light" | "dark" | "auto") {
  const theme = colorScheme === "dark" ? "github-dark" : "github-light";
  // onError: silently leave unknown/unloaded languages (e.g. mermaid) as plain pre/code
  return { theme, langAlias: LANG_ALIASES, onError: () => {} } as const;
}

export function getMermaidLangs(): string[] {
  return ["mermaid"];
}

export async function getRehypeShikiPlugin(colorScheme: "light" | "dark" | "auto") {
  const hl = await getHighlighter();
  const opts = rehypeShikiOptions(colorScheme);
  return () => rehypeShikiFromHighlighter(hl, opts);
}
