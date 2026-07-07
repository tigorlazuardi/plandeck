/**
 * Pure OTLP (OpenTelemetry Protocol) JSON trace parser + view-model.
 *
 * Walks the standard OTLP export shape (`resourceSpans[].scopeSpans[].spans[]`),
 * normalizes nanosecond string timestamps via BigInt into trace-relative ms
 * offsets, links parent/child spans (orphans surfaced as roots, never dropped),
 * and groups the result by `traceId`. Never throws — structural problems return
 * a typed `ParseFailure` for the caller to render as an error card.
 *
 * No React / server / rendering concerns belong in this file.
 */

/** Span cap: if a payload exceeds this many spans (across all traces), keep the
 * first `MAX_SPANS` (by start order) and report a `truncated` marker. */
export const MAX_SPANS = 2000;

export interface TraceEvent {
  name: string;
  timeMs: number;
  attributes: Record<string, string | number | boolean>;
}

export interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  service: string;
  startMs: number;
  durationMs: number;
  status: {
    code: number;
    message?: string;
  };
  attributes: Record<string, string | number | boolean>;
  events: TraceEvent[];
  depth: number;
  hasError: boolean;
}

export interface ParsedTraceGroup {
  traceId: string;
  roots: TraceSpan[];
  spans: TraceSpan[];
  durationMs: number;
}

export interface ParsedTrace {
  ok: true;
  traces: ParsedTraceGroup[];
  services: string[];
  truncated?: {
    shown: number;
    total: number;
  };
}

export interface ParseFailure {
  ok: false;
  message: string;
}

export type ParseResult = ParsedTrace | ParseFailure;

/** Unwraps an OTLP attribute value (`{stringValue|intValue|boolValue|doubleValue|...}`)
 * into a JS primitive. Unrecognized/empty shapes fall back to an empty string. */
function otlpAttrValue(v: unknown): string | number | boolean {
  if (v === null || typeof v !== "object") return "";
  const value = v as Record<string, unknown>;
  if ("stringValue" in value) return String(value.stringValue ?? "");
  if ("intValue" in value) return Number(value.intValue);
  if ("boolValue" in value) return Boolean(value.boolValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("arrayValue" in value) {
    const arr = value.arrayValue as { values?: unknown[] } | undefined;
    const values = Array.isArray(arr?.values) ? arr.values : [];
    return values.map((item) => String(otlpAttrValue(item))).join(",");
  }
  return "";
}

/** Unwraps an OTLP `attributes: [{key, value}]` array into a plain record. */
function otlpAttrsToRecord(attrs: unknown): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!Array.isArray(attrs)) return result;
  for (const entry of attrs) {
    if (entry === null || typeof entry !== "object") continue;
    const { key, value } = entry as { key?: unknown; value?: unknown };
    if (typeof key !== "string") continue;
    result[key] = otlpAttrValue(value);
  }
  return result;
}

interface RawSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string | number;
  endTimeUnixNano: string | number;
  status?: { code?: number; message?: string };
  attributes?: unknown;
  events?: unknown;
  service: string;
}

/** Parses a nano-timestamp field (string or number) to BigInt nanoseconds.
 * Non-numeric/absent values fall back to 0n rather than throwing. */
function toNanoBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.length > 0) {
    try {
      return BigInt(v);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function parseOtlp(input: unknown): ParseResult {
  let payload: unknown = input;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return { ok: false, message: "Invalid JSON: could not parse trace payload." };
    }
  }

  if (payload === null || typeof payload !== "object") {
    return {
      ok: false,
      message: "Invalid OTLP trace: expected a JSON object with a `resourceSpans` array.",
    };
  }

  const resourceSpans = (payload as Record<string, unknown>).resourceSpans;
  if (!Array.isArray(resourceSpans)) {
    return {
      ok: false,
      message: "Invalid OTLP trace: missing or malformed `resourceSpans` array.",
    };
  }

  const rawSpans: RawSpan[] = [];
  const serviceSet = new Set<string>();

  for (const rs of resourceSpans) {
    if (rs === null || typeof rs !== "object") continue;
    const resource = (rs as Record<string, unknown>).resource;
    const resourceAttrs =
      resource !== null && typeof resource === "object"
        ? (resource as Record<string, unknown>).attributes
        : undefined;
    const resourceRecord = otlpAttrsToRecord(resourceAttrs);
    const serviceNameRaw = resourceRecord["service.name"];
    const service =
      typeof serviceNameRaw === "string" && serviceNameRaw.length > 0 ? serviceNameRaw : "unknown";
    serviceSet.add(service);

    const scopeSpans = (rs as Record<string, unknown>).scopeSpans;
    if (!Array.isArray(scopeSpans)) continue;

    for (const ss of scopeSpans) {
      if (ss === null || typeof ss !== "object") continue;
      const spans = (ss as Record<string, unknown>).spans;
      if (!Array.isArray(spans)) continue;

      for (const s of spans) {
        if (s === null || typeof s !== "object") continue;
        const span = s as Record<string, unknown>;
        const traceId = typeof span.traceId === "string" ? span.traceId : "";
        const spanId = typeof span.spanId === "string" ? span.spanId : "";
        if (traceId === "" || spanId === "") continue;

        const parentSpanIdRaw = span.parentSpanId;
        const parentSpanId =
          typeof parentSpanIdRaw === "string" && parentSpanIdRaw.length > 0
            ? parentSpanIdRaw
            : undefined;

        const statusRaw = span.status;
        const status =
          statusRaw !== null && typeof statusRaw === "object"
            ? (statusRaw as { code?: unknown; message?: unknown })
            : undefined;

        rawSpans.push({
          traceId,
          spanId,
          ...(parentSpanId !== undefined ? { parentSpanId } : {}),
          name: typeof span.name === "string" ? span.name : "(unnamed span)",
          startTimeUnixNano: span.startTimeUnixNano as string | number,
          endTimeUnixNano: span.endTimeUnixNano as string | number,
          ...(status !== undefined
            ? {
                status: {
                  code: typeof status.code === "number" ? status.code : 0,
                  ...(typeof status.message === "string" ? { message: status.message } : {}),
                },
              }
            : {}),
          attributes: span.attributes,
          events: span.events,
          service,
        });
      }
    }
  }

  const total = rawSpans.length;
  const truncatedInfo = total > MAX_SPANS ? { shown: MAX_SPANS, total } : undefined;
  const usedSpans = total > MAX_SPANS ? rawSpans.slice(0, MAX_SPANS) : rawSpans;

  // Group raw spans by traceId, preserving encounter order for stable output.
  const traceOrder: string[] = [];
  const byTrace = new Map<string, RawSpan[]>();
  for (const rs of usedSpans) {
    let bucket = byTrace.get(rs.traceId);
    if (bucket === undefined) {
      bucket = [];
      byTrace.set(rs.traceId, bucket);
      traceOrder.push(rs.traceId);
    }
    bucket.push(rs);
  }

  const traces: ParsedTraceGroup[] = [];

  for (const traceId of traceOrder) {
    // biome-ignore lint/style/noNonNullAssertion: traceId comes from traceOrder, which is only populated when byTrace.set() was just called for it
    const bucket = byTrace.get(traceId)!;

    // Trace-relative min start (BigInt to avoid precision loss).
    let minStartNs: bigint | undefined;
    for (const rs of bucket) {
      const startNs = toNanoBigInt(rs.startTimeUnixNano);
      if (minStartNs === undefined || startNs < minStartNs) minStartNs = startNs;
    }
    // biome-ignore lint/style/noNonNullAssertion: bucket is non-empty (only created when a span was pushed)
    const traceMinStartNs = minStartNs!;

    // Build spans (without depth/roots yet), keyed by spanId for parent lookup.
    const spanById = new Map<string, TraceSpan>();
    const parentOf = new Map<string, string | undefined>();
    let maxEndMs = 0;

    for (const rs of bucket) {
      const startNs = toNanoBigInt(rs.startTimeUnixNano);
      const endNs = toNanoBigInt(rs.endTimeUnixNano);

      const startMs = Number((startNs - traceMinStartNs) / 1000n) / 1000;
      const rawDurationNs = endNs - startNs;
      const durationMs = rawDurationNs > 0n ? Number(rawDurationNs / 1000n) / 1000 : 0;

      const events: TraceEvent[] = [];
      if (Array.isArray(rs.events)) {
        for (const ev of rs.events) {
          if (ev === null || typeof ev !== "object") continue;
          const evRec = ev as Record<string, unknown>;
          const evNs = toNanoBigInt(evRec.timeUnixNano);
          const timeMs = Number((evNs - traceMinStartNs) / 1000n) / 1000;
          events.push({
            name: typeof evRec.name === "string" ? evRec.name : "(event)",
            timeMs,
            attributes: otlpAttrsToRecord(evRec.attributes),
          });
        }
      }

      const statusCode = rs.status?.code ?? 0;
      const statusMessage = rs.status?.message;

      const span: TraceSpan = {
        id: rs.spanId,
        ...(rs.parentSpanId !== undefined ? { parentId: rs.parentSpanId } : {}),
        name: rs.name,
        service: rs.service,
        startMs,
        durationMs,
        status: {
          code: statusCode,
          ...(statusMessage !== undefined ? { message: statusMessage } : {}),
        },
        attributes: otlpAttrsToRecord(rs.attributes),
        events,
        depth: 0,
        hasError: statusCode === 2,
      };

      spanById.set(rs.spanId, span);
      parentOf.set(rs.spanId, rs.parentSpanId);
      maxEndMs = Math.max(maxEndMs, startMs + durationMs);
    }

    // Compute depth from roots. A span is a root when its parent is absent
    // (empty parentSpanId) OR its parent isn't present in this payload (orphan).
    const depthCache = new Map<string, number>();
    function computeDepth(spanId: string, seen: Set<string>): number {
      const cached = depthCache.get(spanId);
      if (cached !== undefined) return cached;
      const parentId = parentOf.get(spanId);
      if (parentId === undefined || !spanById.has(parentId) || seen.has(spanId)) {
        depthCache.set(spanId, 0);
        return 0;
      }
      const nextSeen = new Set(seen);
      nextSeen.add(spanId);
      const depth = computeDepth(parentId, nextSeen) + 1;
      depthCache.set(spanId, depth);
      return depth;
    }

    const spans: TraceSpan[] = [];
    const roots: TraceSpan[] = [];
    for (const span of spanById.values()) {
      span.depth = computeDepth(span.id, new Set());
      spans.push(span);
      const parentId = parentOf.get(span.id);
      if (parentId === undefined || !spanById.has(parentId)) {
        roots.push(span);
      }
    }

    spans.sort((a, b) => a.startMs - b.startMs || a.depth - b.depth);
    roots.sort((a, b) => a.startMs - b.startMs);

    const minStartMs = spans.length > 0 ? 0 : 0; // trace-relative: min is always 0 by construction
    const durationMs = spans.length > 0 ? maxEndMs - minStartMs : 0;

    traces.push({
      traceId,
      roots,
      spans,
      durationMs,
    });
  }

  const result: ParsedTrace = {
    ok: true,
    traces,
    services: Array.from(serviceSet).sort(),
    ...(truncatedInfo !== undefined ? { truncated: truncatedInfo } : {}),
  };

  return result;
}
