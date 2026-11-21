type ThreadItem = { id: string; parentId?: string | null };

/**
 * Splits an oldest-first activity list into timeline items and each top-level
 * comment's replies. A reply whose parent is missing from the list (deleted,
 * or cut off by a limit) stays in the timeline instead of vanishing.
 */
export function groupCommentThreads<T extends ThreadItem>(oldestFirst: T[]) {
  const ids = new Set(oldestFirst.map((item) => item.id));
  const repliesByRoot = new Map<string, T[]>();
  const items: T[] = [];
  for (const item of oldestFirst) {
    if (item.parentId && ids.has(item.parentId)) {
      const replies = repliesByRoot.get(item.parentId) ?? [];
      replies.push(item);
      repliesByRoot.set(item.parentId, replies);
    } else {
      items.push(item);
    }
  }
  return { items, repliesByRoot };
}
