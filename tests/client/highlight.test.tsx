import { beforeAll, describe, expect, mock, test } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { act, render, waitFor } from "@testing-library/react";

// mock mermaid so Markdown component doesn't try to run real mermaid
mock.module("mermaid", () => ({
  default: {
    initialize: () => {},
    render: async (id: string, text: string) => ({
      svg: `<svg data-testid="mermaid-svg">${text}</svg>`,
    }),
  },
}));

import { Markdown } from "../../src/client/render/Markdown.tsx";
import { getHighlighter } from "../../src/client/render/highlight.ts";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("highlight pipeline", () => {
  // Pre-warm the shiki highlighter singleton so async effect resolves fast in render tests
  beforeAll(async () => {
    await getHighlighter();
  });

  test("shiki highlight produces classes", async () => {
    const hl = await getHighlighter();
    const html = hl.codeToHtml("const x = 1;", {
      lang: "typescript",
      theme: "github-light",
    });
    expect(html).toContain("class=");
  });

  test("mermaid fence does not go to shiki, routes to Mermaid component", async () => {
    const content = "```mermaid\ngraph TD; A-->B\n```";
    const { container } = render(
      <Wrapper>
        <Markdown content={content} />
      </Wrapper>,
    );
    // mermaid container should render
    const mermaidContainer = container.querySelector("[data-testid='mermaid-container']");
    expect(mermaidContainer).not.toBeNull();
    // shiki class should NOT appear inside mermaid output
    const shikiEl = container.querySelector(".shiki");
    expect(shikiEl).toBeNull();
  });

  test("non-mermaid fence routes to shiki and gets shiki class", async () => {
    const content = "```typescript\nconst x = 1;\n```";
    let container!: HTMLElement;
    await act(async () => {
      const result = render(
        <Wrapper>
          <Markdown content={content} />
        </Wrapper>,
      );
      container = result.container;
    });
    // Wait for async shiki plugin to load and re-render with highlighting
    // Highlighter is pre-warmed in beforeAll so this should resolve quickly
    await waitFor(
      () => {
        const shikiEl = container.querySelector(".shiki");
        expect(shikiEl).not.toBeNull();
      },
      { timeout: 3000 },
    );
    // mermaid component should NOT be rendered for ts fence
    const mermaidContainer = container.querySelector("[data-testid='mermaid-container']");
    expect(mermaidContainer).toBeNull();
  }, 10000);
});
