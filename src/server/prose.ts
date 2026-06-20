import { toString as mdastToString } from "mdast-util-to-string";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

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

  const prose = mdastToString(tree);

  // Collapse multiple whitespace/newlines to single space, trim
  return prose.replace(/\s+/g, " ").trim();
}
