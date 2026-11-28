import { findMentions, type MentionRefs, taskRef } from "./find-mentions";
import type { MessageMention } from "./mention-type";
import { resolveMentions } from "./resolve-mentions";

const unique = <T>(items: T[]) => [...new Set(items)];

/**
 * Attaches to every message the cards of what it names, as this reader sees
 * them, with one lookup per kind for the whole page.
 */
export async function withMentions<T extends { body: string }>(
  workspaceId: string,
  userId: string,
  messages: T[],
): Promise<(T & { mentions: MessageMention[] })[]> {
  const found = messages.map((message) =>
    findMentions(message.body, workspaceId),
  );
  const all: MentionRefs = {
    userIds: unique(found.flatMap((refs) => refs.userIds)),
    taskKeys: found.flatMap((refs) => refs.taskKeys),
    documentIds: unique(found.flatMap((refs) => refs.documentIds)),
    projectIds: unique(found.flatMap((refs) => refs.projectIds)),
  };
  const resolved = await resolveMentions(workspaceId, userId, all);
  return messages.map((message, index) => {
    const refs = found[index] as MentionRefs;
    const keys = [
      ...refs.userIds.map((id) => `user:${id}`),
      ...unique(
        refs.taskKeys.map(({ key, number }) => taskRef(key, number)),
      ).map((ref) => `task:${ref}`),
      ...refs.documentIds.map((id) => `document:${id}`),
      ...refs.projectIds.map((id) => `project:${id}`),
    ];
    return {
      ...message,
      mentions: keys.flatMap((key) => resolved.get(key) ?? []),
    };
  });
}
