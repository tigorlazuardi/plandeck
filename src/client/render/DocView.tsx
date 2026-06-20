import { Skeleton, Text } from "@mantine/core";
import { useDoc } from "../api.ts";
import { Markdown } from "./Markdown.tsx";
import { Mdx } from "./Mdx.tsx";
import { PlainText } from "./PlainText.tsx";

interface DocViewProps {
  path: string;
}

export function DocView({ path }: DocViewProps) {
  const { data, isLoading, isError } = useDoc(path);

  if (isLoading) {
    return (
      <div>
        <Skeleton height={20} mb="sm" />
        <Skeleton height={20} mb="sm" />
        <Skeleton height={20} mb="sm" width="60%" />
      </div>
    );
  }

  if (isError) {
    return (
      <Text c="red" ta="center" mt="xl">
        Failed to load document.
      </Text>
    );
  }

  if (!data) {
    return (
      <Text c="dimmed" ta="center" mt="xl">
        No document selected.
      </Text>
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

  return (
    <Text c="dimmed" ta="center" mt="xl">
      Unsupported: {kind}
    </Text>
  );
}
