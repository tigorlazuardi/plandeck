import { useMantineColorScheme } from "@mantine/core";
import { useEffect, useId, useRef, useState } from "react";

interface MermaidProps {
  code: string;
}

export function Mermaid({ code }: MermaidProps) {
  const rawId = useId();
  // mermaid ids must be valid CSS identifiers — strip colons/colons from React id
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`;
  const { colorScheme } = useMantineColorScheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        const mermaidTheme = colorScheme === "dark" ? "dark" : "default";
        mermaid.initialize({ startOnLoad: false, theme: mermaidTheme });
        const { svg } = await mermaid.render(id, code);
        if (cancelled) return;
        setError(null);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    render().catch(() => {
      // error handled inside render()
    });

    return () => {
      cancelled = true;
    };
  }, [code, colorScheme, id]);

  if (error) {
    return (
      <div data-testid="mermaid-error" style={{ color: "red", fontFamily: "monospace" }}>
        Mermaid error: {error}
      </div>
    );
  }

  return (
    <div
      data-testid="mermaid-container"
      ref={containerRef}
      style={{ display: "flex", justifyContent: "center" }}
    />
  );
}
