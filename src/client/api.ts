import { useQuery } from "@tanstack/react-query";
import type { DocResponse, TreeResponse } from "../shared/types.ts";

export async function fetchTree(): Promise<TreeResponse> {
  const res = await fetch("/api/tree");
  if (!res.ok) throw new Error("Failed to fetch tree");
  return res.json() as Promise<TreeResponse>;
}

export async function fetchDoc(path: string): Promise<DocResponse> {
  const res = await fetch(`/api/doc/${path}`);
  if (!res.ok) throw new Error(`Failed to fetch doc: ${path}`);
  return res.json() as Promise<DocResponse>;
}

export function useTree() {
  return useQuery<TreeResponse>({
    queryKey: ["tree"],
    queryFn: fetchTree,
  });
}

export function useDoc(path: string) {
  return useQuery<DocResponse>({
    queryKey: ["doc", path],
    queryFn: () => fetchDoc(path),
    enabled: Boolean(path),
  });
}
