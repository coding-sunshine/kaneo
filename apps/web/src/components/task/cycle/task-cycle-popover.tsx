import { CirclePlay, Minus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cycleHint,
  orderCyclesForPicker,
} from "@/components/cycle/cycle-options";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskCycle } from "@/hooks/mutations/task/use-update-task-cycle";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

const NONE = "__none__";

type Props = { task: Task; children: ReactNode };

export default function TaskCyclePopover({ task, children }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: cycles = [] } = useGetCycles(task.projectId);
  const { mutateAsync: update } = useUpdateTaskCycle();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  const labels = {
    current: t("tasks:popover.cycle.current"),
    upcoming: t("tasks:popover.cycle.upcoming"),
    previous: t("tasks:popover.cycle.previous"),
  };

  const choose = async (value: string) => {
    setOpen(false);
    const next = value === NONE ? null : value;
    if (next === (task.cycleId ?? null)) return;
    try {
      await update({ task, cycleId: next });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.cycle.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <OptionMenu
          label={t("tasks:properties.cycle")}
          placeholder={t("tasks:popover.cycle.placeholder")}
          inputHint="⇧ C"
          options={[
            {
              value: NONE,
              label: t("tasks:popover.cycle.none"),
              icon: <Minus className="size-3.5 text-muted-foreground" />,
              selected: !task.cycleId,
              pinned: true,
            },
            ...orderCyclesForPicker(cycles).map(({ cycle, state }) => ({
              value: cycle.id,
              label: cycleTitle(cycle),
              icon: <CirclePlay className="text-muted-foreground" />,
              hint: cycleHint(cycle, state, labels),
              selected: task.cycleId === cycle.id,
            })),
          ]}
          onSelect={choose}
        />
      </PopoverContent>
    </Popover>
  );
}
