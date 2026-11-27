import { useTranslation } from "react-i18next";
import { ChannelActions } from "@/components/chat/channel-actions";
import { ChannelIcon } from "@/components/chat/channel-icon";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Badge } from "@/components/ui/badge";

export function ChannelHeader({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: ChatChannelDetail;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center gap-2 border-b px-4 py-2">
      <ChannelIcon
        isPrivate={channel.isPrivate}
        className="text-muted-foreground"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-sm font-semibold">{channel.name}</h1>
        {channel.topic && (
          <p
            className="truncate text-xs text-muted-foreground"
            data-testid="channel-topic"
          >
            {channel.topic}
          </p>
        )}
      </div>
      {channel.archivedAt && (
        <Badge variant="outline">{t("navigation:chat.archived")}</Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {t("navigation:chat.memberCount", { count: channel.memberIds.length })}
      </span>
      <ChannelActions workspaceId={workspaceId} channel={channel} />
    </header>
  );
}
