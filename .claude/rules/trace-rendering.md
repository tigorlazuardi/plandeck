---
paths:
  - src/client/render/parseOtlp.ts
  - src/client/render/TraceWaterfall.tsx
  - src/client/render/redactAttr.ts
  - src/client/blocks/TraceWaterfall.tsx
  - src/server/kind.ts
---

# Trace waterfall (OTLP) rendering

Feature: draw OpenTelemetry trace spans as a Grafana-style waterfall. Fed two
ways — an inline MDX `<TraceWaterfall>` block and a standalone `*.trace.json`
file kind — both sharing `src/client/render/TraceWaterfall.tsx`. Spec:
`plans/trace-waterfall/SPEC.mdx`.

## Format: OTLP JSON only
Input is the OpenTelemetry export shape
(`resourceSpans[].scopeSpans[].spans[]`). `parseOtlp(input)` is a pure function
returning a discriminated `ParseResult = ParsedTrace | ParseFailure` — it NEVER
throws; malformed input yields `{ ok:false, message }` which the renderer shows
as an ErrorCard. No Jaeger/Zipkin/custom formats (converters could come later).

## View-model invariants (parseOtlp)
- **Timestamps**: OTLP `*UnixNano` fields are strings that overflow
  `Number.MAX_SAFE_INTEGER`. Parse with `BigInt`; expose each span as
  `{ startMs, durationMs }` **relative to the trace min-start** (small enough for
  `number`, ~µs precision). Never store absolute epoch-ms as a `number`.
- **Orphans → roots**: a span whose `parentSpanId` is absent OR whose parent is
  not present in the payload is surfaced as a root. Never dropped.
- **Truncation**: `MAX_SPANS = 2000`. Over the cap → keep the first N, set
  `truncated: { shown, total }`; the UI shows "showing N of M spans". No silent cap.
- Multi-`traceId` payloads render as separate trace sections (no cross-trace link).

## Sensitive attributes (Tier-A masking)
`redactAttr.ts` `isSensitiveKey(key)` masks the VALUE (renders `<redacted>`, key
kept visible) for attribute keys whose name contains any of
`SENSITIVE_ATTR_KEY_SUBSTRINGS` (token/password/secret/api_key/authorization/
credential/private_key/bearer/cookie). Applied in the detail panel's attributes
table. This is the one universal-redaction touch; the viewer emits no telemetry
itself. See global `telemetry-planning` skill for the tier model.

## `*.trace.json` file kind (server)
`kindFor` (`src/server/kind.ts`) is **compound-suffix aware**: a path ending in
`.trace.json` is classified `"trace"` (a plain `.json` stays unclassified/null).
`.trace.json` is in `BUILTIN_DEFAULTS.textFiles` so it's discovered by default and
disable-able via config. `trace` is served as text by `/api/doc` (falls through
the text path; only pdf/image short-circuit) and is NOT prose-indexed. `DocKind`
gains `"trace"` additively — it's a frozen contract, additive-only.

## ⚠️ MDX block children arrive shiki-tokenized (load-bearing gotcha)
`Mdx.tsx` runs `rehype-shiki` over the WHOLE tree, including fenced code nested
inside a custom block's children. So a block like `<TraceWaterfall>` (or
`HtmlBlock`) receives its ` ```json ` child as a **tree of highlighted `<span>`
tokens, NOT a plain string**. Reading `children[0].props.children` and
`String()`-ing it yields garbage (`[object Object],…`) and the parse fails.

Correct extraction = **recursively collect text leaves** (DFS, in order) — see
`collectText` in `blocks/TraceWaterfall.tsx`. This also handles the plain
`<pre><code>string</code></pre>` subtree used in unit tests. A unit test that
hand-builds the subtree does NOT exercise the shiki path — only a real `.mdx`
fixture through the pipeline (or the visual-check harness) proves it. Regression
test: "reconstructs source from a shiki-tokenized span tree" in `blocks.test.tsx`.

> NOTE: `HtmlBlock.tsx` still uses the old `String(content)` extraction and likely
> has the same latent bug for multi-token ```html fences. Not fixed here (out of
> scope for the trace feature); fix with the same `collectText` approach if it bites.

## Print
Bars, axis, and the service legend (the color key) are plain positioned DOM so
they survive Print/Save-as-PDF like Mermaid. Only the click-through `Drawer`
carries `vp-no-print`. The on-screen scroll cap (`.vp-trace-scroll`, `mah=70vh`)
is neutralized in `print.css` so the full trace prints.

## Tests
Unit (`parseOtlp.test.ts`, `redactAttr.test.ts`), component
(`TraceWaterfall.test.tsx` — real `MantineProvider`, never mock `@mantine/core`),
block (`blocks.test.tsx`), server (`kind.test.ts`), and visual-check scenarios
`trace-file` / `trace-block` (light+dark) via `bun run visual`.
