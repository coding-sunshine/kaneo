import { useQuery } from "@tanstack/react-query";
import { getChat, getChats } from "@/fetchers/agent/agent";
import useGetConfig from "@/hooks/queries/config/use-get-config";

export const agentChatsKey = (workspaceId: string) => [
  "agent-chats",
  workspaceId,
];
export const agentChatKey = (workspaceId: string, chatId: string) => [
  "agent-chat",
  workspaceId,
  chatId,
];

/** The Agent and Loops UI exist only when the server has a model key. */
export function useHasAgent() {
  const { data } = useGetConfig();
  return Boolean(data?.hasAgent);
}

export function useAgentChats(workspaceId: string) {
  const enabled = useHasAgent() && Boolean(workspaceId);
  return useQuery({
    enabled,
    queryKey: agentChatsKey(workspaceId),
    queryFn: () => getChats(workspaceId),
  });
}

export function useAgentChat(workspaceId: string, chatId: string | undefined) {
  return useQuery({
    enabled: Boolean(chatId),
    queryKey: agentChatKey(workspaceId, chatId ?? ""),
    queryFn: () => getChat(workspaceId, chatId ?? ""),
  });
}
