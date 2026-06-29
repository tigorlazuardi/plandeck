import { describe, expect, it, mock } from "bun:test";
import {
  buildDocHtml,
  escapeHtml,
  printDoc,
  printHtmlDoc,
  slugify,
} from "../../src/client/export.ts";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("My Trace Report")).toBe("my-trace-report");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Foo — Bar / Baz!!")).toBe("foo-bar-baz");
  });

  it("trims leading/trailing separators", () => {
    expect(slugify("  ...Hello...  ")).toBe("hello");
  });

  it("falls back to 'document' when empty", () => {
    expect(slugify("———")).toBe("document");
  });
});

describe("escapeHtml", () => {
  it("escapes angle brackets, ampersands, and quotes", () => {
    expect(escapeHtml('<a href="x">&')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});

describe("buildDocHtml", () => {
  const html = buildDocHtml("<h1>Title</h1><pre>code</pre>", ".x{color:red}", "dark", "My <Doc>");

  it("is a complete, self-contained document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    // CSS is inlined (self-contained, no external <link>)
    expect(html).toContain("<style>.x{color:red}</style>");
    expect(html).not.toContain("<link ");
  });

  it("carries the rendered body and color scheme", () => {
    expect(html).toContain("<h1>Title</h1><pre>code</pre>");
    expect(html).toContain('data-mantine-color-scheme="dark"');
  });

  it("escapes the title", () => {
    expect(html).toContain("<title>My &lt;Doc&gt;</title>");
  });
});

describe("printDoc", () => {
  it("invokes window.print", () => {
    const spy = mock(() => {});
    window.print = spy;
    printDoc();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("printHtmlDoc", () => {
  it("uses a transient iframe whose sandbox never allows scripts", () => {
    printHtmlDoc("<p>hi</p>");
    const frames = Array.from(document.querySelectorAll("iframe"));
    const printFrame = frames.find((f) => f.getAttribute("aria-hidden") === "true");
    expect(printFrame).toBeTruthy();
    const sandbox = printFrame?.getAttribute("sandbox") ?? "";
    // SECURITY: same-origin lets the parent call print(), but scripts stay off.
    expect(sandbox).toContain("allow-same-origin");
    expect(sandbox).not.toContain("allow-scripts");
    expect(printFrame?.getAttribute("srcdoc")).toBe("<p>hi</p>");
    printFrame?.remove();
  });
});
