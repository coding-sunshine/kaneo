import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideProposal } from "@/fetchers/agent/proposals";
import { agentChatKey } from "@/hooks/queries/agent/use-agent";
import { agentDraftsKey } from "@/hooks/queries/agent/use-agent-drafts";
import { taskDelegationsKey } from "@/hooks/queries/agent/use-task-delegations";
import { taskProposalsKey } from "@/hooks/queries/agent/use-task-proposals";
import { aiAuditKey } from "@/hooks/queries/agent/use-ai-audit";

/**
 * Accepts or declines one proposal, then rereads where it came from: its
 * chat, its ticket, or, for a loop's draft, the drafts and the project updates.
 */
export function useDecideProposal(
  workspaceId: string,
  chatId?: string,
  taskId?: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proposalId: string;
      decision: "accept" | "decline";
      fields?: string[];
      customFields?: { fieldId: string; value: string }[];
    }) =>
      decideProposal(
        workspaceId,
        input.proposalId,
        input.decision,
        input.fields,
        input.customFields,
      ),
    onSettled: () =>
      Promise.all([
        ...(taskId
          ? [
              queryClient.invalidateQueries({
                queryKey: taskProposalsKey(workspaceId, taskId),
              }),
              queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
              queryClient.invalidateQueries({
                queryKey: ["activities", taskId],
              }),
              queryClient.invalidateQueries({
                queryKey: taskDelegationsKey(workspaceId, taskId),
              }),
            ]
          : []),
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
