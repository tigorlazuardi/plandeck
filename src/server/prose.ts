import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import { toString } from "mdast-util-to-string";

export async function toProse(text: string, kind: "md" | "mdx" | "txt"): Promise<string> {
  if (kind === "txt") {
    return text;
  }

  let pipeline = unified().use(remarkParse).use(remarkFrontmatter, ["yaml", "toml"]);

  if (kind === "mdx") {
    pipeline = pipeline.use(remarkMdx);
  }

  const tree = pipeline.parse(text);

  // Strip frontmatter nodes so their content doesn't appear in prose
  if (tree.children) {
    tree.children = tree.children.filter(
      (node) => node.type !== "yaml" && node.type !== "toml",
    );
  }

  const prose = toString(tree);

  // Collapse multiple whitespace/newlines to single space, trim
  return prose.replace(/\s+/g, " ").trim();
}
