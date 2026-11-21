import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  FolderInput,
  Link2,
  MoreHorizontal,
  Pencil,
  Tag,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  clickTaskAction,
  focusTaskAction,
  type TaskActionName,
  whenTaskActionReady,
} from "@/components/task/task-action-target";
import { useTaskCopyActions } from "@/components/task/header/use-task-copy-actions";
import getColumns from "@/fetchers/column/get-columns";
import useAttachLabelToTask from "@/hooks/mutations/label/use-attach-label-to-task";
import useDetachLabelFromTask from "@/hooks/mutations/label/use-detach-label-from-task";
import { useMoveTask } from "@/hooks/mutations/task/use-move-task";
import { useToggleTaskSubscription } from "@/hooks/mutations/task/use-toggle-task-subscription";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { getTaskLabelOptions } from "@/lib/get-task-label-options";
import { resolveLabelColor } from "@/lib/label-color";
import { statusCategory } from "@/lib/status-category";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type Props = { task: Task; workspaceId: string };

export function LabelsSubmenu({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { data: taskLabels = [] } = useGetLabelsByTask(task.id);
  const { mutateAsync: attach } = useAttachLabelToTask();
  const { mutateAsync: detach } = useDetachLabelFromTask();
  const assigned = new Set(taskLabels.map((label) => label.name));

  const toggle = async (labelId: string) => {
    const label = workspaceLabels.find((l) => l.id === labelId);
    if (!label) return;
    try {
      if (assigned.has(label.name)) {
        const own = taskLabels.find((l) => l.name === label.name);
        if (own?.id) await detach({ labelId: own.id });
      } else if (label.taskId === null) {
        await attach({ labelId: label.id, taskId: task.id });
      }
      await queryClient.invalidateQueries({
        queryKey: ["tasks", task.projectId],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.labels.updateError"),
      );
    }
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Tag className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:properties.labels")}</span>
        <ContextMenuShortcut>L</ContextMenuShortcut>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 w-48 overflow-y-auto">
        {getTaskLabelOptions(workspaceLabels, task.id).map((label) => (
          <ContextMenuCheckboxItem
            key={label.id}
            checked={assigned.has(label.name)}
            onCheckedChange={() => void toggle(label.id)}
            closeOnClick
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: resolveLabelColor(label.color) }}
            />
            <span className="truncate">{label.name}</span>
          </ContextMenuCheckboxItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function CopySubmenu({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const copy = useTaskCopyActions({
    taskId: task.id,
    projectId: task.projectId,
    workspaceId,
  });
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Link2 className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.copy")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-52">
        <ContextMenuItem onClick={copy.copyLink}>
          {t("tasks:contextMenu.copyLink")}
        </ContextMenuItem>
        <ContextMenuItem onClick={copy.copyId}>
          {t("tasks:contextMenu.copyId")}
        </ContextMenuItem>
        <ContextMenuItem onClick={copy.copyTitle}>
          {t("tasks:contextMenu.copyTitle")}
        </ContextMenuItem>
        <ContextMenuItem onClick={copy.copyBranch}>
          {t("tasks:contextMenu.copyBranch")}
        </ContextMenuItem>
        <ContextMenuItem onClick={copy.copyMarkdown}>
          {t("tasks:contextMenu.copyMarkdown")}
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function MoveSubmenu({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { mutateAsync: moveTask } = useMoveTask();
  const destinations = projects.filter((p) => p.id !== task.projectId);
  if (destinations.length === 0) return null;

  const move = async (projectId: string) => {
    const columns = await queryClient
      .fetchQuery({
        queryKey: ["columns", projectId],
        queryFn: () => getColumns(projectId),
        staleTime: 0,
      })
      .catch(() => []);
    // Keep the status when the destination workflow has it; else its first open column.
    const status =
      columns.find((c) => c.slug === task.status)?.slug ??
      columns.find(
        (c) => statusCategory({ id: c.slug, isFinal: c.isFinal }) !== "triage",
      )?.slug;
    if (!status) return;
    await moveTask({
      taskId: task.id,
      destinationProjectId: projectId,
      destinationStatus: status,
    }).catch(() => null);
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <FolderInput className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.move")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 w-48 overflow-y-auto">
        {destinations.map((project) => (
          <ContextMenuItem
            key={project.id}
            onClick={() => void move(project.id)}
          >
            <span className="truncate">{project.name}</span>
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function SubscribeItem({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data } = useGetTask(task.id);
  const { mutate } = useToggleTaskSubscription(task.id);
  const subscribed = Boolean(
    data && "isSubscribed" in data && data.isSubscribed,
  );
  const Icon = subscribed ? BellOff : Bell;
  return (
    <ContextMenuItem onClick={() => mutate(!subscribed)}>
      <Icon className="size-3.5 text-muted-foreground" />
      <span>
        {t(
          subscribed
            ? "tasks:subscription.unsubscribe"
            : "tasks:subscription.subscribe",
        )}
      </span>
      <ContextMenuShortcut>⇧S</ContextMenuShortcut>
    </ContextMenuItem>
  );
}

/** Linear's "More properties": what Kaneo can back (rename and add link; no estimates). */
export function MorePropertiesSubmenu({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = (action: TaskActionName, run: (n: TaskActionName) => void) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId: task.projectId, taskId: task.id },
    });
    whenTaskActionReady(action, run);
  };
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <MoreHorizontal className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.moreProperties")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuItem onClick={() => open("title", focusTaskAction)}>
          <Pencil className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:contextMenu.rename")}</span>
          <ContextMenuShortcut>⇧ R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => open("addLink", clickTaskAction)}>
          <Link2 className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:contextMenu.addLink")}</span>
          <ContextMenuShortcut>Ctrl L</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
