import { ImageOff } from "lucide-react";
import { useState } from "react";
import { ErrorCard } from "../shell/ErrorCard.tsx";

interface ImageViewProps {
  path: string;
}

/**
 * Renders an image via /api/raw/<path>.
 * On load error shows an ErrorCard fallback with a raw link.
 */
export function ImageView({ path }: ImageViewProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <ErrorCard
        icon={<ImageOff size={16} />}
        title="Image failed to load"
        detail="The file could not be displayed."
        action={{ label: "Open raw", href: `/api/raw/${path}` }}
      />
    );
  }

  return (
    <img
      src={`/api/raw/${path}`}
      alt={path}
      onError={() => setFailed(true)}
      style={{ maxWidth: "100%", display: "block" }}
    />
  );
}
