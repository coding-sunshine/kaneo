import { useTranslation } from "react-i18next";
import { MessageComposer } from "@/components/chat/message-composer";
import type { ChatChannelDetail } from "@/components/chat/types";
import { Button } from "@/components/ui/button";
import { useJoinChannel } from "@/hooks/mutations/chat/use-channel-mutations";
import { toast } from "@/lib/toast";

/** The composer for members, a Join button for others, a notice when archived. */
export function ChannelFooter({
  workspaceId,
  channel,
  title,
}: {
  workspaceId: string;
  channel: ChatChannelDetail;
  title: string;
}) {
  const { t } = useTranslation();
  const join = useJoinChannel(workspaceId, channel.id);

  if (channel.archivedAt)
    return (
      <p className="border-t p-3 text-center text-sm text-muted-foreground">
        {t("navigation:chat.archivedNotice")}
      </p>
    );
  if (!channel.isMember)
    return (
      <div className="flex items-center justify-center gap-3 border-t p-3 text-sm">
        <span className="text-muted-foreground">
          {t("navigation:chat.joinToPost")}
        </span>
        <Button
          size="sm"
          disabled={join.isPending}
          onClick={() =>
            join.mutate(undefined, {
              onError: (error) => toast.error(error.message),
            })
          }
        >
          {t("navigation:chat.join")}
        </Button>
      </div>
    );
  return (
    <MessageComposer
      workspaceId={workspaceId}
      channelId={channel.id}
      channelName={title}
    />
  );
}
