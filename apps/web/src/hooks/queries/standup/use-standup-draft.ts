import { useQuery } from "@tanstack/react-query";
import getStandupDraft from "@/fetchers/standup/get-standup-draft";

// Read fresh each time the dialog opens; the draft is never cached for others.
function useStandupDraft(workspaceId: string, days: 1 | 7, enabled: boolean) {
  return useQuery({
    queryKey: ["standup-draft", workspaceId, days],
    queryFn: () => getStandupDraft(workspaceId, days),
    enabled,
    gcTime: 0,
    refetchOnMount: "always",
  });
}

export default useStandupDraft;
