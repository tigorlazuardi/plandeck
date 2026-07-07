import { describe, expect, it, mock } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DocView } from "../../src/client/render/DocView.tsx";

function strAttr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function traceSource() {
  return JSON.stringify({
    resourceSpans: [
      {
        resource: { attributes: [strAttr("service.name", "frontend")] },
        scopeSpans: [
          {
            spans: [
              {
                traceId: "t1",
                spanId: "root",
                name: "GET /checkout",
                startTimeUnixNano: "1000000000",
                endTimeUnixNano: "1210000000",
                status: { code: 0 },
                attributes: [],
                events: [],
              },
            ],
          },
        ],
      },
    ],
  });
}

const MOCK_DOC = {
  data: { path: "trace/foo.trace.json", kind: "trace", content: traceSource() },
  isLoading: false,
  isError: false,
} as const;

mock.module("../../src/client/api.ts", () => ({
  useTree: () => ({ data: undefined, isLoading: false, isError: false }),
  fetchTree: () => Promise.resolve({ root: "/", title: "Test", tree: [] }),
  fetchDoc: () => Promise.resolve({ path: "", kind: "md" }),
  useDoc: () => MOCK_DOC,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </MantineProvider>
  );
}

describe("DocView - trace kind", () => {
  it("renders the TraceWaterfall for kind 'trace'", () => {
    render(
      <Wrapper>
        <DocView path="trace/foo.trace.json" />
      </Wrapper>,
    );

    expect(screen.getByTestId("service-legend")).toBeTruthy();
    expect(screen.getByTestId("span-bar-root")).toBeTruthy();
  });
});
