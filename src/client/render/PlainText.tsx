interface PlainTextProps {
  content: string;
}

export function PlainText({ content }: PlainTextProps) {
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "monospace",
        padding: "1rem",
      }}
    >
      {content}
    </pre>
  );
}
