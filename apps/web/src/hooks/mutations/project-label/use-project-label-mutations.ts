import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createProjectLabel,
  deleteProjectLabel,
  setProjectLabelOnProject,
  updateProjectLabel,
} from "@/fetchers/project-label/project-labels";
import { invalidateWorkProjects } from "@/hooks/mutations/work-project/invalidate-work-projects";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["project-labels"] });
    invalidateWorkProjects(queryClient);
  };
}

export function useCreateProjectLabel() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: createProjectLabel, onSuccess: refresh });
}

export function useUpdateProjectLabel() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: updateProjectLabel, onSuccess: refresh });
}

export function useDeleteProjectLabel() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: deleteProjectLabel, onSuccess: refresh });
}

export function useSetProjectLabel() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: setProjectLabelOnProject,
    onSuccess: refresh,
  });
}
