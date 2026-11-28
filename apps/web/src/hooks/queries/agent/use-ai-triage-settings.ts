import { useQuery } from "@tanstack/react-query";
import { getAiTriageSettings } from "@/fetchers/agent/ai-triage-settings";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";

export const aiTriageSettingsKey = (workspaceId: string, projectId: string) => [
  "ai-triage-settings",
  workspaceId,
  projectId,
];

/** A team's AI triage guidance and auto-apply setting. */
export function useAiTriageSettings(workspaceId: string, projectId: string) {
  const hasAgent = useHasAgent();
  return useQuery({
    enabled: hasAgent && Boolean(workspaceId && projectId),
    queryKey: aiTriageSettingsKey(workspaceId, projectId),
    queryFn: () => getAiTriageSettings(workspaceId, projectId),
  });
}
