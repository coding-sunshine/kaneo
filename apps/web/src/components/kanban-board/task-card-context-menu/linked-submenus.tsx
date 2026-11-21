import { useNavigate } from "@tanstack/react-router";
import {
  AlarmClock,
  Ban,
  Box,
  Copy,
  ExternalLink,
  Link2,
  Minus,
  OctagonMinus,
  Unlink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSnoozeOptions } from "@/components/inbox/snooze";
import { findParentRelation } from "@/components/task/task-relation-link";
import {
  type RelationPickerMode,
  useRelationPickerStore,
} from "@/components/task/task-relation-picker-store";
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { WorkProjectIcon } from "@/components/work-project/work-project-icon";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import { useSnoozeTask } from "@/hooks/mutations/task/use-snooze-task";
import { useUpdateTaskWorkProject } from "@/hooks/mutations/task/use-update-task-work-project";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type Props = { task: Task; workspaceId: string };

const failed = (error: unknown, fallback: string) =>
  toast.error(error instanceof Error ? error.message : fallback);

export function ProjectSubmenu({ task, workspaceId }: Props) {
  const { t } = useTranslation();
  const { data: projects = [] } = useGetWorkProjects(workspaceId);
  const { mutateAsync: update } = useUpdateTaskWorkProject();
  const choose = (workProjectId: string | null) =>
    update({ task, workProjectId }).catch((error) =>
      failed(error, t("tasks:popover.workProject.updateError")),
    );

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Box className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:properties.workProject")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuCheckboxItem
          checked={!task.workProjectId}
          onCheckedChange={() => choose(null)}
          closeOnClick
        >
          <Minus className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:popover.workProject.none")}</span>
        </ContextMenuCheckboxItem>
        {projects.map((project) => (
          <ContextMenuCheckboxItem
            key={project.id}
            checked={task.workProjectId === project.id}
            onCheckedChange={() => choose(project.id)}
            closeOnClick
          >
            <WorkProjectIcon icon={project.icon} color={project.color} />
            <span className="truncate">{project.name}</span>
          </ContextMenuCheckboxItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

/** Opens the issue and queues the relation picker, which the task view consumes on mount. */
function useOpenRelationPicker(task: Task) {
  const navigate = useNavigate();
  const open = useRelationPickerStore((state) => state.open);
  return (mode: RelationPickerMode) => {
    open(task.id, mode);
    navigate({ to: ".", search: { taskId: task.id } });
  };
}

const RELATED_ITEMS = [
  { mode: "related", key: "related", Icon: Link2 },
  { mode: "blocks", key: "blocks", Icon: OctagonMinus },
  { mode: "blockedBy", key: "blockedBy", Icon: Ban },
] as const;

export function CreateRelatedSubmenu({ task }: { task: Task }) {
  const { t } = useTranslation();
  const pick = useOpenRelationPicker(task);
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Link2 className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.createRelated")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        {RELATED_ITEMS.map(({ mode, key, Icon }) => (
          <ContextMenuItem key={mode} onClick={() => pick(mode)}>
            <Icon className="size-3.5 text-muted-foreground" />
            <span>{t(`tasks:relations.${key}`)}</span>
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function MarkAsSubmenu({ task }: { task: Task }) {
  const { t } = useTranslation();
  const pick = useOpenRelationPicker(task);
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Copy className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.markAs")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuItem onClick={() => pick("duplicate")}>
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:contextMenu.markAsDuplicate")}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => pick("blockedBy")}>
          <Ban className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:relations.blockedBy")}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => pick("blocks")}>
          <OctagonMinus className="size-3.5 text-muted-foreground" />
          <span>{t("tasks:relations.blocks")}</span>
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function RemoveSubmenu({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data: relations = [] } = useGetTaskRelations(task.id);
  const { mutateAsync: removeRelation } = useDeleteTaskRelation(task.id);
  const { mutateAsync: update } = useUpdateTaskWorkProject();
  const parent = findParentRelation(task.id, relations);
  if (!parent && !task.workProjectId) return null;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Unlink className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.remove")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        {parent && (
          <ContextMenuItem
            onClick={() =>
              removeRelation(parent.id).catch((error) =>
                failed(error, t("tasks:relations.linkError")),
              )
            }
          >
            <span>{t("tasks:contextMenu.removeParent")}</span>
          </ContextMenuItem>
        )}
        {task.workProjectId && (
          <ContextMenuItem
            onClick={() =>
              update({ task, workProjectId: null }).catch((error) =>
                failed(error, t("tasks:popover.workProject.updateError")),
              )
            }
          >
            <span>{t("tasks:contextMenu.removeProject")}</span>
          </ContextMenuItem>
        )}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function OpenInItem({ link }: { link: () => string }) {
  const { t } = useTranslation();
  return (
    <ContextMenuItem onClick={() => window.open(link(), "_blank", "noopener")}>
      <ExternalLink className="size-3.5 text-muted-foreground" />
      <span>{t("tasks:contextMenu.openInNewTab")}</span>
    </ContextMenuItem>
  );
}

export function RemindMeSubmenu({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { mutateAsync: snooze } = useSnoozeTask(task.projectId);
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <AlarmClock className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:contextMenu.remindMe")}</span>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        {getSnoozeOptions().map((option) => (
          <ContextMenuItem
            key={option.id}
            onClick={() =>
              snooze({
                taskId: task.id,
                snoozedUntil: option.date.toISOString(),
              }).catch((error) => failed(error, t("tasks:update.error")))
            }
          >
            <span>{option.label}</span>
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
