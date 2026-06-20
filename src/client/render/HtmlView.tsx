interface HtmlViewProps {
  html: string;
}

/**
 * Renders an HTML string in a sandboxed iframe using srcdoc.
 *
 * SECURITY: sandbox attribute intentionally omits allow-scripts and
 * allow-same-origin to prevent XSS and origin-access attacks.
 * Uses srcdoc (never src) so content is not served from app origin.
 */
export function HtmlView({ html }: HtmlViewProps) {
  return (
    <iframe
      srcDoc={html}
      sandbox="allow-forms allow-popups"
      style={{ width: "100%", height: "100%", border: "none", minHeight: "400px" }}
      title="HTML document preview"
    />
  );
}
