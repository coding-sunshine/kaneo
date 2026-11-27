import { ChannelFooter } from "@/components/chat/channel-footer";
import { ChannelHeader } from "@/components/chat/channel-header";
import { ChannelNotFound } from "@/components/chat/channel-not-found";
import { MessageList } from "@/components/chat/message-list";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { useRemoveLinkPreview } from "@/hooks/mutations/chat/use-remove-link-preview";
import { useChannel } from "@/hooks/queries/chat/use-channel";
import { useOnline } from "@/hooks/queries/chat/use-online";
import { usePresenceSetting } from "@/hooks/queries/chat/use-presence-setting";
import { useMessages } from "@/hooks/queries/chat/use-messages";
import { useChatChannelSocket } from "@/hooks/use-chat-channel-socket";
import { useMarkChannelRead } from "@/hooks/use-mark-channel-read";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";
import { toast } from "@/lib/toast";

/** One channel: header with topic, history, then the composer. */
export function ChannelView({
  workspaceId,
  channelId,
}: {
  workspaceId: string;
  channelId: string;
}) {
  const { user } = useAuth();
  const { data: channel, isError } = useChannel(workspaceId, channelId);
  const presenceOn = usePresenceSetting().data?.enabled ?? false;
  usePresenceHeartbeat(presenceOn);
  const { data: online } = useOnline(workspaceId, presenceOn);
  const removePreview = useRemoveLinkPreview(workspaceId, channelId);
  const titleOf = useDirectMessageTitle(workspaceId);
  const live = useChatChannelSocket(workspaceId, channelId, Boolean(channel));
  const { data: messages = [] } = useMessages(
    workspaceId,
    channelId,
    Boolean(channel),
    live,
  );
  useMarkChannelRead(
    workspaceId,
    channelId,
    Boolean(channel?.isMember),
    messages.at(-1)?.id,
  );

  if (isError) return <ChannelNotFound workspaceId={workspaceId} />;
  if (!channel) return null;
  const title = channel.isDirect ? titleOf(channel.memberIds) : channel.name;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChannelHeader
        workspaceId={workspaceId}
        channel={channel}
        title={title}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages}
          workspaceId={workspaceId}
          channelId={channelId}
          currentUserId={user?.id}
          canWrite={channel.isMember && !channel.archivedAt}
          online={presenceOn ? online : undefined}
          onRemovePreview={(messageId) =>
            removePreview.mutate(messageId, {
              onError: (error) => toast.error(error.message),
            })
          }
        />
      </div>
      <ChannelFooter
        workspaceId={workspaceId}
        channel={channel}
        title={title}
      />
    </div>
  );
}
