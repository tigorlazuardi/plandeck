import { describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";

// mock mermaid BEFORE importing component
mock.module("mermaid", () => ({
  default: {
    initialize: () => {},
    render: async (id: string, text: string) => {
      if (text.includes("BADINPUT")) throw new Error("Parse error");
      return { svg: `<svg data-testid="mermaid-svg">${text}</svg>` };
    },
  },
}));

import { Mermaid } from "../../src/client/render/Mermaid.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("Mermaid", () => {
  test("renders diagram container", async () => {
    const { container } = render(
      <Wrapper>
        <Mermaid code="graph TD; A-->B" />
      </Wrapper>,
    );
    // container div always renders immediately
    const div = container.querySelector("[data-testid='mermaid-container']");
    expect(div).not.toBeNull();
  });

  test("bad diagram shows error notice", async () => {
    render(
      <Wrapper>
        <Mermaid code="BADINPUT" />
      </Wrapper>,
    );
    await waitFor(() => {
      const errorEl = screen.getByTestId("mermaid-error");
      expect(errorEl).not.toBeNull();
    });
  });
});
