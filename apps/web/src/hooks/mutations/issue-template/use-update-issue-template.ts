import { useMutation, useQueryClient } from "@tanstack/react-query";
import updateIssueTemplate from "@/fetchers/issue-template/update-issue-template";

function useUpdateIssueTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateIssueTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["issue-templates", projectId],
      }),
  });
}

export default useUpdateIssueTemplate;
