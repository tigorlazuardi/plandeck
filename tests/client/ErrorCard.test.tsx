import { describe, expect, it, mock } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorCard } from "../../src/client/shell/ErrorCard.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

describe("ErrorCard", () => {
  it("renders title", () => {
    render(
      <Wrapper>
        <ErrorCard title="Something went wrong" />
      </Wrapper>,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("renders detail when provided", () => {
    render(
      <Wrapper>
        <ErrorCard title="Error" detail="This document may have been deleted." />
      </Wrapper>,
    );
    expect(screen.getByText("This document may have been deleted.")).toBeTruthy();
  });

  it("does not render detail when omitted", () => {
    const { queryByText } = render(
      <Wrapper>
        <ErrorCard title="Error" />
      </Wrapper>,
    );
    expect(queryByText("This document may have been deleted.")).toBeNull();
  });

  it("renders action button when action with onClick provided", () => {
    const onClick = mock(() => {});
    render(
      <Wrapper>
        <ErrorCard title="Error" action={{ label: "Retry", onClick }} />
      </Wrapper>,
    );
    const btn = screen.getByText("Retry");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("action with href renders as anchor", () => {
    render(
      <Wrapper>
        <ErrorCard title="Error" action={{ label: "Open raw", href: "/api/raw/file.png" }} />
      </Wrapper>,
    );
    const anchor = screen.getByRole("link", { name: "Open raw" });
    expect(anchor).toBeTruthy();
    expect((anchor as HTMLAnchorElement).href).toContain("/api/raw/file.png");
  });
});
