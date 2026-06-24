import { useMantineColorScheme } from "@mantine/core";
import { evaluate } from "@mdx-js/mdx";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import { AlertCircle } from "lucide-react";
import type React from "react";
import { Component, useEffect, useState } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { components } from "../blocks/index.ts";
import { ErrorCard } from "../shell/ErrorCard.tsx";
import { Mermaid } from "./Mermaid.tsx";
import { getRehypeShikiPlugin } from "./highlight.ts";

interface ParseErrorCardProps {
  error: Error;
  path?: string;
}

// MDX treats every `{...}` in content as a JavaScript expression — even inside
// raw <pre>/<code> JSX — so literal braces (logs, JSON, Pydantic reprs) make
// acorn fail to parse. Surface a concrete fix when that's the likely cause.
export function bracesHint(message: string): string | null {
  if (/acorn|parse expression|Unexpected character|expression/i.test(message)) {
    return (
      "This usually means the document has literal { or } that MDX tried to read as a " +
      "JavaScript expression. Put such content (logs, JSON, code) in a fenced code block " +
      "(```), or escape the braces as \\{ and \\}."
    );
  }
  return null;
}

function ParseErrorCard({ error, path }: ParseErrorCardProps) {
  const hint = bracesHint(error.message);
  return (
    <div data-testid="parse-error-card">
      <ErrorCard icon={<AlertCircle size={16} />} title="MDX Parse Error" detail={error.message} />
      {hint && (
        <div data-testid="parse-error-hint" style={{ fontSize: 13, marginTop: 8 }}>
          {hint}
        </div>
      )}
      {path && <div style={{ fontSize: 12, marginTop: 4, fontFamily: "monospace" }}>{path}</div>}
    </div>
  );
}

interface MdxErrorBoundaryProps {
  path?: string;
  children: React.ReactNode;
}

interface MdxErrorBoundaryState {
  error: Error | null;
}

class MdxErrorBoundary extends Component<MdxErrorBoundaryProps, MdxErrorBoundaryState> {
  constructor(props: MdxErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): MdxErrorBoundaryState {
    return { error };
  }

  override render() {
    if (this.state.error) {
      const pathProp = this.props.path !== undefined ? { path: this.props.path } : {};
      return <ParseErrorCard error={this.state.error} {...pathProp} />;
    }
    return this.props.children;
  }
}

interface MdxProps {
  content: string;
  path?: string;
}

export function Mdx({ content, path }: MdxProps) {
  const { colorScheme } = useMantineColorScheme();
  const [MdxComponent, setMdxComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMdxComponent(null);
    setError(null);

    getRehypeShikiPlugin(colorScheme)
      .then((shikiPlugin) => {
        if (cancelled) return;
        return evaluate(content, {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [shikiPlugin],
          ...(runtime as Parameters<typeof evaluate>[1]),
          useMDXComponents,
        });
      })
      .then((mod) => {
        if (cancelled || !mod) return;
        const C = mod.default;
        setMdxComponent(() => C);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
    };
  }, [content, colorScheme]);

  const pathProp = path !== undefined ? { path } : {};

  if (error) {
    return <ParseErrorCard error={error} {...pathProp} />;
  }

  if (!MdxComponent) {
    return <div data-testid="mdx-loading">Loading…</div>;
  }

  const mdxComponents = {
    ...components,
    pre(props: React.ComponentPropsWithoutRef<"pre">) {
      const { children } = props;
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
      return <pre {...props} />;
    },
  };

  return (
    <MdxErrorBoundary {...pathProp}>
      <MDXProvider components={mdxComponents}>
        <MdxComponent />
      </MDXProvider>
    </MdxErrorBoundary>
  );
}
