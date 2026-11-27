import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideProposal } from "@/fetchers/agent/proposals";
import { agentChatKey } from "@/hooks/queries/agent/use-agent";
import { aiAuditKey } from "@/hooks/queries/agent/use-ai-audit";

/** Accepts or declines one proposal of a chat, then rereads the chat. */
export function useDecideProposal(workspaceId: string, chatId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proposalId: string;
      decision: "accept" | "decline";
    }) => decideProposal(workspaceId, input.proposalId, input.decision),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: agentChatKey(workspaceId, chatId),
        }),
        queryClient.invalidateQueries({ queryKey: aiAuditKey(workspaceId) }),
      ]),
  });
}
