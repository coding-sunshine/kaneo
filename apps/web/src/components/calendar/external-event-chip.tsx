import { VideoIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import type { ExternalCalendarEvent } from "@/fetchers/calendar-sync/calendar-sync";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

type ExternalEventChipProps = {
  event: ExternalCalendarEvent;
  className?: string;
};

/** One event from a connected calendar; it opens in that calendar. */
export default function ExternalEventChip({
  event,
  className,
}: ExternalEventChipProps): JSX.Element {
  const { t } = useTranslation();
  const title = event.title || t("tasks:calendar.untitledEvent");
  const time = event.allDay
    ? t("tasks:calendar.allDay")
    : formatDate(event.start, { hour: "numeric", minute: "2-digit" });
  const label = (
    <>
      {!event.allDay && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {time}
        </span>
      )}
      <span className="truncate">{title}</span>
    </>
  );

  return (
    <div
      data-external-event={event.provider}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded-sm border-l-2 border-violet-500/60 bg-violet-500/10 pr-0.5 pl-1 text-[11px] leading-5 text-foreground",
        className,
      )}
    >
      {event.url ? (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer"
          aria-label={t("tasks:calendar.eventAriaLabel", { title, time })}
          className="flex min-w-0 flex-1 items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-1">{label}</span>
      )}
      {event.meetingUrl && (
        <a
          href={event.meetingUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={t("tasks:calendar.joinMeeting")}
          title={t("tasks:calendar.joinMeeting")}
          className="shrink-0 rounded-sm p-0.5 text-violet-700 hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-300"
        >
          <VideoIcon aria-hidden="true" className="size-3" />
        </a>
      )}
    </div>
  );
}
