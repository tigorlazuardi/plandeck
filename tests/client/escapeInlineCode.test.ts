import { describe, expect, test } from "bun:test";
import { escapeInlineCode } from "../../src/client/render/escapeInlineCode.ts";

describe("escapeInlineCode", () => {
  test("escapes underscore inside inline <code>", () => {
    expect(escapeInlineCode("<code>product_id</code>")).toBe("<code>product\\_id</code>");
  });

  test("escapes asterisk and backtick inside <code>", () => {
    expect(escapeInlineCode("<code>a*b`c</code>")).toBe("<code>a\\*b\\`c</code>");
  });

  test("escapes the repro patterns", () => {
    const src = "<code>bond_orders-*</code> <code>product_id</code> <code>created_at</code>";
    expect(escapeInlineCode(src)).toBe(
      "<code>bond\\_orders-\\*</code> <code>product\\_id</code> <code>created\\_at</code>",
    );
  });

  test("leaves dashes untouched", () => {
    expect(escapeInlineCode("<code>order-status</code>")).toBe("<code>order-status</code>");
  });

  test("does not touch text outside <code>/<pre>", () => {
    const src = "plain _emphasis_ here <code>x_y</code> and *more*";
    expect(escapeInlineCode(src)).toBe("plain _emphasis_ here <code>x\\_y</code> and *more*");
  });

  test("does not touch the opening tag attributes", () => {
    const src = '<code className="language-ts" data-tab="a_b.ts">x_y</code>';
    expect(escapeInlineCode(src)).toBe(
      '<code className="language-ts" data-tab="a_b.ts">x\\_y</code>',
    );
  });

  test("is idempotent (already-escaped chars stay single-escaped)", () => {
    const once = escapeInlineCode("<code>product_id</code>");
    expect(escapeInlineCode(once)).toBe(once);
  });

  test("escapes raw <pre>text</pre> without nested <code>", () => {
    expect(escapeInlineCode("<pre>a_b</pre>")).toBe("<pre>a\\_b</pre>");
  });

  test("does NOT escape nested <code> attrs when wrapped in <pre>", () => {
    const src = '<pre><code className="language-ts" data-tab="s_v.ts">const x_y = 1;</code></pre>';
    expect(escapeInlineCode(src)).toBe(
      '<pre><code className="language-ts" data-tab="s_v.ts">const x\\_y = 1;</code></pre>',
    );
  });

  test("skips {...} JS expression spans inside <code>", () => {
    const src = '<code>{"<p>a_b</p>"}</code>';
    // The expression is JS — must stay verbatim, not escaped.
    expect(escapeInlineCode(src)).toBe('<code>{"<p>a_b</p>"}</code>');
  });

  test("escapes literal text around a {...} span", () => {
    const src = "<code>x_y {n} z_w</code>";
    expect(escapeInlineCode(src)).toBe("<code>x\\_y {n} z\\_w</code>");
  });

  test("handles multiline <code> content", () => {
    const src = "<code>line_one\nline_two</code>";
    expect(escapeInlineCode(src)).toBe("<code>line\\_one\nline\\_two</code>");
  });
});
