import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import type { FsEvent } from "../shared/types.ts";

export function useLiveReload() {
  const queryClient = useQueryClient();
  const params = useParams<{ "*": string }>();
  const currentDocPath = params["*"];

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as FsEvent;
      if (event.type === "ready") return;

      // Always invalidate tree (adds/removes/renames change it)
      queryClient.invalidateQueries({ queryKey: ["tree"] });

      // Invalidate open doc if it matches the changed path
      if (
        (event.type === "change" || event.type === "add") &&
        currentDocPath !== undefined &&
        event.path === currentDocPath
      ) {
        queryClient.invalidateQueries({ queryKey: ["doc", currentDocPath] });
      }
    };

    es.onerror = () => {
      // EventSource auto-retries; nothing to do here
    };

    return () => {
      es.close();
    };
  }, [queryClient, currentDocPath]);
}
