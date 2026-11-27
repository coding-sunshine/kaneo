import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import { useHasAgent } from "@/hooks/queries/agent/use-agent";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useCanImport } from "@/hooks/use-can-import";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function useSettingsNav() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const { data: config } = useGetConfig();
  const { permissions: adminPermissions } = useAdminAccess();
  const { canImport } = useCanImport();
  const canManageWebhooks = useWorkspacePermission().canManageSettings();
  const canManageAiUsage = useHasAgent() && canManageWebhooks;

  return useMemo(
    () =>
      buildSettingsNav({
        t,
        workspaceName: workspace?.name,
        billingEnabled: Boolean(config?.billingEnabled),
        canImport,
        canManageWebhooks,
        canManageAiUsage,
        adminPermissions,
        // "Your teams" lists only teams you joined, like the app sidebar.
        projects: (projects ?? []).filter(
          (project) => project.membership.joined,
        ),
      }),
    [
      t,
      workspace?.name,
      config?.billingEnabled,
      canImport,
      canManageWebhooks,
      canManageAiUsage,
      adminPermissions,
      projects,
    ],
  );
}
