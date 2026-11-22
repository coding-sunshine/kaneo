import { useQuery } from "@tanstack/react-query";
import { getWorkspaceWebhooks } from "@/fetchers/workspace-webhook/get-workspace-webhooks";

export const workspaceWebhooksKey = (workspaceId: string) =>
  ["workspace-webhooks", workspaceId] as const;

export default function useWorkspaceWebhooks(workspaceId: string) {
  return useQuery({
    queryKey: workspaceWebhooksKey(workspaceId),
    queryFn: () => getWorkspaceWebhooks(workspaceId),
    enabled: Boolean(workspaceId),
  });
}
