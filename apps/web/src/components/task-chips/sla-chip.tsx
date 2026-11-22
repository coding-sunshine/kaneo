import { Flame } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { getSlaStatus, type SlaStatus } from "@/lib/sla-status";
import type Task from "@/types/task";

// Linear's fire icon goes gray, yellow, orange, red as the SLA nears and breaches.
const iconClass: Record<SlaStatus, string> = {
  low: "text-chip-icon",
  achieved: "text-chip-icon",
  medium: "text-yellow-500",
  high: "text-orange-500",
  breached: "text-due-overdue",
  failed: "text-due-overdue",
};

export function SlaChip({
  task,
  showLabel = false,
}: {
  task: Pick<Task, "slaDueAt" | "completedAt">;
  showLabel?: boolean;
}) {
  const { t } = useTranslation();
  const status = getSlaStatus(task);
  if (!status || !task.slaDueAt) return null;

  const label = t(`tasks:sla.${status}`);
  return (
    <span
      role="img"
      aria-label={label}
      title={t("tasks:sla.title", {
        status: label,
        date: formatDateMedium(task.slaDueAt),
      })}
      className="inline-flex shrink-0 items-center gap-1.25 text-xs"
    >
      <Flame className={cn("size-3.5", iconClass[status])} />
      {showLabel && <span className="truncate">{label}</span>}
    </span>
  );
}
