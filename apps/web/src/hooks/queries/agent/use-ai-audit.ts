import { useQuery } from "@tanstack/react-query";
import { getAiAudit } from "@/fetchers/agent/proposals";

export const aiAuditKey = (workspaceId: string) => ["ai-audit", workspaceId];

export function useAiAudit(workspaceId: string) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: aiAuditKey(workspaceId),
    queryFn: () => getAiAudit(workspaceId),
  });
}
