import { useQuery } from "@tanstack/react-query";
import getTriageResponsibility from "@/fetchers/team-automation/get-triage-responsibility";

export function useTriageResponsibility(projectId: string) {
  return useQuery({
    queryKey: ["triage-responsibility", projectId],
    queryFn: () => getTriageResponsibility(projectId),
    enabled: Boolean(projectId),
  });
}
