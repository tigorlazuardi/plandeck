import React from "react";
import { TraceWaterfall as TraceWaterfallView } from "../render/TraceWaterfall.tsx";

interface TraceWaterfallBlockProps {
  children?: React.ReactNode;
}

function extractSource(children: React.ReactNode): string {
  // Children from MDX: <pre><code>json string</code></pre>
  const child = React.Children.toArray(children)[0];
  if (!React.isValidElement(child)) return "";

  // pre element
  const pre = child as React.ReactElement<{ children?: React.ReactNode }>;
  const preChildren = React.Children.toArray(pre.props.children);
  const codeEl = preChildren[0];

  if (!React.isValidElement(codeEl)) {
    // maybe children is directly the string
    return String(pre.props.children ?? "");
  }

  const code = codeEl as React.ReactElement<{ children?: React.ReactNode }>;
  const content = code.props.children;
  if (typeof content === "string") return content;
  return String(content ?? "");
}

export function TraceWaterfall({ children }: TraceWaterfallBlockProps) {
  const source = extractSource(children);
  return <TraceWaterfallView source={source} />;
}
