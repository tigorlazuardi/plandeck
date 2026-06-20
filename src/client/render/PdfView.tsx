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
      style={{ width: "100%", height: "100%", border: "none", minHeight: "600px" }}
      title="PDF document preview"
    />
  );
}
