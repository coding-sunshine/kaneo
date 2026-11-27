import { useTranslation } from "react-i18next";
import { SlaChip } from "@/components/task-chips/sla-chip";
import { formatAge } from "@/lib/format-age";
import type Task from "@/types/task";

/** Queue rows show how long a request has waited next to its SLA state. */
export function SlaAgeChip({
  task,
}: {
  task: Pick<Task, "createdAt" | "slaDueAt" | "completedAt">;
}) {
  const { t, i18n } = useTranslation();
  const age = formatAge(task.createdAt, Date.now(), i18n.language);
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      <span
        title={t("tasks:sla.ageTitle", { age })}
        className="w-10 text-right tabular-nums"
      >
        {age}
      </span>
      <span className="inline-flex w-28 items-center">
        {task.slaDueAt ? (
          <SlaChip task={task} showLabel />
        ) : (
          t("tasks:sla.none")
        )}
      </span>
    </span>
  );
}
