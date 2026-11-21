import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/settings-page";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";

/** Linear's Settings > Teams: every team, opening its settings. */
export function TeamsSettingsPage() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: teams } = useGetProjects({ workspaceId: workspace?.id ?? "" });
  const { canCreateProjects } = useWorkspacePermission();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <SettingsPage
      title={t("settings:teams.title")}
      description={teams?.length === 0 ? t("settings:teams.empty") : undefined}
      actions={
        canCreateProjects() ? (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus />
            {t("settings:teams.create")}
          </Button>
        ) : null
      }
    >
      {teams?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings:teams.columns.name")}</TableHead>
              <TableHead>{t("settings:teams.columns.identifier")}</TableHead>
              <TableHead className="text-right">
                {t("settings:teams.columns.issues")}
              </TableHead>
              <TableHead className="text-right">
                {t("settings:teams.columns.created")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.map((team) => {
              const Icon =
                icons[team.icon as keyof typeof icons] || icons.Layout;
              return (
                <TableRow key={team.id}>
                  <TableCell>
                    <Link
                      to="/dashboard/settings/projects/$projectId/general"
                      params={{ projectId: team.id }}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {team.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {team.slug}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {team.statistics?.totalTasks ?? 0}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDateMedium(team.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : null}
      <CreateProjectModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </SettingsPage>
  );
}
