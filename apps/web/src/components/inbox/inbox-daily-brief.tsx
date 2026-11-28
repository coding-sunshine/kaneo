import { Link } from "@tanstack/react-router";
import { Hash, SquareCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DailyBrief } from "@/fetchers/daily-brief/daily-brief";
import { useBrief } from "@/hooks/queries/daily-brief/use-daily-brief";

type Ticket = DailyBrief["dueToday"][number];

const rowClass =
  "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60";

function TicketLink({
  workspaceId,
  ticket,
  status,
}: {
  workspaceId: string;
  ticket: Ticket;
  status?: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: ticket.projectId, taskId: ticket.id }}
      className={rowClass}
    >
      <SquareCheck aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="shrink-0 font-mono text-muted-foreground text-xs">
        {ticket.ticket}
      </span>
      <span className="truncate">{ticket.title}</span>
      {status && (
        <span className="shrink-0 rounded bg-muted px-1 text-muted-foreground text-xs">
          {status}
        </span>
      )}
    </Link>
  );
}

/** The owner's morning brief; the API refuses it to anyone else. */
export function InboxDailyBrief({
  workspaceId,
  briefId,
}: {
  workspaceId: string;
  briefId: string;
}) {
  const { t } = useTranslation();
  const { data: brief, isError } = useBrief(workspaceId, briefId);
  if (isError)
    return (
      <p role="alert" className="text-muted-foreground text-sm">
        {t("notifications:dailyBrief.missing")}
      </p>
    );
  if (!brief) return null;

  const section = (title: string, empty: boolean, list: React.ReactNode) => (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h3 className="font-medium text-sm">{title}</h3>
      {empty ? (
        <p className="px-2 text-muted-foreground text-sm">
          {t("notifications:dailyBrief.none")}
        </p>
      ) : (
        list
      )}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      {section(
        t("notifications:dailyBrief.dueToday"),
        brief.dueToday.length === 0,
        brief.dueToday.map((ticket) => (
          <TicketLink
            key={ticket.id}
            workspaceId={workspaceId}
            ticket={ticket}
          />
        )),
      )}
      {section(
        t("notifications:dailyBrief.mentions"),
        brief.mentions.length === 0,
        brief.mentions.map((mention) => (
          <Link
            key={mention.messageId}
            to="/dashboard/workspace/$workspaceId/channels/$channelId"
            params={{ workspaceId, channelId: mention.channelId }}
            search={{ messageId: mention.messageId }}
            className={rowClass}
          >
            <Hash aria-hidden className="size-3.5 text-muted-foreground" />
            <span className="shrink-0 text-muted-foreground text-xs">
              {mention.channelName}
            </span>
            <span className="truncate">{mention.preview}</span>
          </Link>
        )),
      )}
      {section(
        t("notifications:dailyBrief.moved"),
        brief.moved.length === 0,
        brief.moved.map((ticket) => (
          <TicketLink
            key={ticket.id}
            workspaceId={workspaceId}
            ticket={ticket}
            status={ticket.status}
          />
        )),
      )}
    </div>
  );
}
