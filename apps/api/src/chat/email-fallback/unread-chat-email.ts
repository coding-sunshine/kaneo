import { commentPreview } from "../../utils/comment-preview";

const MAX_LINES = 10;

type Line = {
  messageId: string;
  channelId: string;
  workspaceId: string;
  channelName: string;
  isDirect: boolean;
  authorName: string | null;
  body: string;
};

/**
 * The email for unread chat: one line per message, oldest first, and a link
 * that opens the newest one.
 */
export function unreadChatEmail(lines: Line[], clientUrl: string) {
  const newest = lines.at(-1);
  const shown = lines.slice(-MAX_LINES).map((line) => {
    const where = line.isDirect ? "a direct message" : `#${line.channelName}`;
    return `${line.authorName ?? "Someone"} in ${where}: ${commentPreview(line.body)}`;
  });
  const hidden = lines.length - shown.length;
  return {
    title:
      lines.length === 1
        ? "You have an unread message"
        : `You have ${lines.length} unread messages`,
    message: [...shown, ...(hidden > 0 ? [`and ${hidden} more`] : [])].join(
      "\n",
    ),
    actionUrl: newest
      ? `${clientUrl}/dashboard/workspace/${newest.workspaceId}/channels/${newest.channelId}?messageId=${newest.messageId}`
      : null,
  };
}
