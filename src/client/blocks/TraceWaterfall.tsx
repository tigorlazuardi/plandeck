import React from "react";
import { TraceWaterfall as TraceWaterfallView } from "../render/TraceWaterfall.tsx";

interface TraceWaterfallBlockProps {
  children?: React.ReactNode;
}

// The fenced-code child arrives AFTER rehype-shiki has run over the whole MDX
// tree (Mdx.tsx applies it globally), so the code content is a tree of
// highlighted <span> tokens — NOT a plain string. Recursively collect every text
// leaf in DFS order to reconstruct the original source text exactly. Also handles
// the plain <pre><code>string</code></pre> subtree (unit tests, non-shiki paths).
function collectText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (React.isValidElement(node)) {
    return collectText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

export function TraceWaterfall({ children }: TraceWaterfallBlockProps) {
  const source = collectText(children);
  return <TraceWaterfallView source={source} />;
}
