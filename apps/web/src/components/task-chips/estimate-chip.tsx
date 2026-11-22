import { Hexagon } from "lucide-react";
import { useTranslation } from "react-i18next";
import TaskEstimatePopover from "@/components/task/task-estimate-popover";
import { useEstimateOptions } from "@/hooks/queries/project/use-estimate-options";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import { stopCardEvents } from "./stop-card-events";
import { taskChipClass } from "./task-chip-class";

/** Estimate points, shown only on issues that have one in an estimating team. */
export function EstimateChip({ task }: { task: Task }) {
  const { t } = useTranslation();
  const options = useEstimateOptions(task.projectId);
  const showEstimate = useUserPreferencesStore((s) => s.showEstimate);
  const option = options.find((o) => o.value === task.estimate);
  if (!option || !showEstimate) return null;
  const label = `${t("tasks:properties.estimate")}: ${option.label}`;

  return (
    <TaskEstimatePopover task={task}>
      <button
        type="button"
        aria-label={label}
        title={label}
        className={taskChipClass}
        {...stopCardEvents}
      >
        <Hexagon className="text-chip-icon" />
        {option.label}
      </button>
    </TaskEstimatePopover>
  );
}
