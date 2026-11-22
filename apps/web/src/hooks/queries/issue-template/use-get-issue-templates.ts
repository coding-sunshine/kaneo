import { useQuery } from "@tanstack/react-query";
import getIssueTemplates from "@/fetchers/issue-template/get-issue-templates";

function useGetIssueTemplates(projectId: string) {
  return useQuery({
    queryKey: ["issue-templates", projectId],
    queryFn: () => getIssueTemplates({ projectId }),
    enabled: !!projectId,
  });
}

export default useGetIssueTemplates;
