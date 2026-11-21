// Long threads collapse the way Linear's do: six or more replies fold down
// to the last four, and a thread someone opened stays open for 15 minutes.

export const SHOWN_REPLIES = 4;

export type ThreadCollapse = {
  expanded: boolean;
  // Leading replies tucked behind the collapsed row. Replies added later
  // land after them, so they stay in view.
  hiddenCount: number;
};

type ThreadIds = {
  root: { id: string; resolvingCommentId?: string | null };
  replies: { id: string }[];
};

const REMEMBER_MS = 15 * 60 * 1000;
const expandedAt = new Map<string, number>();

export function rememberExpanded(rootId: string, expanded: boolean) {
  if (expanded) expandedAt.set(rootId, Date.now());
  else expandedAt.delete(rootId);
}

function remembered(rootId: string) {
  const at = expandedAt.get(rootId);
  return at !== undefined && Date.now() - at <= REMEMBER_MS;
}

export const commentHash = (id: string) => `#comment-${id}`;

export function initialCollapse(
  { root, replies }: ThreadIds,
  hash: string,
  resolved: boolean,
): ThreadCollapse {
  const open = { expanded: true, hiddenCount: 0 };
  if (remembered(root.id) || hash === commentHash(root.id)) return open;
  const linked = replies.find((reply) => hash === commentHash(reply.id));
  if (linked)
    return linked.id === root.resolvingCommentId
      ? { expanded: false, hiddenCount: 0 }
      : open;
  if (replies.length <= SHOWN_REPLIES + 1 && !resolved) return open;
  return { expanded: false, hiddenCount: collapsedCount(replies.length) };
}

export const collapsedCount = (replyCount: number) =>
  replyCount > SHOWN_REPLIES ? replyCount - SHOWN_REPLIES : 0;
