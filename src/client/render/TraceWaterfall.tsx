import { Badge, Drawer, Group, Paper, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { ErrorCard } from "../shell/ErrorCard.tsx";
import { type ParsedTraceGroup, type TraceSpan, parseOtlp } from "./parseOtlp.ts";
import { isSensitiveKey } from "./redactAttr.ts";

interface TraceWaterfallProps {
  source: string;
}

// Fixed palette (Mantine color names) — a stable hash of `service.name` picks
// an index so the same service always gets the same swatch across renders.
const SERVICE_PALETTE = [
  "blue",
  "teal",
  "grape",
  "orange",
  "cyan",
  "lime",
  "pink",
  "indigo",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorForService(service: string): string {
  // biome-ignore lint/style/noNonNullAssertion: SERVICE_PALETTE is a non-empty const array
  return SERVICE_PALETTE[hashString(service) % SERVICE_PALETTE.length]!;
}

function formatMs(ms: number): string {
  if (ms < 1) return `${Math.round(ms * 1000)}μs`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const AXIS_TICK_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
// Bars shorter than this would be visually invisible — floor the width.
const MIN_BAR_WIDTH_PCT = 0.5;

function AttributesTable({
  attributes,
}: { attributes: Record<string, string | number | boolean> }) {
  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No attributes.
      </Text>
    );
  }
  return (
    <Table striped withTableBorder withColumnBorders>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Key</Table.Th>
          <Table.Th>Value</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {entries.map(([key, value]) => (
          <Table.Tr key={key}>
            <Table.Td>{key}</Table.Td>
            <Table.Td data-testid={`attr-value-${key}`}>
              {isSensitiveKey(key) ? "<redacted>" : String(value)}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function SpanDetailPanel({ span }: { span: TraceSpan }) {
  return (
    <Stack gap="md">
      <div>
        <Text fw={600}>{span.name}</Text>
        <Text size="sm" c="dimmed">
          {span.service}
        </Text>
      </div>
      <Group gap="lg">
        <div>
          <Text size="xs" c="dimmed">
            Start
          </Text>
          <Text size="sm">{formatMs(span.startMs)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Duration
          </Text>
          <Text size="sm">{formatMs(span.durationMs)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Status
          </Text>
          <Text size="sm" {...(span.hasError ? { c: "red" } : {})}>
            {span.status.code}
            {span.status.message ? ` — ${span.status.message}` : ""}
          </Text>
        </div>
      </Group>
      <div>
        <Text size="sm" fw={500} mb="xs">
          Attributes
        </Text>
        <AttributesTable attributes={span.attributes} />
      </div>
      <div>
        <Text size="sm" fw={500} mb="xs">
          Events
        </Text>
        {span.events.length === 0 ? (
          <Text size="sm" c="dimmed">
            No events.
          </Text>
        ) : (
          <Stack gap="xs">
            {span.events.map((event, idx) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: events have no stable id in the view-model
              <Paper key={idx} withBorder p="xs" radius="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {event.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatMs(event.timeMs)}
                  </Text>
                </Group>
                <AttributesTable attributes={event.attributes} />
              </Paper>
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  );
}

function TimeAxis({ durationMs }: { durationMs: number }) {
  return (
    <div style={{ display: "flex", position: "relative", height: "1.25rem", marginBottom: 4 }}>
      {AXIS_TICK_FRACTIONS.map((frac) => (
        <Text
          key={frac}
          size="xs"
          c="dimmed"
          style={{
            position: "absolute",
            left: `${frac * 100}%`,
            transform: frac === 1 ? "translateX(-100%)" : frac === 0 ? "none" : "translateX(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          {formatMs(frac * durationMs)}
        </Text>
      ))}
    </div>
  );
}

function ServiceLegend({ services }: { services: string[] }) {
  return (
    // The legend is the color key for the bars — it MUST print (not vp-no-print),
    // otherwise a printed waterfall has colored bars with no service mapping.
    <Group gap="md" mb="sm" data-testid="service-legend">
      {services.map((service) => (
        <Group gap={6} key={service} wrap="nowrap">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: `var(--mantine-color-${colorForService(service)}-6)`,
            }}
          />
          <Text size="xs">{service}</Text>
        </Group>
      ))}
    </Group>
  );
}

interface SpanRowProps {
  span: TraceSpan;
  traceDurationMs: number;
  selected: boolean;
  onSelect: (span: TraceSpan) => void;
}

function SpanRow({ span, traceDurationMs, selected, onSelect }: SpanRowProps) {
  const safeDuration = traceDurationMs > 0 ? traceDurationMs : 1;
  const leftPct = (span.startMs / safeDuration) * 100;
  const widthPct = Math.max((span.durationMs / safeDuration) * 100, MIN_BAR_WIDTH_PCT);
  const barColor = span.hasError
    ? "var(--mantine-color-red-6)"
    : `var(--mantine-color-${colorForService(span.service)}-6)`;

  return (
    <Group
      gap="xs"
      wrap="nowrap"
      align="center"
      data-testid={`span-row-${span.id}`}
      data-error={span.hasError ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      onClick={() => onSelect(span)}
      style={{
        cursor: "pointer",
        paddingBlock: 2,
        paddingInline: 4,
        borderRadius: 4,
        backgroundColor: selected ? "var(--mantine-color-default-hover)" : undefined,
      }}
    >
      <Text
        size="sm"
        title={span.name}
        style={{
          paddingLeft: span.depth * 16,
          width: 220,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {span.name}
      </Text>
      <div style={{ position: "relative", flexGrow: 1, height: "1.25rem" }}>
        <div
          data-testid={`span-bar-${span.id}`}
          data-error={span.hasError ? "true" : undefined}
          style={{
            position: "absolute",
            top: 2,
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            height: "1rem",
            backgroundColor: barColor,
            borderLeft: span.hasError ? "2px solid var(--mantine-color-red-9)" : undefined,
            borderRadius: 2,
            minWidth: 2,
          }}
          title={`${span.name} — ${formatMs(span.durationMs)}`}
        />
      </div>
      <Text size="xs" c="dimmed" style={{ width: 70, flexShrink: 0, textAlign: "right" }}>
        {formatMs(span.durationMs)}
      </Text>
    </Group>
  );
}

function TraceSection({
  trace,
  selectedSpanId,
  onSelect,
}: {
  trace: ParsedTraceGroup;
  selectedSpanId: string | undefined;
  onSelect: (span: TraceSpan) => void;
}) {
  return (
    <Paper withBorder radius="md" p="md" mb="md" data-testid={`trace-${trace.traceId}`}>
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>
          Trace {trace.traceId}
        </Text>
        <Badge variant="light" size="sm">
          {formatMs(trace.durationMs)}
        </Badge>
      </Group>
      <TimeAxis durationMs={trace.durationMs} />
      <Stack gap={2}>
        {trace.spans.map((span) => (
          <SpanRow
            key={span.id}
            span={span}
            traceDurationMs={trace.durationMs}
            selected={span.id === selectedSpanId}
            onSelect={onSelect}
          />
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * Shared OTLP trace waterfall renderer: parses `source` (raw JSON text or an
 * already-parsed object), renders a nested Gantt-style waterfall per trace
 * with a time axis, service-colored bars (ERROR overrides to red), a service
 * legend, and a click-through detail panel (Mantine Drawer). Bars/axis/legend
 * are plain positioned DOM so they survive Print / Save-as-PDF like Mermaid
 * (including the service legend — it is the color key). Only the click-through
 * Drawer carries `vp-no-print`. The on-screen scroll cap is neutralized in
 * print via `.vp-trace-scroll` (see print.css) so the full trace prints.
 */
export function TraceWaterfall({ source }: TraceWaterfallProps) {
  const result = useMemo(() => parseOtlp(source), [source]);
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | null>(null);

  if (!result.ok) {
    return <ErrorCard title="Invalid trace" detail={result.message} />;
  }

  const totalSpans = result.traces.reduce((sum, t) => sum + t.spans.length, 0);
  if (totalSpans === 0) {
    return (
      <ErrorCard
        title="No spans in this trace"
        detail="The OTLP payload parsed successfully but contains no spans to render."
      />
    );
  }

  return (
    <div>
      {result.truncated && (
        <Text size="sm" c="orange" mb="sm" data-testid="truncated-marker">
          Showing {result.truncated.shown} of {result.truncated.total} spans.
        </Text>
      )}
      <ServiceLegend services={result.services} />
      <ScrollArea.Autosize mah="70vh" type="auto" className="vp-trace-scroll">
        {result.traces.map((trace) => (
          <TraceSection
            key={trace.traceId}
            trace={trace}
            selectedSpanId={selectedSpan?.id}
            onSelect={setSelectedSpan}
          />
        ))}
      </ScrollArea.Autosize>
      <Drawer
        className="vp-no-print"
        opened={selectedSpan !== null}
        onClose={() => setSelectedSpan(null)}
        position="right"
        size="md"
        title="Span detail"
        data-testid="span-detail-drawer"
      >
        {selectedSpan && <SpanDetailPanel span={selectedSpan} />}
      </Drawer>
    </div>
  );
}
