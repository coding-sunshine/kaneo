import { useTranslation } from "react-i18next";
import { MessageItem } from "@/components/chat/message-item";
import { ReplyComposer } from "@/components/chat/reply-composer";
import { useReplies } from "@/hooks/queries/chat/use-replies";

type MessageThreadProps = {
  workspaceId: string;
  channelId: string;
  parentId: string;
  currentUserId: string | undefined;
  canWrite: boolean;
  /** Opened with Reply: the reply box takes focus. */
  focusReply: boolean;
};

/** A message's replies, oldest first, and a box to reply for members who can write. */
export function MessageThread({
  workspaceId,
  channelId,
  parentId,
  currentUserId,
  canWrite,
  focusReply,
}: MessageThreadProps) {
  const { t } = useTranslation();
  const { data: replies = [] } = useReplies(workspaceId, channelId, parentId);

  return (
    <div className="mt-1 flex flex-col gap-2 border-l-2 pl-3">
      {replies.length > 0 && (
        <ol
          className="flex flex-col gap-2"
          aria-label={t("navigation:chat.thread")}
        >
          {replies.map((reply) => (
            <MessageItem
              key={reply.id}
              message={reply}
              workspaceId={workspaceId}
              channelId={channelId}
              currentUserId={currentUserId}
              canWrite={canWrite}
              online={false}
              inThread
            />
          ))}
        </ol>
      )}
      {canWrite && (
        <ReplyComposer
          workspaceId={workspaceId}
          channelId={channelId}
          parentId={parentId}
          autoFocus={focusReply}
        />
      )}
    </div>
  );
}
