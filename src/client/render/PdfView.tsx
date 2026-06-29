interface PdfViewProps {
  path: string;
}

/**
 * Renders a PDF via the native browser viewer using /api/raw/<path>.
 */
export function PdfView({ path }: PdfViewProps) {
  return (
    <iframe
      src={`/api/raw/${path}`}
      // Fill the viewport (height:100% collapses — Main has no definite height).
      // 88px ≈ header (56) + Main padding "md" (2×16).
      style={{
        width: "100%",
        height: "calc(100dvh - 88px)",
        minHeight: "600px",
        border: "none",
      }}
      title="PDF document preview"
    />
  );
}
