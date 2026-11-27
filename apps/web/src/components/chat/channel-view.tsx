import { ChannelFooter } from "@/components/chat/channel-footer";
import { ChannelHeader } from "@/components/chat/channel-header";
import { ChannelNotFound } from "@/components/chat/channel-not-found";
import { MessageList } from "@/components/chat/message-list";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { useRemoveLinkPreview } from "@/hooks/mutations/chat/use-remove-link-preview";
import { useChannel } from "@/hooks/queries/chat/use-channel";
import { useMessages } from "@/hooks/queries/chat/use-messages";
import { useChatChannelSocket } from "@/hooks/use-chat-channel-socket";
import { useDirectMessageTitle } from "@/hooks/use-direct-message-title";
import { toast } from "@/lib/toast";

/**
 * One channel: header with topic, history, then the composer. `messageId`
 * opens the history around that message; posting returns to the newest.
 */
export function ChannelView({
  workspaceId,
  channelId,
  messageId,
  onPosted,
}: {
  workspaceId: string;
  channelId: string;
  messageId?: string;
  onPosted?: () => void;
}) {
  const { user } = useAuth();
  const { data: channel, isError } = useChannel(workspaceId, channelId);
  const removePreview = useRemoveLinkPreview(workspaceId, channelId);
  const titleOf = useDirectMessageTitle(workspaceId);
  const live = useChatChannelSocket(workspaceId, channelId, Boolean(channel));
  const { data: messages = [] } = useMessages(
    workspaceId,
    channelId,
    Boolean(channel),
    live,
    messageId,
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
          focusId={messageId}
          currentUserId={user?.id}
          onRemovePreview={(id) =>
            removePreview.mutate(id, {
              onError: (error) => toast.error(error.message),
            })
          }
        />
      </div>
      <ChannelFooter
        workspaceId={workspaceId}
        channel={channel}
        title={title}
        onPosted={onPosted}
      />
    </div>
  );
}
