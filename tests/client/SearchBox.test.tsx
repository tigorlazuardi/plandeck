import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SearchBox } from "../../src/client/shell/SearchBox.tsx";

// Mock react-router-dom navigate
const mockNavigate = mock(() => {});
mock.module("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  MemoryRouter: ({ children }: { children: React.ReactNode }) => children,
}));

const mockHits = [
  {
    path: "docs/intro.md",
    title: "Introduction",
    snippet: "This is an <mark>intro</mark> page.",
    rank: -1.5,
  },
  {
    path: "docs/guide.md",
    title: "Guide",
    snippet: "A helpful <mark>intro</mark> guide.",
    rank: -0.8,
  },
];

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function setFetch(fn: () => Promise<Partial<Response>>) {
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe("SearchBox", () => {
  it("renders an input element", async () => {
    setFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hits: [] }),
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <SearchBox />
        </Wrapper>,
      );
    });
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
  });

  it("typing a query calls /api/search?q=", async () => {
    const fetchMock = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hits: mockHits }),
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await act(async () => {
      render(
        <Wrapper>
          <SearchBox />
        </Wrapper>,
      );
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "intro" } });
      // Wait for debounce
      await new Promise((r) => setTimeout(r, 350));
    });

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = (fetchMock.mock.calls[0] as string[])[0];
    expect(calledUrl).toContain("/api/search?q=");
    expect(calledUrl).toContain("intro");
  });

  it("shows returned hit titles and snippets", async () => {
    setFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hits: mockHits }),
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <SearchBox />
        </Wrapper>,
      );
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "intro" } });
      await new Promise((r) => setTimeout(r, 350));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText("Introduction")).toBeTruthy();
    expect(screen.getByText("Guide")).toBeTruthy();
  });

  it("clicking a hit navigates to /doc/<path>", async () => {
    setFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hits: mockHits }),
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <SearchBox />
        </Wrapper>,
      );
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "intro" } });
      await new Promise((r) => setTimeout(r, 350));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const hitTitle = screen.getByText("Introduction");
    await act(async () => {
      fireEvent.click(hitTitle.closest("[data-hit]") ?? hitTitle);
    });

    expect(mockNavigate).toHaveBeenCalledWith("/doc/docs/intro.md");
  });

  it("shows 'No results' when hits array is empty and q non-empty", async () => {
    setFetch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ hits: [] }),
      }),
    );

    await act(async () => {
      render(
        <Wrapper>
          <SearchBox />
        </Wrapper>,
      );
    });

    const input = screen.getByRole("textbox");
    await act(async () => {
      fireEvent.change(input, { target: { value: "noresults" } });
      await new Promise((r) => setTimeout(r, 350));
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText(/No matches for/)).toBeTruthy();
  });
});
