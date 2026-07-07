import { describe, expect, test } from "bun:test";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TraceWaterfall } from "../../src/client/render/TraceWaterfall.tsx";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider>{children}</MantineProvider>;
}

function strAttr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function resourceSpan(service: string, scopeSpans: unknown[]) {
  return {
    resource: { attributes: [strAttr("service.name", service)] },
    scopeSpans: [{ spans: scopeSpans }],
  };
}

function span(opts: {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name?: string;
  startNs: string;
  endNs: string;
  statusCode?: number;
  statusMessage?: string;
  attributes?: { key: string; value: unknown }[];
}) {
  return {
    traceId: opts.traceId,
    spanId: opts.spanId,
    ...(opts.parentSpanId !== undefined ? { parentSpanId: opts.parentSpanId } : {}),
    name: opts.name ?? "span",
    startTimeUnixNano: opts.startNs,
    endTimeUnixNano: opts.endNs,
    status: {
      code: opts.statusCode ?? 0,
      ...(opts.statusMessage !== undefined ? { message: opts.statusMessage } : {}),
    },
    attributes: opts.attributes ?? [],
    events: [],
  };
}

function twoServiceTracePayload() {
  return {
    resourceSpans: [
      resourceSpan("frontend", [
        span({
          traceId: "t1",
          spanId: "root",
          name: "GET /checkout",
          startNs: "1000000000",
          endNs: "1210000000",
          attributes: [strAttr("api_key", "sk-super-secret"), strAttr("http.method", "GET")],
        }),
      ]),
      resourceSpan("backend", [
        span({
          traceId: "t1",
          spanId: "child",
          parentSpanId: "root",
          name: "db.query",
          startNs: "1050000000",
          endNs: "1150000000",
          statusCode: 2,
          statusMessage: "boom",
        }),
      ]),
    ],
  };
}

describe("TraceWaterfall", () => {
  test("renders bars for each span and a legend with both services", () => {
    const source = JSON.stringify(twoServiceTracePayload());
    render(
      <Wrapper>
        <TraceWaterfall source={source} />
      </Wrapper>,
    );

    expect(screen.getByTestId("span-bar-root")).toBeTruthy();
    expect(screen.getByTestId("span-bar-child")).toBeTruthy();

    const legend = screen.getByTestId("service-legend");
    expect(within(legend).getByText("frontend")).toBeTruthy();
    expect(within(legend).getByText("backend")).toBeTruthy();
  });

  test("ERROR span row is flagged via data-error, not by matching a hex color", () => {
    const source = JSON.stringify(twoServiceTracePayload());
    render(
      <Wrapper>
        <TraceWaterfall source={source} />
      </Wrapper>,
    );

    const errorRow = screen.getByTestId("span-row-child");
    expect(errorRow.getAttribute("data-error")).toBe("true");

    const okRow = screen.getByTestId("span-row-root");
    expect(okRow.getAttribute("data-error")).toBeNull();
  });

  test("clicking a span opens the detail panel with its attributes", async () => {
    const source = JSON.stringify(twoServiceTracePayload());
    render(
      <Wrapper>
        <TraceWaterfall source={source} />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("span-row-child"));

    await waitFor(() => {
      expect(screen.getByText("db.query")).toBeTruthy();
    });
    expect(screen.getByText(/boom/)).toBeTruthy();
  });

  test("sensitive attribute key shows <redacted>, not the secret value", async () => {
    const source = JSON.stringify(twoServiceTracePayload());
    render(
      <Wrapper>
        <TraceWaterfall source={source} />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId("span-row-root"));

    const valueCell = await waitFor(() => screen.getByTestId("attr-value-api_key"));
    expect(valueCell.textContent).toBe("<redacted>");
    expect(screen.queryByText("sk-super-secret")).toBeNull();
  });

  test("malformed source renders ErrorCard with the parse message", () => {
    render(
      <Wrapper>
        <TraceWaterfall source="{not json" />
      </Wrapper>,
    );

    const card = screen.getByTestId("error-card");
    expect(within(card).getByText("Invalid trace")).toBeTruthy();
  });

  test("empty trace (0 spans) shows an explicit empty-state", () => {
    const source = JSON.stringify({ resourceSpans: [] });
    render(
      <Wrapper>
        <TraceWaterfall source={source} />
      </Wrapper>,
    );

    const card = screen.getByTestId("error-card");
    expect(within(card).getByText("No spans in this trace")).toBeTruthy();
  });
});
