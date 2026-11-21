import { CirclePlay } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useGetCycles } from "@/hooks/queries/cycle/use-get-cycles";
import { cn } from "@/lib/cn";
import { cycleTitle } from "@/lib/cycle/cycle-label";
import type Task from "@/types/task";
import TaskCyclePopover from "../cycle/task-cycle-popover";
import { PropertyRow } from "./property-row";
import { PropertyValue } from "./property-value";

/** Linear's Cycle row, shown only for teams that have cycles on. */
export function CycleRow({ task }: { task: Task }) {
  const { t } = useTranslation();
  const { data: cycles } = useGetCycles(task.projectId);
  if (!cycles?.length) return null;
  const cycle = cycles.find((c) => c.id === task.cycleId);

  return (
    <PropertyRow label={t("tasks:properties.cycle")}>
      <TaskCyclePopover task={task}>
        <PropertyValue data-task-action="cycle" shortcutId="changeCycle">
          <CirclePlay className="text-muted-foreground" />
          <span className={cn("truncate", !cycle && "text-muted-foreground")}>
            {cycle ? cycleTitle(cycle) : t("tasks:properties.addCycle")}
          </span>
        </PropertyValue>
      </TaskCyclePopover>
    </PropertyRow>
  );
}
