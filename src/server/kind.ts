import type { DocKind, ResolvedConfig } from "../shared/types.ts";

/**
 * Determine the DocKind for a given file path based on the resolved config.
 * Returns null if the extension is not in textFiles or nonTextFiles (file not discoverable).
 *
 * Precedence: textFiles takes priority if ext appears in both (pathological).
 * Extension matching is case-insensitive.
 *
 * textFiles ext mapping:
 *   .mdx → 'mdx'
 *   .md  → 'md'
 *   .txt → 'txt'
 *   other text exts → 'md' (per spec §5: "other text extensions render as markdown unless .txt-like")
 *
 * nonTextFiles ext mapping:
 *   .html | .htm → 'html'
 *   .pdf         → 'pdf'
 *   .jpg | .jpeg | .png → 'image'
 *   other non-text ext → null (not discoverable)
 */
export function kindFor(filePath: string, config: ResolvedConfig): DocKind | null {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return null;
  const ext = filePath.slice(lastDot).toLowerCase();

  // textFiles takes precedence
  const inText = config.textFiles.some((e) => e.toLowerCase() === ext);
  if (inText) {
    if (ext === ".mdx") return "mdx";
    if (ext === ".md") return "md";
    if (ext === ".txt") return "txt";
    // all other text extensions → md renderer
    return "md";
  }

  const inNonText = config.nonTextFiles.some((e) => e.toLowerCase() === ext);
  if (inNonText) {
    if (ext === ".html" || ext === ".htm") return "html";
    if (ext === ".pdf") return "pdf";
    if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") return "image";
    // other non-text ext → not discoverable
    return null;
  }

  return null;
}
