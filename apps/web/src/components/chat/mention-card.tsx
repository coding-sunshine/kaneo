import { Link } from "@tanstack/react-router";
import { FileText, Lock, SquareCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatMention } from "@/components/chat/split-mentions";

const cardClass =
  "inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-1.5 align-baseline text-[13px] leading-5 hover:bg-accent";
const iconClass = "size-3.5 shrink-0 text-muted-foreground";

/**
 * A person, ticket, document or team named in a message, with its current
 * title. Something the reader cannot open shows as a restricted item.
 */
export function MentionCard({
  workspaceId,
  mention,
}: {
  workspaceId: string;
  mention: ChatMention;
}) {
  const { t } = useTranslation();
  const { id, title } = mention;

  if (mention.restricted || !id || title === null)
    return (
      <span className={cardClass}>
        <Lock aria-hidden className={iconClass} />
        <span className="text-muted-foreground">
          {t("navigation:chat.restrictedItem")}
        </span>
      </span>
    );
  if (mention.kind === "user")
    return (
      <span className="rounded bg-primary/10 px-0.5 font-medium text-primary">
        @{title}
      </span>
    );
  if (mention.kind === "task" && mention.projectId)
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: mention.projectId, taskId: id }}
        className={cardClass}
      >
        <SquareCheck aria-hidden className={iconClass} />
        <span className="shrink-0 font-mono text-muted-foreground">
          {mention.ref}
        </span>
        <span className="truncate">{title}</span>
        {mention.status && (
          <span className="shrink-0 rounded bg-background px-1 text-muted-foreground text-xs">
            {mention.status}
          </span>
        )}
      </Link>
    );
  if (mention.kind === "document")
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: id }}
        className={cardClass}
      >
        <FileText aria-hidden className={iconClass} />
        <span className="truncate">{title}</span>
      </Link>
    );
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/board"
      params={{ workspaceId, projectId: id }}
      className={cardClass}
    >
      <Users aria-hidden className={iconClass} />
      <span className="truncate">{title}</span>
    </Link>
  );
}
