import type React from "react";

interface DecisionProps {
  status?: "proposed" | "accepted" | "rejected";
  title: string;
  children?: React.ReactNode;
}

const statusStyles: Record<string, React.CSSProperties> = {
  proposed: { background: "#e7f5ff", color: "#1c7ed6", border: "1px solid #339af0" },
  accepted: { background: "#ebfbee", color: "#2f9e44", border: "1px solid #40c057" },
  rejected: { background: "#fff5f5", color: "#e03131", border: "1px solid #fa5252" },
};

export function Decision({ status = "proposed", title, children }: DecisionProps) {
  const badgeStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
    ...statusStyles[status],
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #dee2e6",
    borderRadius: "6px",
    padding: "16px",
    margin: "12px 0",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: "16px",
    margin: 0,
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
        <span style={badgeStyle}>{status}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}
