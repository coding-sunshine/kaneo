type ReactionRow = { activityId: string; userId: string; emoji: string };

export type ReactionSummary = { emoji: string; userIds: string[] };

/** Groups reaction rows (oldest first) by comment, then by emoji. */
export function groupReactions(rows: ReactionRow[]) {
  const byActivity = new Map<string, Map<string, string[]>>();
  for (const { activityId, userId, emoji } of rows) {
    let byEmoji = byActivity.get(activityId);
    if (!byEmoji) byActivity.set(activityId, (byEmoji = new Map()));
    const userIds = byEmoji.get(emoji);
    if (userIds) userIds.push(userId);
    else byEmoji.set(emoji, [userId]);
  }
  return (activityId: string): ReactionSummary[] =>
    [...(byActivity.get(activityId) ?? [])].map(([emoji, userIds]) => ({
      emoji,
      userIds,
    }));
}
