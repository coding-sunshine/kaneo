import { useMutation, useQueryClient } from "@tanstack/react-query";
import createIssueTemplate from "@/fetchers/issue-template/create-issue-template";

function useCreateIssueTemplate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createIssueTemplate,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["issue-templates", projectId],
      }),
  });
}

export default useCreateIssueTemplate;
