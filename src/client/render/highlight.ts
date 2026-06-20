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
    ],
  });
  return _highlighter;
}

export function rehypeShikiOptions(colorScheme: "light" | "dark" | "auto") {
  const theme = colorScheme === "dark" ? "github-dark" : "github-light";
  return { theme } as const;
}

export function getMermaidLangs(): string[] {
  return ["mermaid"];
}

export async function getRehypeShikiPlugin(colorScheme: "light" | "dark" | "auto") {
  const hl = await getHighlighter();
  const opts = rehypeShikiOptions(colorScheme);
  return () => rehypeShikiFromHighlighter(hl, opts);
}
