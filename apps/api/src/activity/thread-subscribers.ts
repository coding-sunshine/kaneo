import { parseMentionIds } from "../utils/parse-mentions";

type ThreadComment = { userId: string | null; content: string | null };
type Override = { userId: string; subscribed: boolean };

/**
 * Who follows a thread unless they chose otherwise: every author, everyone
 * @mentioned in it, and the task's assignee (who hears every comment).
 */
export function defaultThreadSubscribers(
  comments: ThreadComment[],
  assigneeId: string | null,
) {
  const ids = new Set<string>();
  if (assigneeId) ids.add(assigneeId);
  for (const { userId, content } of comments) {
    if (userId) ids.add(userId);
    for (const id of parseMentionIds(content)) ids.add(id);
  }
  return ids;
}

export function applyThreadOverrides(
  defaults: Set<string>,
  overrides: Override[],
) {
  const ids = new Set(defaults);
  for (const { userId, subscribed } of overrides) {
    if (subscribed) ids.add(userId);
    else ids.delete(userId);
  }
  return ids;
}
