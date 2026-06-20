import { TypographyStylesProvider } from "@mantine/core";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid.tsx";

interface MarkdownProps {
  content: string;
}

const components: Components = {
  pre({ children }) {
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
    return <pre>{children}</pre>;
  },
};

export function Markdown({ content }: MarkdownProps) {
  return (
    <TypographyStylesProvider>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </TypographyStylesProvider>
  );
}
