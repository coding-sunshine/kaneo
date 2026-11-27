import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AiDestinationChoice,
  setAiDestination,
} from "@/fetchers/agent/ai-destination";
import { aiAuditKey } from "@/hooks/queries/agent/use-ai-audit";
import { aiDestinationKey } from "@/hooks/queries/agent/use-ai-destination";

export function useSetAiDestination(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (choice: AiDestinationChoice) =>
      setAiDestination(workspaceId, choice),
    onSuccess: (destination) => {
      queryClient.setQueryData(aiDestinationKey(workspaceId), destination);
      return queryClient.invalidateQueries({
        queryKey: aiAuditKey(workspaceId),
      });
    },
  });
}
