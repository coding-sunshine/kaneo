import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteIssueTemplate from "@/fetchers/issue-template/delete-issue-template";

function useDeleteIssueTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteIssueTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["issue-templates", projectId],
      }),
  });
}

export default useDeleteIssueTemplate;
