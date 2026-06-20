import { describe, expect, it } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { Markdown } from "../../src/client/render/Markdown.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("Markdown", () => {
  it("renders a GFM table", () => {
    const content = "| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(
      <Wrapper>
        <Markdown content={content} />
      </Wrapper>,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
  });

  it("renders a task list with checkboxes", () => {
    const content = "- [x] done\n- [ ] todo";
    const { container } = render(
      <Wrapper>
        <Markdown content={content} />
      </Wrapper>,
    );
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });
});
