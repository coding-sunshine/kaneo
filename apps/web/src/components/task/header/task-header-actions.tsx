import type { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { Bell, BellOff, GitBranch, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useToggleTaskSubscription } from "@/hooks/mutations/task/use-toggle-task-subscription";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { HeaderIconButton } from "./header-icon-button";
import { TaskMoreMenu } from "./task-more-menu";
import { useTaskCopyActions } from "./use-task-copy-actions";

type TaskHeaderActionsProps = {
  taskId: string;
  projectId: string;
  workspaceId: string;
  deleteHandle: AlertDialogPrimitive.Handle<unknown>;
};

export function TaskHeaderActions({
  taskId,
  projectId,
  workspaceId,
  deleteHandle,
}: TaskHeaderActionsProps) {
  const { t } = useTranslation();
  const actions = useTaskCopyActions({ taskId, projectId, workspaceId });
  const { data: task } = useGetTask(taskId);
  const { mutate: toggleSubscription } = useToggleTaskSubscription(taskId);
  const subscribed = Boolean(
    task && "isSubscribed" in task && task.isSubscribed,
  );

  return (
    <div className="flex items-center gap-1">
      <HeaderIconButton
        label={t(
          subscribed
            ? "tasks:subscription.unsubscribe"
            : "tasks:subscription.subscribe",
        )}
        onClick={() => toggleSubscription(!subscribed)}
      >
        {subscribed ? <BellOff /> : <Bell />}
      </HeaderIconButton>
      <HeaderIconButton
        label={t("tasks:properties.copyTaskLink")}
        shortcutId="copyTaskUrl"
        onClick={actions.copyLink}
        className="max-sm:hidden"
      >
        <Link2 />
      </HeaderIconButton>
      <HeaderIconButton
        label={t("tasks:properties.copyTaskBranch")}
        shortcutId="copyBranchName"
        onClick={actions.copyBranch}
        className="max-sm:hidden"
      >
        <GitBranch />
      </HeaderIconButton>
      <TaskMoreMenu actions={actions} deleteHandle={deleteHandle} />
    </div>
  );
}
