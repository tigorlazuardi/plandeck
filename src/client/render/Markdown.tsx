import { TypographyStylesProvider, useMantineColorScheme } from "@mantine/core";
import { useEffect, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { Mermaid } from "./Mermaid.tsx";
import { getRehypeShikiPlugin } from "./highlight.ts";

interface MarkdownProps {
  content: string;
}

const components: Components = {
  pre({ children, ...rest }) {
    // Check if child is a code element with language-mermaid class
    if (
      children &&
      typeof children === "object" &&
      "props" in children &&
      children.props &&
      typeof children.props === "object" &&
      "className" in children.props &&
      typeof children.props.className === "string" &&
      children.props.className.includes("language-mermaid")
    ) {
      const code =
        "children" in children.props && typeof children.props.children === "string"
          ? children.props.children
          : "";
      return <Mermaid code={code} />;
    }
    // Pass through all props (including className from shiki) to the pre element
    return <pre {...rest}>{children}</pre>;
  },
};

export function Markdown({ content }: MarkdownProps) {
  const { colorScheme } = useMantineColorScheme();
  const [rehypePlugins, setRehypePlugins] = useState<PluggableList>([]);

  useEffect(() => {
    let cancelled = false;
    getRehypeShikiPlugin(colorScheme)
      .then((plugin) => {
        if (!cancelled) {
          setRehypePlugins([plugin]);
        }
      })
      .catch(() => {
        // if shiki fails to load, fall back to no highlighting
      });
    return () => {
      cancelled = true;
    };
  }, [colorScheme]);

  return (
    <TypographyStylesProvider>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </TypographyStylesProvider>
  );
}
