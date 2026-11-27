import { useTranslation } from "react-i18next";
import { useTaskStatusSpans } from "@/hooks/queries/task/use-task-status-spans";
import { formatStatusSpan } from "./format-status-span";

export function StatusTimeList({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useTaskStatusSpans(taskId);

  if (isLoading) return <span>{t("common:empty.loading")}</span>;
  if (isError || !data) return <span>{t("tasks:statusTime.error")}</span>;

  return (
    <div className="flex flex-col gap-1 py-0.5">
      <span className="font-medium">{t("tasks:statusTime.title")}</span>
      <ul className="flex flex-col gap-0.5">
        {data.spans.map((span) => (
          <li key={span.status} className="flex justify-between gap-4">
            <span className="truncate">
              {span.name ?? span.status}
              {span.current && (
                <span className="ms-1 text-muted-foreground">
                  {t("tasks:statusTime.current")}
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {formatStatusSpan(span.totalMs, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
