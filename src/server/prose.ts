import { toString as mdastToString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

// Remove raw HTML nodes from mdast to prevent XSS via snippet
function stripHtmlNodes(node: { type: string; children?: unknown[] }): void {
  if (node.children) {
    node.children = node.children.filter((c: unknown) => {
      const child = c as { type: string; children?: unknown[] };
      if (child.type === "html") return false;
      stripHtmlNodes(child);
      return true;
    });
  }
}

export async function toProse(text: string, kind: "md" | "mdx" | "txt"): Promise<string> {
  if (kind === "txt") {
    return text;
  }

  // Build the pipeline — use 'as any' to avoid complex unified generic inference issues
  // biome-ignore lint/suspicious/noExplicitAny: unified pipeline generics are complex
  let pipeline: any = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"]);

  if (kind === "mdx") {
    pipeline = pipeline.use(remarkMdx);
  }

  const tree = pipeline.parse(text);

  // Strip frontmatter nodes so their content doesn't appear in prose
  if (tree.children) {
    tree.children = tree.children.filter(
      // biome-ignore lint/suspicious/noExplicitAny: node type is a string we compare
      (node: any) => node.type !== "yaml" && node.type !== "toml",
    );
  }

  // Remove raw HTML nodes from mdast to prevent XSS via FTS5 snippet
  stripHtmlNodes(tree);

  const prose = mdastToString(tree);

  // Collapse multiple whitespace/newlines to single space, trim
  return prose.replace(/\s+/g, " ").trim();
}
