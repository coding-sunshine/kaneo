import { BroadcastMention } from "@/components/chat/broadcast-mention";
import { MentionCard } from "@/components/chat/mention-card";
import { MessageLink } from "@/components/chat/message-link";
import type { InlineNode } from "@/components/chat/parse-message-markdown";
import {
  type ChatMention,
  splitMentions,
} from "@/components/chat/split-mentions";

/**
 * Inline message text: `code`, **bold**, clickable web links opening in a new
 * tab, links to chat messages, and what it names shown as live cards.
 */
export function MessageInline({
  nodes,
  mentions,
  workspaceId,
}: {
  nodes: InlineNode[];
  mentions: ChatMention[];
  workspaceId: string;
}) {
  // Parts never reorder, so the index is a stable key.
  return nodes.map((node, index) =>
    node.type === "code" ? (
      // oxlint-disable-next-line react/no-array-index-key
      <code key={index} className="rounded bg-muted px-1 font-mono text-xs">
        {node.text}
      </code>
    ) : node.type === "strong" ? (
      // oxlint-disable-next-line react/no-array-index-key
      <strong key={index} className="font-semibold">
        <MessageInline
          nodes={node.children}
          mentions={mentions}
          workspaceId={workspaceId}
        />
      </strong>
    ) : (
      splitMentions(node.text, mentions).map((part, at) =>
        "broadcast" in part ? (
          <BroadcastMention
            // oxlint-disable-next-line react/no-array-index-key
            key={`${index}-${at}`}
            token={part.broadcast}
          />
        ) : "message" in part ? (
          <MessageLink
            // oxlint-disable-next-line react/no-array-index-key
            key={`${index}-${at}`}
            target={part.message}
          />
        ) : "mention" in part ? (
          <MentionCard
            // oxlint-disable-next-line react/no-array-index-key
            key={`${index}-${at}`}
            workspaceId={workspaceId}
            mention={part.mention}
          />
        ) : part.href ? (
          <a
            // oxlint-disable-next-line react/no-array-index-key
            key={`${index}-${at}`}
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
      )
    ),
  );
}
