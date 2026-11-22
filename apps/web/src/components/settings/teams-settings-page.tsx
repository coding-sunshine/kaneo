import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsPage } from "@/components/settings/settings-page";
import { TeamMembersCount } from "@/components/settings/teams/team-members-count";
import { TeamRowMenu } from "@/components/settings/teams/team-row-menu";
import { buildTeamsCsv } from "@/components/settings/teams/teams-csv";
import CreateProjectModal from "@/components/shared/modals/create-project-modal";
import {
  LeaveTeamDialog,
  type LeavingTeam,
} from "@/components/team/leave-team-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import icons from "@/constants/project-icons";
import useDeleteProject from "@/hooks/mutations/project/use-delete-project";
import useUpdateTeamMembership from "@/hooks/mutations/project/use-update-team-membership";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

type Status = "active" | "archived";

/** Linear's Settings > Teams: every team, with a row menu to leave, join or delete. */
export function TeamsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const [status, setStatus] = useState<Status>("active");
  const [filter, setFilter] = useState("");
  const { data: allTeams } = useGetProjects({
    workspaceId,
    includeArchived: status === "archived",
  });
  const { canCreateProjects, canDeleteProjects } = useWorkspacePermission();
  const { mutate: updateMembership } = useUpdateTeamMembership(workspaceId);
  const { mutateAsync: deleteProject, isPending: isDeleting } =
    useDeleteProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [leaving, setLeaving] = useState<LeavingTeam | null>(null);
  const [deleting, setDeleting] = useState<LeavingTeam | null>(null);

  const query = filter.trim().toLowerCase();
  const teams = allTeams?.filter(
    (team) =>
      Boolean(team.archivedAt) === (status === "archived") &&
      team.name.toLowerCase().includes(query),
  );
  const visibility = (isPublic: boolean | null) =>
    isPublic
      ? t("settings:teams.visibilityPublic")
      : t("settings:teams.visibilityWorkspace");

  const exportCsv = () => {
    const csv = buildTeamsCsv(
      [
        t("settings:teams.columns.name"),
        t("settings:teams.columns.identifier"),
        t("settings:teams.columns.description"),
        t("settings:teams.columns.visibility"),
        t("settings:teams.columns.issues"),
        t("settings:teams.columns.created"),
      ],
      (teams ?? []).map((team) => ({
        name: team.name,
        key: team.slug,
        description: team.description,
        visibility: visibility(team.isPublic),
        issues: team.statistics?.totalTasks ?? 0,
        created: formatDateMedium(team.createdAt),
      })),
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "teams.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteProject({ id: deleting.id });
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:projectGeneral.toastDeleteError"),
      );
    }
  };

  return (
    <SettingsPage
      title={t("settings:teams.title")}
      className="max-w-5xl"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            {t("settings:teams.exportCsv")}
          </Button>
          {canCreateProjects() ? (
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              {t("settings:teams.create")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="-mt-6 flex items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            size="sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("settings:teams.filterPlaceholder")}
            aria-label={t("settings:teams.filterPlaceholder")}
            className="ps-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(next) => setStatus(next as Status)}
        >
          <SelectTrigger
            aria-label={t("settings:teams.statusLabel")}
            className="w-28"
            size="sm"
          >
            <SelectValue>{t(`settings:teams.status.${status}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(["active", "archived"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {t(`settings:teams.status.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {teams?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("settings:teams.columns.name")}</TableHead>
              <TableHead>{t("settings:teams.columns.description")}</TableHead>
              <TableHead>{t("settings:teams.columns.visibility")}</TableHead>
              <TableHead>{t("settings:teams.columns.members")}</TableHead>
              <TableHead>{t("settings:teams.columns.issues")}</TableHead>
              <TableHead>{t("settings:teams.columns.created")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="bg-muted/50 text-xs">
                <span className="font-medium">
                  {t(`settings:teams.status.${status}`)}
                </span>{" "}
                <span className="text-muted-foreground">{teams.length}</span>
              </TableCell>
            </TableRow>
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
                      <span className="font-normal text-muted-foreground">
                        {team.slug}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {team.description}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {visibility(team.isPublic)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    <TeamMembersCount
                      workspaceId={workspaceId}
                      projectId={team.id}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {team.statistics?.totalTasks ?? 0}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateMedium(team.createdAt)}
                  </TableCell>
                  <TableCell>
                    <TeamRowMenu
                      joined={team.membership.joined}
                      canDelete={canDeleteProjects()}
                      onSettings={() =>
                        navigate({
                          to: "/dashboard/settings/projects/$projectId/general",
                          params: { projectId: team.id },
                        })
                      }
                      onLeave={() =>
                        setLeaving({ id: team.id, name: team.name })
                      }
                      onJoin={() =>
                        updateMembership(
                          { projectId: team.id, joined: true },
                          { onError: (error) => toast.error(error.message) },
                        )
                      }
                      onDelete={() =>
                        setDeleting({ id: team.id, name: team.name })
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("settings:teams.empty")}
        </p>
      )}
      <CreateProjectModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <LeaveTeamDialog
        workspaceId={workspaceId}
        team={leaving}
        onClose={() => setLeaving(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("settings:projectGeneral.deleteModalTitle")}
        description={t("settings:projectGeneral.deleteModalDescription", {
          name: deleting?.name,
        })}
        confirmLabel={t("settings:projectGeneral.deleteModalConfirm")}
        pendingLabel={t("common:actions.deleting")}
        pending={isDeleting}
        onConfirm={confirmDelete}
      />
    </SettingsPage>
  );
}
