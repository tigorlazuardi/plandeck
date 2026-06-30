// MDX parses markdown inside JSX children — including inside <code>/<pre> tags.
// That means `<code>product_id</code>` is read as `product` + emphasis-open `_`
// and, finding no closing `_`, micromark errors:
//   Expected the closing tag `</code>` either after the end of `emphasis`
// Underscores, asterisks and backticks all trigger this. Semantically the
// content of <code>/<pre> should be literal, so we escape those markdown
// characters with a backslash before handing the source to MDX. MDX honors
// `\_` / `\*` / `` \` `` in JSX child text and renders the literal character.
//
// We deliberately:
//   - touch only the *inner text* between the opening and closing tag,
//     never the tag name, attributes, or the `</tag>` itself;
//   - skip `{...}` expression spans, because those are real JavaScript that
//     MDX must keep parsing (e.g. <code>{"<p>x</p>"}</code> in HtmlBlock);
//   - leave already-escaped characters (`\_`) untouched so re-running is safe.

const MARKDOWN_CHARS = /(?<!\\)([_*`])/g;

// Escape markdown-significant chars in a run of literal child text, but leave
// `{...}` expression spans untouched so MDX can still parse them as JS.
function escapeLiteralText(inner: string): string {
  let out = "";
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    if (ch === "{") {
      // Copy a balanced {...} expression span verbatim.
      let depth = 0;
      const start = i;
      while (i < inner.length) {
        const c = inner[i];
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        i++;
      }
      out += inner.slice(start, i);
      continue;
    }
    // Accumulate a literal run up to the next `{`.
    const next = inner.indexOf("{", i);
    const end = next === -1 ? inner.length : next;
    out += inner.slice(i, end).replace(MARKDOWN_CHARS, "\\$1");
    i = end;
  }
  return out;
}

// Match an opening <code ...>/<pre ...> tag (capturing it), its inner content
// (lazy, no nested same-tag), and the matching closing tag. `code` and `pre`
// are matched separately so a <code> inside a <pre> is handled on its own.
function makeTagRegex(tag: "code" | "pre"): RegExp {
  // [^>]* stops the opening tag at the first `>`; attributes may contain `_`
  // but never `>`, so this stays within the tag.
  return new RegExp(`(<${tag}(?:\\s[^>]*)?>)([\\s\\S]*?)(</${tag}>)`, "g");
}

const CODE_RE = makeTagRegex("code");
const PRE_RE = makeTagRegex("pre");

/**
 * Escape markdown-significant characters (`_`, `*`, `` ` ``) inside the literal
 * text content of inline <code> and <pre> JSX tags so authors can write
 * `<code>product_id</code>` without an MDX parse error and without manual
 * `&#95;` workarounds.
 */
export function escapeInlineCode(source: string): string {
  const escapeCode = (_full: string, open: string, inner: string, close: string): string =>
    `${open}${escapeLiteralText(inner)}${close}`;

  // <code> always holds literal text — escape its inner content.
  let out = source.replace(CODE_RE, escapeCode);

  // <pre> only when it directly wraps literal text (no nested <code>). A
  // <pre><code>…</code></pre> has its literal already handled by the <code>
  // pass above; escaping the <pre> inner there would wrongly touch the nested
  // <code> tag's attributes (className, data-tab, …).
  out = out.replace(PRE_RE, (full, open, inner, close) =>
    /<code[\s>]/.test(inner) ? full : `${open}${escapeLiteralText(inner)}${close}`,
  );

  return out;
}
