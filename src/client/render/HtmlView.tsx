import { Button, Group, Menu, Switch, Tooltip } from "@mantine/core";
import { FileDown, Printer, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { printHtmlDoc } from "../export.ts";

// SECURITY: the two sandbox values this viewer is ever allowed to emit.
//
// Default: no allow-scripts, no allow-same-origin — the document is fully inert.
// Opt-in (per file, via the toggle below): ADD allow-scripts but STILL never
// allow-same-origin. Scripts then run in an opaque/null origin: they cannot read
// the app's cookies/localStorage/DOM and cannot remove their own sandbox (that
// requires allow-scripts AND allow-same-origin together). They CAN make network
// requests and run arbitrary JS inside the frame — hence the explicit warning.
const SANDBOX_INERT = "allow-forms allow-popups";
const SANDBOX_SCRIPTS = "allow-forms allow-popups allow-scripts"; // NEVER add allow-same-origin

interface HtmlViewProps {
  html: string;
}

/**
 * Renders an HTML string in a sandboxed iframe using srcdoc.
 *
 * SECURITY: by default the sandbox omits both allow-scripts and allow-same-origin
 * (fully inert). A per-file opt-in toggle can add allow-scripts only — never
 * allow-same-origin. Uses srcdoc (never src) so content is not served from app
 * origin. See SANDBOX_* constants above and rules/raw-endpoint-and-sandbox.md.
 */
export function HtmlView({ html }: HtmlViewProps) {
  const [scriptsEnabled, setScriptsEnabled] = useState(false);

  // Re-arm the inert default whenever the document changes, so enabling scripts
  // for one file never silently carries over to the next.
  // biome-ignore lint/correctness/useExhaustiveDependencies: html prop change IS the trigger to re-arm
  useEffect(() => {
    setScriptsEnabled(false);
  }, [html]);

  const sandbox = scriptsEnabled ? SANDBOX_SCRIPTS : SANDBOX_INERT;

  return (
    <div style={{ position: "relative" }}>
      <Group
        className="vp-no-print"
        gap="sm"
        align="center"
        style={{ position: "absolute", top: 8, right: 8, zIndex: 5 }}
      >
        <Tooltip
          multiline
          w={260}
          withArrow
          label="Lets this document run its own JavaScript. Only enable for files you trust — a malicious script can run arbitrary code and make network requests (but cannot read this app's data or cookies)."
        >
          <Switch
            size="xs"
            color="red"
            checked={scriptsEnabled}
            onChange={(e) => setScriptsEnabled(e.currentTarget.checked)}
            label={
              <Group gap={4} align="center" wrap="nowrap">
                <TriangleAlert size={12} color="var(--mantine-color-red-6)" />
                <span>Enable scripts</span>
              </Group>
            }
          />
        </Tooltip>
        <Menu position="bottom-end" withinPortal shadow="md">
          <Menu.Target>
            <Button size="xs" variant="default" leftSection={<FileDown size={14} />}>
              Export
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Printer size={14} />} onClick={() => printHtmlDoc(html)}>
              Print / Save as PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <iframe
        // Changing the sandbox needs a fresh load to take effect — re-mount the
        // iframe by keying it on the active sandbox value.
        key={sandbox}
        srcDoc={html}
        sandbox={sandbox}
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
    </div>
  );
}
