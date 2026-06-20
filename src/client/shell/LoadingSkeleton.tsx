import { Skeleton, Stack } from "@mantine/core";

export function DocSkeleton() {
  return (
    <Stack gap="sm" mt="md" data-testid="doc-skeleton">
      <Skeleton height={24} width="60%" />
      <Skeleton height={16} />
      <Skeleton height={16} />
      <Skeleton height={16} width="80%" />
      <Skeleton height={16} />
      <Skeleton height={16} width="90%" />
      <Skeleton height={16} width="70%" />
    </Stack>
  );
}

export function TreeSkeleton() {
  return (
    <Stack gap="xs" data-testid="tree-skeleton">
      <Skeleton height={14} width="80%" />
      <Skeleton height={14} width="65%" />
      <Skeleton height={14} width="75%" />
      <Skeleton height={14} width="55%" />
      <Skeleton height={14} width="70%" />
    </Stack>
  );
}
