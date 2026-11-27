import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MessageItem } from "@/components/chat/message-item";
import type { ChatMessage } from "@/components/chat/types";

type MessageListProps = {
  messages: ChatMessage[];
  workspaceId: string;
  channelId: string;
  currentUserId: string | undefined;
  /** Whether the reader may change messages here: a member of an open channel. */
  canWrite: boolean;
  /** Authors to mark online; only set while the reader's presence is on. */
  online?: Set<string>;
};

export function MessageList({ messages, online, ...item }: MessageListProps) {
  const { t } = useTranslation();
  const end = useRef<HTMLDivElement>(null);
  const last = messages.at(-1)?.id;

  // Follow the conversation when a new message arrives.
  useEffect(() => {
    if (last) end.current?.scrollIntoView({ block: "end" });
  }, [last]);

  if (messages.length === 0)
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        {t("navigation:chat.noMessages")}
      </p>
    );

  return (
    <ol
      className="flex flex-col gap-3 p-4"
      aria-label={t("navigation:chat.messages")}
    >
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          online={Boolean(message.userId && online?.has(message.userId))}
          {...item}
        />
      ))}
      <div ref={end} />
    </ol>
  );
}
