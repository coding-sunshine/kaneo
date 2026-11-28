import type { ChatMessage } from "@/components/chat/types";

export type ChatMention = ChatMessage["mentions"][number];
export type MentionPart =
  | { text: string; href?: string }
  | { mention: ChatMention }
  | { broadcast: string };

// A person's mention tag, a web link, @channel or @here as a word of its own
// (as the server reads them), or a typed ticket key, in that order.
const TOKEN =
  /<kaneo-mention[^>]*\bid="([^"]+)"[^>]*>(?:<\/kaneo-mention>)?|\bhttps?:\/\/[^\s<>"'`]+|(?<![\p{L}\p{N}_.@-])@(?:channel|here)(?![\p{L}\p{N}_@-])|(?<![\p{L}\p{N}_%-])\p{L}[\p{L}\p{N}]*-\d{1,9}(?![\p{L}\p{N}_-])/gu;
const TRAILING = /[.,;:!?)\]}]+$/;
const ADDRESS =
  /\/workspace\/[^/\s]+\/(document|project)\/([a-z0-9]+)(?![\w-])/;

/**
 * Splits message text into plain runs, web links, and the cards of what the
 * server resolved for this reader. Anything it did not resolve stays text.
 */
export function splitMentions(
  text: string,
  mentions: ChatMention[],
): MentionPart[] {
  const find = (kind: ChatMention["kind"], ref: string) =>
    mentions.find((mention) => mention.kind === kind && mention.ref === ref);
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    let token = match[0];
    let part: MentionPart;
    if (match[1] !== undefined) {
      const person = find("user", match[1]);
      part = person ? { mention: person } : { text: "@" };
    } else if (token.startsWith("@")) {
      part = { broadcast: token };
    } else if (/^https?:/i.test(token)) {
      token = token.replace(TRAILING, "");
      const [, kind, id] = ADDRESS.exec(token) ?? [];
      const named =
        kind && id ? find(kind as "document" | "project", id) : undefined;
      part = named ? { mention: named } : { text: token, href: token };
    } else {
      const ticket = find("task", token.toUpperCase());
      part = ticket ? { mention: ticket } : { text: token };
    }
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push(part);
    last = match.index + token.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
