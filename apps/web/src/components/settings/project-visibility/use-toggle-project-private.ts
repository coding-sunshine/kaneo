import { useQueryClient } from "@tanstack/react-query";
import { LockIcon } from "lucide-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import useUpdateProject from "@/hooks/mutations/project/use-update-project";
import { toast } from "@/lib/toast";
import type { Project } from "@/types/project";

export function useToggleProjectPrivate(
  project: Project | undefined,
  workspaceId: string | undefined,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: updateProject } = useUpdateProject();
  const savingRef = useRef(false);

  return useCallback(async () => {
    if (!project || savingRef.current) return;
    savingRef.current = true;

    try {
      await updateProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description || "",
        icon: project.icon || "Layout",
        isPublic: Boolean(project.isPublic),
        isPrivate: !project.isPrivate,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
        queryClient.invalidateQueries({
          queryKey: ["projects", workspaceId, project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["private-team-members", workspaceId],
        }),
      ]);
      toast.success(t("settings:projectVisibility.toastUpdated"), {
        icon: LockIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectVisibility.toastUpdateError"),
      );
    } finally {
      savingRef.current = false;
    }
  }, [project, updateProject, queryClient, workspaceId, t]);
}
