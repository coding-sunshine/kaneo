import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@/components/chat/types";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  const { t, i18n } = useTranslation();
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
        <li key={message.id} className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-2 text-xs">
            <span className="font-medium">
              {message.authorName ?? t("navigation:chat.deletedUser")}
            </span>
            <time
              dateTime={new Date(message.createdAt).toISOString()}
              className="text-muted-foreground"
            >
              {new Date(message.createdAt).toLocaleString(i18n.language, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          </span>
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.body}
          </p>
        </li>
      ))}
      <div ref={end} />
    </ol>
  );
}
