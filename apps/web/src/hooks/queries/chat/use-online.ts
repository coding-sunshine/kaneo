import { useQuery } from "@tanstack/react-query";
import { getOnline } from "@/fetchers/chat/presence";

export const onlineKey = (workspaceId: string) => ["chat-online", workspaceId];

// Heartbeats come every 30 seconds, so poll at the same pace.
const POLL_MS = 30_000;

/**
 * Who is online in the workspace. Only while your own presence is on: you
 * send a heartbeat, and the server shows you the others who turned it on.
 */
export function useOnline(workspaceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryKey: onlineKey(workspaceId),
    queryFn: () => getOnline(workspaceId),
    refetchInterval: POLL_MS,
    select: (data) => new Set(data.online),
  });
}
