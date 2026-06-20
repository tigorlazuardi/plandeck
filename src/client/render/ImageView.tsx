import { Anchor, Text } from "@mantine/core";

interface ImageViewProps {
  path: string;
}

/**
 * Renders an image via /api/raw/<path>.
 * On load error shows a placeholder card with a raw link fallback.
 */
export function ImageView({ path }: ImageViewProps) {
  function handleError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    img.style.display = "none";
    const placeholder = img.nextElementSibling as HTMLElement | null;
    if (placeholder) {
      placeholder.style.display = "flex";
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <img
        src={`/api/raw/${path}`}
        alt={path}
        onError={handleError}
        style={{ maxWidth: "100%", display: "block" }}
      />
      <div
        style={{
          display: "none",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem",
          border: "1px solid var(--mantine-color-gray-3)",
          borderRadius: "8px",
          gap: "0.5rem",
        }}
      >
        <Text c="dimmed" ta="center">
          Couldn&apos;t display this file.
        </Text>
        <Anchor href={`/api/raw/${path}`} target="_blank" rel="noopener noreferrer">
          Open raw file
        </Anchor>
      </div>
    </div>
  );
}
