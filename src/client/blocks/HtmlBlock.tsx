import React from "react";

interface HtmlBlockProps {
  height?: string;
  children?: React.ReactNode;
}

function extractHtml(children: React.ReactNode): string {
  // Children from MDX: <pre><code>html string</code></pre>
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

export function HtmlBlock({ height = "200px", children }: HtmlBlockProps) {
  const htmlString = extractHtml(children);

  return (
    <iframe
      srcDoc={htmlString}
      sandbox=""
      style={{
        width: "100%",
        height,
        border: "1px solid #dee2e6",
        borderRadius: "4px",
      }}
      title="html-preview"
    />
  );
}
