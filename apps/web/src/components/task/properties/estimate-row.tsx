import { Hexagon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEstimateOptions } from "@/hooks/queries/project/use-estimate-options";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import TaskEstimatePopover from "../task-estimate-popover";
import { PropertyRow } from "./property-row";
import { PropertyValue } from "./property-value";

/** Linear's Estimate row, shown only for teams that use estimates. */
export function EstimateRow({ task }: { task: Task }) {
  const { t } = useTranslation();
  const options = useEstimateOptions(task.projectId);
  if (!options.length) return null;
  const option = options.find((o) => o.value === task.estimate);

  return (
    <PropertyRow label={t("tasks:properties.estimate")}>
      <TaskEstimatePopover task={task}>
        <PropertyValue data-task-action="estimate">
          <Hexagon className="text-muted-foreground" />
          <span className={cn("truncate", !option && "text-muted-foreground")}>
            {option ? option.label : t("tasks:properties.addEstimate")}
          </span>
        </PropertyValue>
      </TaskEstimatePopover>
    </PropertyRow>
  );
}
