import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkPreviewCard } from "@/components/chat/link-preview-card";
import { MessageActions } from "@/components/chat/message-actions";
import { MessageBody } from "@/components/chat/message-body";
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
  /** The author's status line, when they set one. */
  status?: string;
  /** Opened from a search result: scrolled into view and marked. */
  focused?: boolean;
  onRemovePreview?: (messageId: string) => void;
};

export function MessageItem({
  message,
  workspaceId,
  channelId,
  currentUserId,
  canWrite,
  online,
  status,
  focused = false,
  onRemovePreview,
}: MessageItemProps) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const item = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) item.current?.scrollIntoView({ block: "center" });
  }, [focused]);
  const formatTime = (value: string | Date) =>
    new Date(value).toLocaleString(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <li
      ref={item}
      aria-current={focused ? true : undefined}
      className="group flex flex-col gap-0.5 rounded-md aria-[current=true]:bg-accent aria-[current=true]:px-2 aria-[current=true]:py-1"
    >
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
          {status && (
            <span className="max-w-48 truncate font-normal text-muted-foreground">
              {status}
            </span>
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
        <MessageBody
          body={message.body}
          mentions={message.mentions}
          workspaceId={workspaceId}
        />
      )}
      {message.linkPreview && (
        <LinkPreviewCard
          preview={message.linkPreview}
          onRemove={
            onRemovePreview && message.userId === currentUserId
              ? () => onRemovePreview(message.id)
              : undefined
          }
        />
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
