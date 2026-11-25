import { Link } from "@tanstack/react-router";
import { Box, Building2, CircleDot, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DocumentSummary } from "@/fetchers/document/documents";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

const crumb =
  "flex min-w-0 items-center gap-1.5 truncate rounded px-1 py-0.5 text-card-foreground text-xs hover:bg-accent/60 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/** The first breadcrumb on a document: where it lives, linking there. */
export function DocumentParentLink({
  document,
}: {
  document: Pick<
    DocumentSummary,
    | "workspaceId"
    | "scope"
    | "projectId"
    | "workProjectId"
    | "taskId"
    | "parentName"
  >;
}) {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: task } = useGetTask(document.taskId ?? "");
  const workspaceId = document.workspaceId;
  const name = document.parentName ?? "";

  // A document shared by name can sit in a team the reader cannot enter. The
  // API leaves that team unnamed, so there is no team crumb to show.
  if (document.scope === "team" && document.projectId && document.parentName) {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/board"
        params={{ workspaceId, projectId: document.projectId }}
        className={crumb}
      >
        <Users aria-hidden />
        {name}
      </Link>
    );
  }
  if (document.scope === "project" && document.workProjectId) {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/work-projects/$workProjectId"
        params={{ workspaceId, workProjectId: document.workProjectId }}
        className={crumb}
      >
        <Box aria-hidden />
        {name}
      </Link>
    );
  }
  if (document.scope === "issue" && task) {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
        className={crumb}
      >
        <CircleDot aria-hidden />
        {name}
      </Link>
    );
  }
  if (document.scope === "private") {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/documents/$tab"
        params={{ workspaceId, tab: "my-documents" }}
        className={crumb}
      >
        <Lock aria-hidden />
        {t("navigation:documents.scopes.private")}
      </Link>
    );
  }
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/documents"
      params={{ workspaceId }}
      className={crumb}
    >
      <Building2 aria-hidden />
      {workspace?.name ?? t("navigation:documents.scopes.workspace")}
    </Link>
  );
}
