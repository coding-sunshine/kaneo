import { Link } from "@tanstack/react-router";
import { FileText, Hash, ListTodo, Lock, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentCitation } from "@/components/agent/agent-citation";

const CHIP =
  "inline-flex max-w-64 items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-xs";
const ICONS = {
  task: ListTodo,
  document: FileText,
  comment: MessageSquare,
  message: Hash,
};

/** One source of an answer: a link to it, or a lock when the reader cannot open it. */
export function AgentSourceChip({
  workspaceId,
  citation,
}: {
  workspaceId: string;
  citation: AgentCitation;
}) {
  const { t } = useTranslation();
  if (citation.restricted) {
    return (
      <span className={`${CHIP} text-muted-foreground`}>
        <Lock className="size-3 shrink-0" aria-hidden="true" />
        {t("navigation:agent.sources.restricted")}
      </span>
    );
  }
  const Icon = ICONS[citation.kind];
  const body = (label: string) => (
    <>
      <Icon
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </>
  );
  const linkClass = `${CHIP} hover:bg-accent/60`;
  if (citation.kind === "document") {
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/document/$documentId"
        params={{ workspaceId, documentId: citation.id }}
        title={citation.title}
        className={linkClass}
      >
        {body(citation.title)}
      </Link>
    );
  }
  if (citation.kind === "message") {
    if (!citation.channelId) return null;
    return (
      <Link
        to="/dashboard/workspace/$workspaceId/channels/$channelId"
        params={{ workspaceId, channelId: citation.channelId }}
        search={{ messageId: citation.id }}
        title={citation.title}
        className={linkClass}
      >
        {body(citation.title)}
      </Link>
    );
  }
  if (!citation.taskId || !citation.projectId) return null;
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{
        workspaceId,
        projectId: citation.projectId,
        taskId: citation.taskId,
      }}
      hash={citation.kind === "comment" ? `comment-${citation.id}` : undefined}
      title={citation.title}
      className={linkClass}
    >
      {body(
        citation.kind === "comment"
          ? t("navigation:agent.sources.commentOn", { ticket: citation.ticket })
          : `${citation.ticket} ${citation.title}`,
      )}
    </Link>
  );
}
