// CommonMark silently hides HTML/markdown comments (`<!-- ... -->`), but the MDX
// compiler treats `<!--` as the start of JSX and errors:
//   Unexpected character `!` (U+0021) before name … (note: to create a comment
//   in MDX, use `{/* text */}`)
// So an authored comment shows a Parse Error card in the MDX viewer instead of
// vanishing like it does in the plain-Markdown viewer. This preprocess strips
// comments from the source BEFORE it reaches the MDX compiler (remark plugins
// run after parse, too late to help), restoring CommonMark behaviour.
//
// Comments are LEFT INTACT inside fenced code blocks (``` / ~~~) and inline code
// spans (backtick-delimited) so a doc that *shows* `<!-- example -->` as sample
// code still renders it literally.

// Strip `<!-- ... -->` from a run of normal (non-fenced) text, copying inline
// code spans verbatim so a comment shown inside backticks survives.
function stripCommentsFromText(text: string): string {
  let out = "";
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    // Inline code span: copy a backtick-delimited run verbatim.
    if (ch === "`") {
      let ticks = 0;
      while (i + ticks < n && text[i + ticks] === "`") ticks++;
      const fence = "`".repeat(ticks);
      const close = text.indexOf(fence, i + ticks);
      if (close === -1) {
        // Unterminated run — copy the rest verbatim, nothing left to strip.
        out += text.slice(i);
        break;
      }
      out += text.slice(i, close + ticks);
      i = close + ticks;
      continue;
    }
    // HTML comment: drop `<!-- ... -->` only when it is properly closed. An
    // unterminated `<!--` is left literal rather than eating the rest of the doc.
    if (ch === "<" && text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end !== -1) {
        i = end + 3;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s{0,3}(`{3,}|~{3,})\s*$/;

/**
 * Remove HTML/markdown comments (`<!-- ... -->`) from MDX source so the MDX
 * compiler hides them the way CommonMark does, instead of erroring on `<!--`.
 * Comments inside fenced code blocks and inline code spans are preserved.
 */
export function stripHtmlComments(source: string): string {
  const lines = source.split("\n");
  const result: string[] = [];
  let normal: string[] = [];
  // Active fence marker chars while inside a fenced code block, else null.
  let fence: string | null = null;

  const flushNormal = () => {
    if (normal.length > 0) {
      result.push(stripCommentsFromText(normal.join("\n")));
      normal = [];
    }
  };

  for (const line of lines) {
    if (fence !== null) {
      result.push(line);
      const close = line.match(FENCE_CLOSE);
      const marker = close?.[1];
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    const open = line.match(FENCE_OPEN);
    if (open?.[1]) {
      flushNormal();
      result.push(line);
      fence = open[1];
      continue;
    }
    normal.push(line);
  }
  flushNormal();

  return result.join("\n");
}
