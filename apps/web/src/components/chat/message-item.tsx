import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageActions } from "@/components/chat/message-actions";
import { MessageEditForm } from "@/components/chat/message-edit-form";
import { MessageReactions } from "@/components/chat/message-reactions";
import type { ChatMessage } from "@/components/chat/types";

type MessageItemProps = {
  message: ChatMessage;
  workspaceId: string;
  channelId: string;
  currentUserId: string | undefined;
  canWrite: boolean;
  online: boolean;
};

export function MessageItem({
  message,
  workspaceId,
  channelId,
  currentUserId,
  canWrite,
  online,
}: MessageItemProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const formatTime = (value: string | Date) =>
    new Date(value).toLocaleString(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <li className="group flex flex-col gap-0.5">
      <span className="flex items-baseline gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          {message.authorName ?? t("navigation:chat.deletedUser")}
          {online && (
            <span
              role="img"
              aria-label={t("navigation:chat.online")}
              title={t("navigation:chat.online")}
              className="size-2 rounded-full bg-emerald-500"
            />
          )}
        </span>
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="text-muted-foreground"
        >
          {formatTime(message.createdAt)}
        </time>
        {message.editedAt && (
          <span
            className="text-muted-foreground"
            title={formatTime(message.editedAt)}
          >
            {t("navigation:chat.edited")}
          </span>
        )}
        {canWrite && !editing && (
          <MessageActions
            workspaceId={workspaceId}
            channelId={channelId}
            message={message}
            isOwn={message.userId === currentUserId}
            onEdit={() => setEditing(true)}
          />
        )}
      </span>
      {editing ? (
        <MessageEditForm
          workspaceId={workspaceId}
          channelId={channelId}
          message={message}
          onDone={() => setEditing(false)}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">
          {message.body}
        </p>
      )}
      <MessageReactions
        workspaceId={workspaceId}
        channelId={channelId}
        messageId={message.id}
        currentUserId={currentUserId}
        reactions={message.reactions}
        canReact={canWrite}
      />
    </li>
  );
}
