import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import getTask from "@/fetchers/task/get-task";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

/** The status of the issue a checklist line links to. */
export function TaskItemIssueStatus({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { data: task } = useQuery({
    queryKey: ["task", taskId, "kaneo-issue-link"],
    queryFn: () => getTask(taskId),
    staleTime: 1000 * 60,
    retry: false,
  });
  if (!task?.status) return null;
  const status = getStatusDisplayLabel(task.status);
  return (
    <span
      contentEditable={false}
      className="ml-2 shrink-0 select-none text-muted-foreground text-xs"
    >
      <span className="sr-only">
        {t("navigation:documents.checklist.status", { status })}
      </span>
      <span aria-hidden="true">{status}</span>
    </span>
  );
}
