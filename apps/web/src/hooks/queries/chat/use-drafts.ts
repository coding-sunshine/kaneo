import { useQuery } from "@tanstack/react-query";
import { getDrafts } from "@/fetchers/chat/drafts";

export const draftsKey = (workspaceId: string) => ["chat-drafts", workspaceId];

export type ChatDraft = Awaited<ReturnType<typeof getDrafts>>[number];

/** The caller's own unsent drafts in the workspace, newest first. */
export function useDrafts(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: draftsKey(workspaceId),
    queryFn: () => getDrafts(workspaceId),
  });
}
