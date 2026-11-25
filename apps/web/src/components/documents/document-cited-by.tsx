import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { DocumentDetail } from "@/fetchers/document/documents";

type DocumentCitedByProps = {
  document: Pick<DocumentDetail, "workspaceId" | "citedBy">;
};

/** One line under the status: the issues that link to this document. */
export function DocumentCitedBy({ document }: DocumentCitedByProps) {
  const { t } = useTranslation();
  const { workspaceId, citedBy } = document;
  if (!citedBy.length) return null;
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-border/60 border-b px-4 py-1.5 text-muted-foreground text-xs">
      <span>
        {t("navigation:documents.citedBy", { count: citedBy.length })}
      </span>
      {citedBy.map((task) => (
        <Link
          key={task.id}
          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
          params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
          title={task.title}
          className="max-w-64 truncate font-medium text-foreground underline underline-offset-2"
        >
          {task.number === null
            ? task.title
            : `${task.projectSlug.toUpperCase()}-${task.number}`}
        </Link>
      ))}
    </div>
  );
}
