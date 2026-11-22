import { useMutation } from "@tanstack/react-query";
import createProject from "@/fetchers/project/create-project";

function useCreateProject({
  name,
  slug,
  workspaceId,
  icon,
  copySettingsFromProjectId,
}: {
  name: string;
  slug: string;
  workspaceId: string;
  icon: string;
  copySettingsFromProjectId?: string;
}) {
  return useMutation({
    mutationFn: () =>
      createProject({
        name,
        slug,
        workspaceId,
        icon,
        copySettingsFromProjectId,
      }),
  });
}

export default useCreateProject;
