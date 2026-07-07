import { describe, expect, test } from "bun:test";
import { MAX_SPANS, type ParsedTrace, parseOtlp } from "../../src/client/render/parseOtlp.ts";

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
  events?: unknown[];
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
    events: opts.events ?? [],
  };
}

describe("parseOtlp", () => {
  test("nominal 2-service trace: parent+children, depths correct, services listed", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("frontend", [
          span({
            traceId: "t1",
            spanId: "root",
            name: "GET /checkout",
            startNs: "1000000000",
            endNs: "1050000000",
          }),
        ]),
        resourceSpan("backend", [
          span({
            traceId: "t1",
            spanId: "child",
            parentSpanId: "root",
            name: "db query",
            startNs: "1010000000",
            endNs: "1020000000",
          }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    expect(result.ok).toBe(true);
    expect(result.services).toEqual(["backend", "frontend"]);
    expect(result.traces).toHaveLength(1);

    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const trace = result.traces[0]!;
    expect(trace.traceId).toBe("t1");
    expect(trace.roots).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(trace.roots[0]!.id).toBe("root");
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(trace.roots[0]!.depth).toBe(0);
    expect(trace.spans).toHaveLength(2);

    // biome-ignore lint/style/noNonNullAssertion: find() must hit given fixture above
    const child = trace.spans.find((s) => s.id === "child")!;
    expect(child.depth).toBe(1);
    expect(child.parentId).toBe("root");
    expect(child.service).toBe("backend");

    // biome-ignore lint/style/noNonNullAssertion: find() must hit given fixture above
    const root = trace.spans.find((s) => s.id === "root")!;
    expect(root.service).toBe("frontend");
    expect(root.startMs).toBe(0);
    expect(root.durationMs).toBeCloseTo(50, 5);
    expect(child.startMs).toBeCloseTo(10, 5);
    expect(child.durationMs).toBeCloseTo(10, 5);
  });

  test("orphan parent (parentSpanId points to missing span) → becomes root", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({
            traceId: "t1",
            spanId: "orphan",
            parentSpanId: "does-not-exist",
            startNs: "1000000000",
            endNs: "1010000000",
          }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    expect(result.ok).toBe(true);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    const trace = result.traces[0]!;
    expect(trace.roots).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(trace.roots[0]!.id).toBe("orphan");
    // biome-ignore lint/style/noNonNullAssertion: length checked above
    expect(trace.roots[0]!.depth).toBe(0);
    // orphan is never dropped
    expect(trace.spans).toHaveLength(1);
  });

  test("ERROR status → hasError true, message kept", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({
            traceId: "t1",
            spanId: "s1",
            startNs: "1000000000",
            endNs: "1010000000",
            statusCode: 2,
            statusMessage: "boom",
          }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    // biome-ignore lint/style/noNonNullAssertion: fixture has exactly one trace/span
    const s = result.traces[0]!.spans[0]!;
    expect(s.hasError).toBe(true);
    expect(s.status.code).toBe(2);
    expect(s.status.message).toBe("boom");
  });

  test("empty payload (resourceSpans: []) → ok, zero traces, no throw", () => {
    const result = parseOtlp({ resourceSpans: [] }) as ParsedTrace;
    expect(result.ok).toBe(true);
    expect(result.traces).toHaveLength(0);
    expect(result.services).toHaveLength(0);
  });

  test("multi-traceId payload → multiple traces", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({ traceId: "t1", spanId: "a", startNs: "1000000000", endNs: "1010000000" }),
          span({ traceId: "t2", spanId: "b", startNs: "2000000000", endNs: "2010000000" }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    expect(result.traces).toHaveLength(2);
    expect(result.traces.map((t) => t.traceId).sort()).toEqual(["t1", "t2"]);
  });

  test("BigInt nano precision: startMs relative correct, no overflow/NaN", () => {
    // Nanosecond timestamps beyond Number.MAX_SAFE_INTEGER.
    const baseNs = "1700000000123456789";
    const laterNs = "1700000000133456789"; // +10_000_000ns = +10ms
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({ traceId: "t1", spanId: "a", startNs: baseNs, endNs: baseNs }),
          span({
            traceId: "t1",
            spanId: "b",
            startNs: laterNs,
            endNs: laterNs,
          }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    // biome-ignore lint/style/noNonNullAssertion: fixture has exactly one trace
    const trace = result.traces[0]!;
    // biome-ignore lint/style/noNonNullAssertion: find() must hit given fixture above
    const a = trace.spans.find((s) => s.id === "a")!;
    // biome-ignore lint/style/noNonNullAssertion: find() must hit given fixture above
    const b = trace.spans.find((s) => s.id === "b")!;
    expect(a.startMs).toBe(0);
    expect(Number.isNaN(b.startMs)).toBe(false);
    expect(b.startMs).toBeCloseTo(10, 5);
  });

  test("attribute unwrap: string/int/bool", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({
            traceId: "t1",
            spanId: "a",
            startNs: "1000000000",
            endNs: "1010000000",
            attributes: [
              { key: "http.method", value: { stringValue: "GET" } },
              { key: "http.status_code", value: { intValue: "200" } },
              { key: "retried", value: { boolValue: true } },
            ],
          }),
        ]),
      ],
    };

    const result = parseOtlp(payload) as ParsedTrace;
    // biome-ignore lint/style/noNonNullAssertion: fixture has exactly one trace/span
    const s = result.traces[0]!.spans[0]!;
    expect(s.attributes["http.method"]).toBe("GET");
    expect(s.attributes["http.status_code"]).toBe(200);
    expect(s.attributes.retried).toBe(true);
  });

  test("truncation marker when spans exceed MAX_SPANS", () => {
    const total = MAX_SPANS + 50;
    const spans = Array.from({ length: total }, (_, i) =>
      span({
        traceId: "t1",
        spanId: `s${i}`,
        startNs: String(1_000_000_000 + i * 1000),
        endNs: String(1_000_001_000 + i * 1000),
      }),
    );
    const payload = { resourceSpans: [resourceSpan("svc", spans)] };

    const result = parseOtlp(payload) as ParsedTrace;
    expect(result.ok).toBe(true);
    expect(result.truncated).toEqual({ shown: MAX_SPANS, total });
    const totalShown = result.traces.reduce((sum, t) => sum + t.spans.length, 0);
    expect(totalShown).toBe(MAX_SPANS);
  });

  test("malformed input: string 'notjson' → ParseFailure", () => {
    const result = parseOtlp("notjson");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });

  test("malformed input: null → ParseFailure", () => {
    const result = parseOtlp(null);
    expect(result.ok).toBe(false);
  });

  test("malformed input: number 42 → ParseFailure", () => {
    const result = parseOtlp(42);
    expect(result.ok).toBe(false);
  });

  test("malformed input: object without resourceSpans → ParseFailure", () => {
    const result = parseOtlp({ foo: "bar" });
    expect(result.ok).toBe(false);
  });

  test("valid JSON string input (raw JSON string of a good payload) parses ok", () => {
    const payload = {
      resourceSpans: [
        resourceSpan("svc", [
          span({ traceId: "t1", spanId: "a", startNs: "1000000000", endNs: "1010000000" }),
        ]),
      ],
    };
    const result = parseOtlp(JSON.stringify(payload)) as ParsedTrace;
    expect(result.ok).toBe(true);
    expect(result.traces).toHaveLength(1);
  });
});
