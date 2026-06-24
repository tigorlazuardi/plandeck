// Client-side document export. Operates on the already-rendered DOM, so it works
// uniformly for Markdown and MDX (mermaid SVGs + shiki highlight are in the DOM by
// the time the user clicks export). No server, no headless browser — matches the
// single-binary, no-native-deps constraint.

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "document"
  );
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Concatenate every same-origin stylesheet so the exported file is self-contained.
// Cross-origin sheets throw on `.cssRules` access and are skipped.
function collectStyles(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        css += `${rule.cssText}\n`;
      }
    } catch {
      // cross-origin or inaccessible sheet — skip
    }
  }
  return css;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Replace each <img src> with an inlined data URI so the file opens offline.
async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src);
        if (!res.ok) return;
        img.setAttribute("src", await readAsDataUrl(await res.blob()));
      } catch {
        // leave the original src if it can't be fetched
      }
    }),
  );
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Assemble the self-contained HTML document (pure — no DOM side effects).
export function buildDocHtml(bodyHtml: string, css: string, scheme: string, title: string): string {
  return `<!doctype html>
<html lang="en" data-mantine-color-scheme="${scheme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
<style>
  body { margin: 0; padding: 2rem; }
  .vp-export-body { max-width: 860px; margin-inline: auto; }
</style>
</head>
<body>
<div class="vp-export-body">${bodyHtml}</div>
</body>
</html>`;
}

/** Serialize a rendered doc element into a self-contained .html download. */
export async function exportDocAsHtml(contentEl: HTMLElement, title: string): Promise<void> {
  const clone = contentEl.cloneNode(true) as HTMLElement;
  // Drop the export toolbar and any other print-excluded chrome.
  for (const node of Array.from(clone.querySelectorAll(".vp-no-print"))) {
    node.remove();
  }
  await inlineImages(clone);

  const scheme = document.documentElement.getAttribute("data-mantine-color-scheme") ?? "light";
  const html = buildDocHtml(clone.innerHTML, collectStyles(), scheme, title);
  downloadBlob(html, `${slugify(title)}.html`, "text/html");
}

/** Trigger the browser print dialog (user picks "Save as PDF"). */
export function printDoc(): void {
  window.print();
}

// Force a light color scheme while printing so dark-mode docs don't waste ink or
// render light text on white paper. Restores the user's scheme afterward.
export function setupPrintLightMode(): () => void {
  const root = document.documentElement;
  let previous: string | null = null;

  const onBeforePrint = () => {
    previous = root.getAttribute("data-mantine-color-scheme");
    root.setAttribute("data-mantine-color-scheme", "light");
  };
  const onAfterPrint = () => {
    if (previous === null) {
      root.removeAttribute("data-mantine-color-scheme");
    } else {
      root.setAttribute("data-mantine-color-scheme", previous);
    }
  };

  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  return () => {
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
  };
}
