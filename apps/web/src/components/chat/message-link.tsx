import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageTarget } from "@/components/chat/split-mentions";

/** A short link that opens a chat message in its channel. */
export function MessageLink({ target }: { target: MessageTarget }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/channels/$channelId"
      params={{ workspaceId: target.workspaceId, channelId: target.channelId }}
      search={{ messageId: target.messageId }}
      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-1.5 py-0.5 align-baseline text-xs hover:bg-accent/60"
    >
      <MessageSquare
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      {t("navigation:chat.messageLink")}
    </Link>
  );
}
