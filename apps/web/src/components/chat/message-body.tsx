import { MentionCard } from "@/components/chat/mention-card";
import {
  type ChatMention,
  splitMentions,
} from "@/components/chat/split-mentions";

/**
 * Message text with its web links clickable, opening in a new tab, and what
 * it names shown as live cards.
 */
export function MessageBody({
  body,
  mentions = [],
  workspaceId,
}: {
  body: string;
  mentions?: ChatMention[];
  workspaceId: string;
}) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {splitMentions(body, mentions).map((part, index) =>
        // Parts never reorder, so the index is a stable key.
        "mention" in part ? (
          <MentionCard
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            workspaceId={workspaceId}
            mention={part.mention}
          />
        ) : part.href ? (
          <a
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </p>
  );
}
