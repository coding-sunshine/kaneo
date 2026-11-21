import { Minus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import { WorkProjectIcon } from "@/components/work-project/work-project-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskWorkProject } from "@/hooks/mutations/task/use-update-task-work-project";
import { useGetWorkProjects } from "@/hooks/queries/work-project/use-get-work-projects";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const NONE = "__none__";

type Props = { task: Task; workspaceId: string; children: ReactNode };

export default function TaskWorkProjectPopover({
  task,
  workspaceId,
  children,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useGetWorkProjects(workspaceId);
  const { mutateAsync: update } = useUpdateTaskWorkProject();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  const choose = async (value: string) => {
    setOpen(false);
    const next = value === NONE ? null : value;
    if (next === (task.workProjectId ?? null)) return;
    try {
      await update({ task, workProjectId: next });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.workProject.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:properties.workProject")}
          placeholder={t("tasks:popover.workProject.placeholder")}
          options={[
            {
              value: NONE,
              label: t("tasks:popover.workProject.none"),
              icon: <Minus className="size-3.5 text-muted-foreground" />,
              selected: !task.workProjectId,
              pinned: true,
            },
            ...projects.map((project) => ({
              value: project.id,
              label: project.name,
              icon: (
                <WorkProjectIcon icon={project.icon} color={project.color} />
              ),
              selected: task.workProjectId === project.id,
            })),
          ]}
          onSelect={choose}
        />
      </PopoverContent>
    </Popover>
  );
}
