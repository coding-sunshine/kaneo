import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type AiFeatures, setAiFeatures } from "@/fetchers/agent/ai-features";
import { aiFeaturesKey } from "@/hooks/queries/agent/use-ai-features";

export function useSetAiFeatures(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (features: AiFeatures) => setAiFeatures(workspaceId, features),
    onSuccess: (next) =>
      queryClient.setQueryData(aiFeaturesKey(workspaceId), next),
  });
}
