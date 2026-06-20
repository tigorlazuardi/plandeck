import { evaluate } from "@mdx-js/mdx";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import type React from "react";
import { Component, useEffect, useState } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { components } from "../blocks/index.ts";

interface ParseErrorCardProps {
  error: Error;
  path?: string;
}

function ParseErrorCard({ error, path }: ParseErrorCardProps) {
  return (
    <div
      data-testid="parse-error-card"
      style={{
        border: "1px solid #fa5252",
        borderRadius: "6px",
        padding: "16px",
        background: "#fff5f5",
        color: "#e03131",
        fontFamily: "monospace",
      }}
    >
      <strong>MDX Parse Error</strong>
      {path && <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>{path}</div>}
      <pre
        style={{
          marginTop: "8px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "13px",
        }}
      >
        {error.message}
      </pre>
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
  const [MdxComponent, setMdxComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setMdxComponent(null);
    setError(null);

    evaluate(content, {
      remarkPlugins: [remarkGfm],
      ...(runtime as Parameters<typeof evaluate>[1]),
      useMDXComponents,
    })
      .then(({ default: C }) => {
        setMdxComponent(() => C as React.ComponentType);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [content]);

  const pathProp = path !== undefined ? { path } : {};

  if (error) {
    return <ParseErrorCard error={error} {...pathProp} />;
  }

  if (!MdxComponent) {
    return <div data-testid="mdx-loading">Loading…</div>;
  }

  return (
    <MdxErrorBoundary {...pathProp}>
      <MDXProvider components={components}>
        <MdxComponent />
      </MDXProvider>
    </MdxErrorBoundary>
  );
}
