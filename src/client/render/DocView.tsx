import { FileX, ServerCrash, Weight } from "lucide-react";
import { useDoc } from "../api.ts";
import { ErrorCard } from "../shell/ErrorCard.tsx";
import { DocSkeleton } from "../shell/LoadingSkeleton.tsx";
import { HtmlView } from "./HtmlView.tsx";
import { ImageView } from "./ImageView.tsx";
import { Markdown } from "./Markdown.tsx";
import { Mdx } from "./Mdx.tsx";
import { PdfView } from "./PdfView.tsx";
import { PlainText } from "./PlainText.tsx";

interface DocViewProps {
  path: string;
}

export function DocView({ path }: DocViewProps) {
  const { data, isLoading, isError } = useDoc(path);

  if (isLoading) {
    return <DocSkeleton />;
  }

  if (isError) {
    return (
      <ErrorCard
        icon={<ServerCrash size={16} />}
        title="Document not found"
        detail="This document may have been deleted or renamed."
      />
    );
  }

  if (!data) {
    return (
      <ErrorCard
        icon={<FileX size={16} />}
        title="No document selected"
        detail="Select a document from the sidebar."
      />
    );
  }

  if (data.tooLarge) {
    return (
      <ErrorCard
        icon={<Weight size={16} />}
        title="File too large to render"
        detail="> 5 MB"
        action={{ label: "Open raw", href: `/api/raw/${path}` }}
      />
    );
  }

  if (data.undecodable) {
    return (
      <ErrorCard
        icon={<FileX size={16} />}
        title="Cannot display file"
        detail="Binary or undecodable content."
        action={{ label: "Open raw", href: `/api/raw/${path}` }}
      />
    );
  }

  const { kind, content } = data;

  if (kind === "mdx") {
    return <Mdx content={content ?? ""} path={path} />;
  }

  if (kind === "md") {
    return <Markdown content={content ?? ""} />;
  }

  if (kind === "txt") {
    return <PlainText content={content ?? ""} />;
  }

  if (kind === "html") {
    return <HtmlView html={content ?? ""} />;
  }

  if (kind === "pdf") {
    return <PdfView path={path} />;
  }

  if (kind === "image") {
    return <ImageView path={path} />;
  }

  return <ErrorCard icon={<FileX size={16} />} title={`Unsupported file type: ${kind}`} />;
}
