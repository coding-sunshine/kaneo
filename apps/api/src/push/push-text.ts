const LIMIT = 180;
const mention =
  /<kaneo-mention\b[^>]*\blabel="([^"]*)"[^>]*>[\s\S]*?<\/kaneo-mention>/g;

/** The lines a lock screen shows for a chat message: plain text, kept short. */
export function chatPushText(input: {
  channelName: string;
  isDirect: boolean;
  authorName: string | null;
  body: string;
  filename: string | null;
}) {
  const plain = input.body
    .replace(mention, (_, label: string) => `@${label}`)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const text = plain || input.filename || "";
  const author = input.authorName ?? "";
  const line = input.isDirect || !author ? text : `${author}: ${text}`;
  return {
    title: input.isDirect
      ? author || input.channelName
      : `#${input.channelName}`,
    body: line.length > LIMIT ? `${line.slice(0, LIMIT - 1)}…` : line,
  };
}
