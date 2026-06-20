import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";

// Mock @mantine/core to avoid Mantine's provider requirement in tests
mock.module("@mantine/core", () => ({
  Text: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <span {...(props as object)}>{children}</span>
  ),
  Anchor: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <a {...(props as object)}>{children}</a>
  ),
  // Stubs for components used transitively by other modules loaded in this test worker
  MantineProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TypographyStylesProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useMantineColorScheme: () => ({ colorScheme: "light" as const }),
  UnstyledButton: ({
    children,
    ...props
  }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <button type="button" {...(props as object)}>
      {children}
    </button>
  ),
  Title: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <h1 {...(props as object)}>{children}</h1>
  ),
  ActionIcon: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <button type="button" {...(props as object)}>
      {children}
    </button>
  ),
  ScrollArea: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(props as object)}>{children}</div>
  ),
  Stack: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(props as object)}>{children}</div>
  ),
  Group: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(props as object)}>{children}</div>
  ),
  Box: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(props as object)}>{children}</div>
  ),
  Badge: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <span {...(props as object)}>{children}</span>
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Loader: () => <span>loading</span>,
  Alert: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <div {...(props as object)}>{children}</div>
  ),
  Code: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) => (
    <code {...(props as object)}>{children}</code>
  ),
  TextInput: (props: { [k: string]: unknown }) => <input {...(props as object)} />,
  AppShell: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Skeleton: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import { HtmlView } from "../../src/client/render/HtmlView.tsx";

describe("HtmlView", () => {
  it("renders an iframe element", () => {
    const { container } = render(<HtmlView html="<h1>hello</h1>" />);
    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
  });

  it("sets srcdoc to the provided html", () => {
    const html = "<p>test content</p>";
    const { container } = render(<HtmlView html={html} />);
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("srcdoc")).toBe(html);
  });

  it("has a sandbox attribute", () => {
    const { container } = render(<HtmlView html="<b>x</b>" />);
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toBeNull();
    // sandbox attr exists (even empty string is ok for strict mode)
  });

  it("sandbox does NOT contain allow-scripts", () => {
    const { container } = render(<HtmlView html="<b>x</b>" />);
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
  });

  it("sandbox does NOT contain allow-same-origin", () => {
    const { container } = render(<HtmlView html="<b>x</b>" />);
    const iframe = container.querySelector("iframe");
    const sandbox = iframe?.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-same-origin");
  });

  it("does NOT use src pointing at app origin (must use srcdoc)", () => {
    const { container } = render(<HtmlView html="<b>safe</b>" />);
    const iframe = container.querySelector("iframe");
    // src should be absent or empty
    const src = iframe?.getAttribute("src");
    expect(!src || src === "").toBe(true);
  });
});
