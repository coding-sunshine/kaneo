import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChannelIcon } from "@/components/chat/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChatChannel } from "@/components/chat/types";
import { useJoinChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { toast } from "@/lib/toast";

export function ChannelDirectoryRow({
  workspaceId,
  channel,
}: {
  workspaceId: string;
  channel: ChatChannel;
}) {
  const { t } = useTranslation();
  const join = useJoinChannel(workspaceId, channel.id);
  const canJoin = !channel.isMember && !channel.archivedAt;

  return (
    <li className="flex h-12 items-center gap-3 border-border/60 border-b px-4 text-[13px]">
      <ChannelIcon
        isPrivate={channel.isPrivate}
        className="text-muted-foreground"
      />
      <Link
        to="/dashboard/workspace/$workspaceId/channels/$channelId"
        params={{ workspaceId, channelId: channel.id }}
        className="flex min-w-0 flex-1 flex-col hover:underline"
      >
        <span className="truncate font-medium">{channel.name}</span>
        {channel.topic && (
          <span className="truncate text-xs text-muted-foreground">
            {channel.topic}
          </span>
        )}
      </Link>
      {channel.archivedAt && (
        <Badge variant="outline">{t("navigation:chat.archived")}</Badge>
      )}
      {channel.isMember && !channel.archivedAt && (
        <span className="text-xs text-muted-foreground">
          {t("navigation:chat.joined")}
        </span>
      )}
      {canJoin && (
        <Button
          size="sm"
          variant="outline"
          disabled={join.isPending}
          onClick={() =>
            join.mutate(undefined, {
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {t("navigation:chat.join")}
        </Button>
      )}
    </li>
  );
}
