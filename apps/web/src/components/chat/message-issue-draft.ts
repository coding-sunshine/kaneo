import { quoteMarkdown } from "@/components/activity/comment-issue-draft";
import type { ChatMessage } from "@/components/chat/types";
import type { CreateIssueDraft } from "@/store/create-issue";

const TITLE_LENGTH = 80;

export function chatMessageUrl(
  workspaceId: string,
  channelId: string,
  messageId: string,
) {
  return `${window.location.origin}/dashboard/workspace/${workspaceId}/channels/${channelId}?messageId=${messageId}`;
}

// "Create ticket" from a chat message: its first line as the title, the whole
// message quoted with a link back, and the message as the ticket's source.
export function buildMessageIssueDraft(
  workspaceId: string,
  channelId: string,
  message: Pick<ChatMessage, "id" | "body">,
  linkLabel: string,
): CreateIssueDraft {
  const link = chatMessageUrl(workspaceId, channelId, message.id);
  return {
    title: (message.body.trim().split("\n")[0] ?? "").slice(0, TITLE_LENGTH),
    description: `${quoteMarkdown(message.body)}\n\n[${linkLabel}](${link})`,
    sourceMessage: { channelId, messageId: message.id },
  };
}
