import { Hexagon, Minus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskEstimate } from "@/hooks/mutations/task/use-update-task-estimate";
import { useEstimateOptions } from "@/hooks/queries/project/use-estimate-options";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const NONE = "__none__";

type Props = { task: Task; children: ReactNode };

export default function TaskEstimatePopover({ task, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const options = useEstimateOptions(task.projectId);
  const { mutateAsync: update } = useUpdateTaskEstimate();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  const choose = async (value: string) => {
    setOpen(false);
    const estimate = value === NONE ? null : Number(value);
    if (estimate === (task.estimate ?? null)) return;
    try {
      await update({ ...task, estimate });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.estimate.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:properties.estimate")}
          placeholder={t("tasks:popover.estimate.placeholder")}
          options={[
            {
              value: NONE,
              label: t("tasks:popover.estimate.none"),
              icon: <Minus className="size-3.5 text-muted-foreground" />,
              selected: task.estimate == null,
              pinned: true,
            },
            ...options.map((option) => ({
              value: String(option.value),
              label: option.label,
              icon: <Hexagon className="text-muted-foreground" />,
              selected: task.estimate === option.value,
            })),
          ]}
          onSelect={choose}
        />
      </PopoverContent>
    </Popover>
  );
}
