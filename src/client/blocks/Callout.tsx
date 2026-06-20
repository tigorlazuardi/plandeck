import type React from "react";

interface CalloutProps {
  type?: "info" | "warn" | "success" | "danger";
  title?: string;
  children?: React.ReactNode;
}

const typeStyles: Record<string, React.CSSProperties> = {
  info: { borderLeft: "4px solid #339af0", background: "#e7f5ff", color: "#1c7ed6" },
  warn: { borderLeft: "4px solid #f59f00", background: "#fff9db", color: "#e67700" },
  success: { borderLeft: "4px solid #40c057", background: "#ebfbee", color: "#2f9e44" },
  danger: { borderLeft: "4px solid #fa5252", background: "#fff5f5", color: "#e03131" },
};

export function Callout({ type = "info", title, children }: CalloutProps) {
  const style: React.CSSProperties = {
    padding: "12px 16px",
    borderRadius: "4px",
    margin: "12px 0",
    ...typeStyles[type],
  };

  return (
    <div data-type={type} style={style}>
      {title && <div style={{ fontWeight: 700, marginBottom: children ? "6px" : 0 }}>{title}</div>}
      <div>{children}</div>
    </div>
  );
}
