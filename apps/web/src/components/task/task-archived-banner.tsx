import { ArchiveIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useUnarchiveTask from "@/hooks/mutations/task/use-unarchive-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export default function TaskArchivedBanner({
  taskId,
  archivedAt,
}: {
  taskId: string;
  archivedAt: string;
}) {
  const { t } = useTranslation();
  const { canUpdateTasks } = useWorkspacePermission();
  const restore = useUnarchiveTask();
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-muted-foreground text-[13px]">
      <ArchiveIcon className="size-4 shrink-0" />
      <span className="flex-1">
        {t("tasks:detail.archived.banner", {
          date: new Date(archivedAt).toLocaleDateString(),
        })}
      </span>
      {canUpdateTasks() && (
        <Button
          size="sm"
          variant="ghost"
          disabled={restore.isPending}
          onClick={() => restore.mutate(taskId)}
        >
          {t("tasks:detail.archived.restore")}
        </Button>
      )}
    </div>
  );
}
