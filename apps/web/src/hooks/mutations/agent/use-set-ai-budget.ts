import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AiBudget, setAiBudget } from "@/fetchers/agent/ai-usage";
import { aiUsageKey } from "@/hooks/queries/agent/use-ai-usage";

export function useSetAiBudget(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budget: AiBudget) => setAiBudget(workspaceId, budget),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiUsageKey(workspaceId) }),
  });
}
