export type Reaction = { emoji: string; userIds: string[] };

export function toggleReaction(
  reactions: Reaction[],
  emoji: string,
  userId: string,
  reacted: boolean,
): Reaction[] {
  const existing = reactions.find((reaction) => reaction.emoji === emoji);
  if (!existing) {
    return reacted ? [...reactions, { emoji, userIds: [userId] }] : reactions;
  }
  return reactions
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      const others = reaction.userIds.filter((id) => id !== userId);
      return { emoji, userIds: reacted ? [...others, userId] : others };
    })
    .filter((reaction) => reaction.userIds.length > 0);
}
