import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

// Opens the channel at the message the notification points at.
export function InboxChatMessage({
  workspaceId,
  channelId,
  messageId,
}: {
  workspaceId: string;
  channelId: string;
  messageId: string;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <Button
        variant="outline"
        size="xs"
        render={
          <Link
            to="/dashboard/workspace/$workspaceId/channels/$channelId"
            params={{ workspaceId, channelId }}
            search={{ messageId }}
          />
        }
      >
        {t("notifications:inbox.openMessage")}
        <ArrowUpRight />
      </Button>
    </div>
  );
}
