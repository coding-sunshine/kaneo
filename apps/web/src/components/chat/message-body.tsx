import { MessageCodeBlock } from "@/components/chat/message-code-block";
import { MessageInline } from "@/components/chat/message-inline";
import {
  type MessageBlock,
  parseBlocks,
  parseInline,
} from "@/components/chat/parse-message-markdown";
import type { ChatMention } from "@/components/chat/split-mentions";

/**
 * Message text with its formatting: paragraphs, lists, quotes, fenced code,
 * bold, inline code, links and mention cards. Everything renders as React
 * elements, so markup people type shows as text.
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
  const inline = (text: string) => (
    <MessageInline
      nodes={parseInline(text)}
      mentions={mentions}
      workspaceId={workspaceId}
    />
  );
  // Blocks never reorder, so the index is a stable key.
  const renderBlock = (block: MessageBlock, index: number) => {
    switch (block.type) {
      case "code":
        return (
          <MessageCodeBlock
            key={index}
            code={block.code}
            language={block.language}
          />
        );
      case "list": {
        const List = block.ordered ? "ol" : "ul";
        return (
          <List
            key={index}
            className={block.ordered ? "list-decimal pl-5" : "list-disc pl-5"}
          >
            {block.items.map((item, at) => (
              // oxlint-disable-next-line react/no-array-index-key
              <li key={at}>{inline(item)}</li>
            ))}
          </List>
        );
      }
      case "quote":
        return (
          <blockquote
            key={index}
            className="border-l-2 pl-3 text-muted-foreground"
          >
            {block.blocks.map(renderBlock)}
          </blockquote>
        );
      default:
        return (
          <p key={index} className="whitespace-pre-wrap">
            {inline(block.text)}
          </p>
        );
    }
  };
  return (
    <div className="flex flex-col gap-1 break-words text-sm">
      {parseBlocks(body).map(renderBlock)}
    </div>
  );
}
