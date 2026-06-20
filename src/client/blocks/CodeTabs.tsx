import React, { useState } from "react";

interface CodeTabsProps {
  children?: React.ReactNode;
}

interface TabInfo {
  label: string;
  content: React.ReactNode;
  isDefault: boolean;
}

function extractTabs(children: React.ReactNode): TabInfo[] {
  return React.Children.toArray(children).map((child, idx) => {
    if (!React.isValidElement(child)) {
      return { label: String(idx), content: child, isDefault: false };
    }

    // pre element — look inside for code
    const pre = child as React.ReactElement<{
      children?: React.ReactNode;
    }>;
    const preChildren = React.Children.toArray(pre.props.children);
    const codeEl = preChildren[0];

    if (!React.isValidElement(codeEl)) {
      return { label: String(idx), content: child, isDefault: false };
    }

    const code = codeEl as React.ReactElement<{
      className?: string;
      "data-tab"?: string;
      "data-default"?: string;
    }>;

    const dataTab = code.props["data-tab"];
    const isDefault = code.props["data-default"] === "true";

    // Fallback: extract lang from className="language-xxx"
    let label: string;
    if (dataTab) {
      label = dataTab;
    } else {
      const className = code.props.className ?? "";
      const langMatch = className.match(/language-(\S+)/);
      label = langMatch?.[1] ?? String(idx);
    }

    return { label, content: child, isDefault };
  });
}

export function CodeTabs({ children }: CodeTabsProps) {
  const tabs = extractTabs(children);

  const defaultIdx = () => {
    const di = tabs.findIndex((t) => t.isDefault);
    return di >= 0 ? di : 0;
  };

  const [activeIdx, setActiveIdx] = useState<number>(defaultIdx);

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    gap: "4px",
    borderBottom: "2px solid #dee2e6",
    marginBottom: "0",
  };

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    border: "none",
    borderBottom: active ? "2px solid #339af0" : "2px solid transparent",
    background: "none",
    cursor: "pointer",
    fontWeight: active ? 700 : 400,
    color: active ? "#339af0" : "inherit",
    marginBottom: "-2px",
  });

  const contentStyle: React.CSSProperties = {
    border: "1px solid #dee2e6",
    borderTop: "none",
    borderRadius: "0 0 4px 4px",
    overflow: "auto",
  };

  return (
    <div>
      <div style={tabBarStyle}>
        {tabs.map((tab, idx) => (
          <button
            key={tab.label}
            type="button"
            style={tabBtnStyle(idx === activeIdx)}
            onClick={() => setActiveIdx(idx)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={contentStyle}>{tabs[activeIdx]?.content}</div>
    </div>
  );
}
