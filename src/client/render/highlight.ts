import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { ShikiTransformer } from "shiki";
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

/**
 * Parsed code-fence meta. All fields optional; defaults applied in transformer.
 * title          – filename to show in a header bar above the code box
 * showLineNumbers – whether to show line numbers (default: true)
 * startLine      – first line number (default: 1)
 */
export interface CodeMeta {
  title?: string;
  showLineNumbers?: boolean;
  startLine?: number;
}

/**
 * Parse the raw meta string from a fenced code block.
 *
 * Supported syntax (order-independent, may be combined):
 *   title="server.ts"
 *   title='server.ts'
 *   showLineNumbers=false   (any value other than "false" → true)
 *   startLine=42
 *
 * Defaults (when key is absent):
 *   showLineNumbers → true
 *   startLine       → 1
 *   title           → undefined (no header rendered)
 */
export function parseMetaString(meta: string): CodeMeta {
  const result: CodeMeta = {};

  // title="..." or title='...'
  const titleMatch = meta.match(/\btitle=["']([^"']*)["']/);
  if (titleMatch?.[1] !== undefined) {
    result.title = titleMatch[1];
  }

  // showLineNumbers=false (explicit opt-out); presence alone (no =false) means true
  const lnMatch = meta.match(/\bshowLineNumbers(?:=([\w]+))?/);
  if (lnMatch) {
    result.showLineNumbers = lnMatch[1] !== "false";
  }

  // startLine=N
  const slMatch = meta.match(/\bstartLine=(\d+)/);
  if (slMatch) {
    const n = Number.parseInt(slMatch[1] ?? "1", 10);
    result.startLine = Number.isNaN(n) ? 1 : n;
  }

  return result;
}

/** Strip `background-color` / `background` from a hast node's inline style, preserving other rules. */
function stripBgStyle(style: string): string | undefined {
  const cleaned = style
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s !== "" && !s.startsWith("background-color") && !s.startsWith("background:"))
    .join(";");
  return cleaned || undefined;
}

/**
 * Shiki transformer that:
 * 1. Removes inline `background-color` from <pre>, <code>, and every token <span>
 *    (Shiki emits it only on <pre>, but third-party styles can leak in; belt+suspenders).
 * 2. Copies CodeMeta values as data-* attributes onto <pre> so React components
 *    and CSS can read them.
 * 3. Applies the --shiki-start CSS custom property for line-number counters.
 * 4. Sets data-line-numbers="true" by default (unless explicitly false in meta).
 */
const codeMetaTransformer: ShikiTransformer = {
  name: "plandeck:code-meta",
  // Strip bg from every token <span> (covers any theme that emits per-token backgrounds).
  span(node) {
    if (typeof node.properties.style === "string") {
      node.properties.style = stripBgStyle(node.properties.style);
    }
  },
  // Strip bg from the <code> wrapper.
  // Also remove the literal "\n" text nodes that Shiki emits between every
  // <span class="line"> element — but ONLY when line numbers are enabled
  // (data-line-numbers="true"). In that path, .line is display:block and each
  // interstitial "\n" text node (under white-space:pre) renders as its own
  // blank line-box, doubling the row pitch. Block elements provide their own
  // line breaks, so the text nodes are safe to drop.
  //
  // When line numbers are DISABLED, .line is display:inline and the "\n" text
  // nodes are what separates consecutive lines — removing them would join all
  // lines into one. Leave children untouched in that case.
  //
  // Empty .line elements still occupy one row via min-height:1lh in CSS.
  code(node) {
    if (typeof node.properties.style === "string") {
      node.properties.style = stripBgStyle(node.properties.style);
    }
    const meta = (this.options.meta ?? {}) as CodeMeta & { __raw?: string };
    const showLN = meta.showLineNumbers !== false;
    if (showLN) {
      node.children = node.children.filter(
        (child) => !(child.type === "text" && /^\n+$/.test(child.value as string)),
      );
    }
  },
  pre(node) {
    // Strip Shiki's inline background-color from style (replaced by CSS).
    if (typeof node.properties.style === "string") {
      node.properties.style = stripBgStyle(node.properties.style);
    }

    // Read parsed meta (set by parseMetaString via rehype-shiki options).
    const meta = (this.options.meta ?? {}) as CodeMeta & { __raw?: string };

    // Title
    if (meta.title) {
      node.properties["data-title"] = meta.title;
    }

    // Line numbers: default ON unless meta explicitly says false.
    const showLN = meta.showLineNumbers !== false;
    node.properties["data-line-numbers"] = showLN ? "true" : "false";

    // Start line: default 1.
    const startLine = meta.startLine ?? 1;
    if (showLN) {
      // Inject CSS custom property so the counter offset works.
      const existingStyle = typeof node.properties.style === "string" ? node.properties.style : "";
      const sep = existingStyle ? ";" : "";
      node.properties.style = `${existingStyle}${sep}--shiki-start:${startLine}`;
    }
  },
};

export function rehypeShikiOptions(colorScheme: "light" | "dark" | "auto") {
  const theme = colorScheme === "dark" ? "github-dark" : "github-light";
  // parseMetaString: called by rehype-shiki; result spread into codeToHast meta.
  // onError: silently leave unknown/unloaded languages (e.g. mermaid) as plain pre/code.
  return {
    theme,
    langAlias: LANG_ALIASES,
    onError: () => {},
    parseMetaString,
    transformers: [codeMetaTransformer] as ShikiTransformer[],
  } as const;
}

export function getMermaidLangs(): string[] {
  return ["mermaid"];
}

export async function getRehypeShikiPlugin(colorScheme: "light" | "dark" | "auto") {
  const hl = await getHighlighter();
  const opts = rehypeShikiOptions(colorScheme);
  return () => rehypeShikiFromHighlighter(hl, opts);
}
