import { CirclePlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  cycleHint,
  orderCyclesForPicker,
} from "@/components/cycle/cycle-options";
import {
  ContextMenuCheckboxItem,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import { useUpdateTaskCycle } from "@/hooks/mutations/task/use-update-task-cycle";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

/** Cycle entry of the issue context menu; hidden for teams without cycles. */
export function CycleSubmenu({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data: cycles = [] } = useGetCycles(task.projectId);
  const { mutateAsync: update } = useUpdateTaskCycle();
  if (cycles.length === 0) return null;
  const labels = {
    current: t("tasks:popover.cycle.current"),
    upcoming: t("tasks:popover.cycle.upcoming"),
    previous: t("tasks:popover.cycle.previous"),
  };

  const choose = async (cycleId: string | null) => {
    try {
      await update({ task, cycleId });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.cycle.updateError"),
      );
    }
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <CirclePlay className="size-3.5 text-muted-foreground" />
        <span>{t("tasks:properties.cycle")}</span>
        <ContextMenuShortcut>⇧C</ContextMenuShortcut>
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-72 w-60 overflow-y-auto">
        <ContextMenuCheckboxItem
          checked={!task.cycleId}
          onCheckedChange={() => void choose(null)}
          closeOnClick
        >
          {t("tasks:popover.cycle.none")}
        </ContextMenuCheckboxItem>
        {orderCyclesForPicker(cycles).map(({ cycle, state }) => (
          <ContextMenuCheckboxItem
            key={cycle.id}
            checked={task.cycleId === cycle.id}
            onCheckedChange={() => void choose(cycle.id)}
            closeOnClick
          >
            <span className="truncate">{cycleTitle(cycle)}</span>
            <span className="ml-auto text-muted-foreground text-xs">
              {cycleHint(cycle, state, labels)}
            </span>
          </ContextMenuCheckboxItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
