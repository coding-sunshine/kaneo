import type { TFunction } from "i18next";

/** Days under one show as hours: triage often takes less than a day. */
export function formatDuration(t: TFunction, days: number) {
  return days >= 1
    ? t("tasks:insights.days", { count: Math.round(days) })
    : t("tasks:insights.hours", { count: Math.round(days * 24) });
}
