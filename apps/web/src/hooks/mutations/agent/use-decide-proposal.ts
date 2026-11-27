import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideProposal } from "@/fetchers/agent/proposals";
import { agentChatKey } from "@/hooks/queries/agent/use-agent";
import { agentDraftsKey } from "@/hooks/queries/agent/use-agent-drafts";
import { aiAuditKey } from "@/hooks/queries/agent/use-ai-audit";

/**
 * Accepts or declines one proposal, then rereads where it came from: its
 * chat, or, for a loop's draft, the drafts and the project updates.
 */
export function useDecideProposal(workspaceId: string, chatId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proposalId: string;
      decision: "accept" | "decline";
    }) => decideProposal(workspaceId, input.proposalId, input.decision),
    onSettled: () =>
      Promise.all([
        ...(chatId
          ? [
              queryClient.invalidateQueries({
                queryKey: agentChatKey(workspaceId, chatId),
              }),
            ]
          : [
              queryClient.invalidateQueries({
                queryKey: agentDraftsKey(workspaceId),
              }),
              queryClient.invalidateQueries({ queryKey: ["work-projects"] }),
            ]),
        queryClient.invalidateQueries({ queryKey: aiAuditKey(workspaceId) }),
      ]),
  });
}
