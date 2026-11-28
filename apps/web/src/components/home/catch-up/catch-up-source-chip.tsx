import { Link } from "@tanstack/react-router";
import { Hash } from "lucide-react";
import { AgentSourceChip } from "@/components/agent/agent-source-chip";
import type { CatchUpSource } from "@/fetchers/catch-up/catch-up";

/** A link to the message or ticket a catch-up bullet rests on. */
export function CatchUpSourceChip({
  workspaceId,
  source,
}: {
  workspaceId: string;
  source: CatchUpSource;
}) {
  if (source.kind !== "message")
    return <AgentSourceChip workspaceId={workspaceId} citation={source} />;
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/channels/$channelId"
      params={{ workspaceId, channelId: source.channelId }}
      search={{ messageId: source.id }}
      className="inline-flex max-w-64 items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 text-xs hover:bg-accent/60"
    >
      <Hash
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate">{source.channelName}</span>
    </Link>
  );
}
