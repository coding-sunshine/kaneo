import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { ExternalCalendarEvent } from "@/fetchers/calendar-sync/calendar-sync";
import ExternalEventChip from "./external-event-chip";

type CalendarDayEventsProps = {
  events: readonly ExternalCalendarEvent[];
  max?: number;
};

/** A day's events from connected calendars, capped so the cell keeps its size. */
export default function CalendarDayEvents({
  events,
  max = events.length,
}: CalendarDayEventsProps): JSX.Element | null {
  const { t } = useTranslation();
  if (events.length === 0) return null;
  const hidden = events.length - max;

  return (
    <ul className="flex min-w-0 flex-col gap-0.5">
      {events.slice(0, max).map((event) => (
        <li key={`${event.provider}:${event.id}`} className="min-w-0">
          <ExternalEventChip event={event} />
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-1 text-[11px] text-muted-foreground">
          {t("tasks:calendar.moreEvents", { count: hidden })}
        </li>
      )}
    </ul>
  );
}
