const CHAT_MESSAGE_ENTRIES = new Set([
  "created_from_chat_message",
  "chat_message_added",
]);

/** The message a chat history entry points at, or null for any other entry. */
export function chatMessageEntry(
  type: string,
  eventData: Record<string, unknown> | null,
) {
  if (!CHAT_MESSAGE_ENTRIES.has(type)) return null;
  const channelId = eventData?.channelId;
  const messageId = eventData?.messageId;
  return typeof channelId === "string" && typeof messageId === "string"
    ? { channelId, messageId }
    : null;
}
