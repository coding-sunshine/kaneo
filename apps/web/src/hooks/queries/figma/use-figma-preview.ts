import { useQuery } from "@tanstack/react-query";
import getFigmaPreview from "@/fetchers/figma/get-figma-preview";

export const figmaPreviewKey = (workspaceId: string, url: string) =>
  ["figma-preview", workspaceId, url] as const;

export default function useFigmaPreview(workspaceId: string, url: string) {
  return useQuery({
    queryKey: figmaPreviewKey(workspaceId, url),
    queryFn: () => getFigmaPreview({ workspaceId, url }),
    enabled: Boolean(workspaceId && url),
    // The server keeps the card until someone refreshes it.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
