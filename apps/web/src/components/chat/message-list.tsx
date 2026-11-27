import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@/components/chat/types";

/** `focusId` is a message opened from search: shown in place, not followed. */
export function MessageList({
  messages,
  focusId,
}: {
  messages: ChatMessage[];
  focusId?: string;
}) {
  const { t, i18n } = useTranslation();
  const end = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLLIElement>(null);
  const last = messages.at(-1)?.id;
  const hasFocus = messages.some((message) => message.id === focusId);

  // Follow the conversation when a new message arrives, unless a search
  // result is open: then keep that message in view.
  useEffect(() => {
    if (hasFocus) return;
    if (last) end.current?.scrollIntoView({ block: "end" });
  }, [last, hasFocus]);

  useEffect(() => {
    if (hasFocus) focused.current?.scrollIntoView({ block: "center" });
  }, [hasFocus, focusId]);

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
        <li
          key={message.id}
          ref={message.id === focusId ? focused : undefined}
          aria-current={message.id === focusId ? true : undefined}
          className="flex flex-col gap-0.5 rounded-md aria-[current=true]:bg-accent aria-[current=true]:px-2 aria-[current=true]:py-1"
        >
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
