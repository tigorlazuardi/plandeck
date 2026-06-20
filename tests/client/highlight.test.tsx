import { describe, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// mock mermaid so Markdown component doesn't try to run real mermaid
mock.module("mermaid", () => ({
  default: {
    initialize: () => {},
    render: async (id: string, text: string) => ({
      svg: `<svg data-testid="mermaid-svg">${text}</svg>`,
    }),
  },
}));

import { getHighlighter } from "../../src/client/render/highlight.ts";
import { Markdown } from "../../src/client/render/Markdown.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("highlight pipeline", () => {
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
});
