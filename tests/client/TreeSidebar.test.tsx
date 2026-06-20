import { beforeEach, describe, expect, it, mock } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TreeSidebar } from "../../src/client/shell/TreeSidebar.tsx";

// Mock the api module
mock.module("../../src/client/api.ts", () => ({
  useTree: () => ({
    data: {
      root: "/docs",
      title: "Test Docs",
      tree: [
        {
          name: "foo.md",
          path: "foo.md",
          type: "file",
          kind: "md",
        },
        {
          name: "bar.md",
          path: "bar.md",
          type: "file",
          kind: "md",
        },
        {
          name: "subdir",
          path: "subdir",
          type: "dir",
          children: [
            {
              name: "foobar.md",
              path: "subdir/foobar.md",
              type: "file",
              kind: "md",
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  fetchTree: () => Promise.resolve({ root: "/", title: "Test", tree: [] }),
  fetchDoc: () => Promise.resolve({ path: "", kind: "md" }),
  useDoc: () => ({ data: undefined, isLoading: false, isError: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>
  );
}

describe("TreeSidebar", () => {
  it("renders tree items from mock data", async () => {
    await act(async () => {
      render(
        <Wrapper>
          <TreeSidebar />
        </Wrapper>,
      );
    });
    expect(screen.getByText("foo.md")).toBeTruthy();
    expect(screen.getByText("bar.md")).toBeTruthy();
  });

  it("filter narrows results - type foo shows only foo nodes", async () => {
    await act(async () => {
      render(
        <Wrapper>
          <TreeSidebar />
        </Wrapper>,
      );
    });

    const filterInput = screen.getByPlaceholderText("Filter files...");
    await act(async () => {
      await userEvent.type(filterInput, "foo");
    });

    // foo.md should be visible
    expect(screen.getByText("foo.md")).toBeTruthy();
    // bar.md should NOT be visible
    expect(screen.queryByText("bar.md")).toBeNull();
  });
});
