import { Minus, Milestone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskWorkProject } from "@/hooks/mutations/task/use-update-task-work-project";
import { useGetWorkProject } from "@/hooks/queries/work-project/use-get-work-project";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const NONE = "__none__";

type Props = { task: Task; children: ReactNode };

/** Only meaningful while the issue has a project; the caller guards that. */
export default function TaskMilestonePopover({ task, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: project } = useGetWorkProject(task.workProjectId ?? "");
  const { mutateAsync: update } = useUpdateTaskWorkProject();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks() || !task.workProjectId) return <>{children}</>;

  const choose = async (value: string) => {
    setOpen(false);
    const next = value === NONE ? null : value;
    if (next === (task.workProjectMilestoneId ?? null)) return;
    try {
      await update({
        task,
        workProjectId: task.workProjectId ?? null,
        workProjectMilestoneId: next,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.milestone.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:properties.milestone")}
          placeholder={t("tasks:popover.milestone.placeholder")}
          options={[
            {
              value: NONE,
              label: t("tasks:popover.milestone.none"),
              icon: <Minus className="size-3.5 text-muted-foreground" />,
              selected: !task.workProjectMilestoneId,
              pinned: true,
            },
            ...(project?.milestones ?? []).map((milestone) => ({
              value: milestone.id,
              label: milestone.name,
              icon: <Milestone className="size-3.5 text-muted-foreground" />,
              selected: task.workProjectMilestoneId === milestone.id,
            })),
          ]}
          onSelect={choose}
        />
      </PopoverContent>
    </Popover>
  );
}
