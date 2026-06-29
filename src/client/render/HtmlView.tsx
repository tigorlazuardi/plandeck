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
      // Fill the viewport and scroll internally. height:100% collapses here —
      // AppShell.Main has no definite height — and the iframe is sandboxed
      // (no allow-same-origin), so it can't be measured to auto-size.
      // 88px ≈ header (56) + Main padding "md" (2×16).
      style={{
        width: "100%",
        height: "calc(100dvh - 88px)",
        minHeight: "400px",
        border: "none",
      }}
      title="HTML document preview"
    />
  );
}
