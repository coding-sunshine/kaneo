import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { EstimateSettingsRows } from "@/components/settings/project-general/estimate-settings-rows";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

/** Linear's Team Settings > Estimates page. */
export function ProjectEstimatesSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: project } = useGetTasks(projectId);
  const { canUpdateProjects } = useWorkspacePermission();

  return (
    <>
      <PageTitle title={t("settings:projectGeneral.estimates.title")} />
      <SettingsPage
        title={t("settings:projectGeneral.estimates.title")}
        description={t("settings:projectGeneral.estimates.subtitle")}
      >
        <SettingsCard>
          {project && (
            <EstimateSettingsRows
              project={project}
              workspaceId={workspace?.id ?? ""}
              canEdit={canUpdateProjects()}
            />
          )}
        </SettingsCard>
      </SettingsPage>
    </>
  );
}
