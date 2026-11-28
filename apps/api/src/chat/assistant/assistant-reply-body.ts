import type { AssistantAnswer, AssistantItem } from "./read-assistant-answer";
import { plainAnswerText } from "./plain-answer-text";

/**
 * The chat message the assistant posts: a summary and what is still open,
 * one line per item, each ending with links to what it rests on. Only the
 * links come from the server; the model's text is made plain first.
 */
export function assistantReplyBody(
  answer: AssistantAnswer,
  link: (sourceId: string) => string,
) {
  if (answer.summary.length === 0 && answer.open.length === 0)
    return "I found nothing in this thread to sum up.";
  const line = (item: AssistantItem) =>
    `- ${[plainAnswerText(item.text), ...item.sources.map(link)].join(" ")}`;
  return [
    "**Summary**",
    ...(answer.summary.length ? answer.summary.map(line) : ["- Nothing."]),
    "**Still open**",
    ...(answer.open.length ? answer.open.map(line) : ["- Nothing."]),
  ].join("\n");
}
