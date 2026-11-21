import { and, asc, desc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  commentReactionTable,
  commentThreadSubscriptionTable,
  taskTable,
} from "../../database/schema";
import { groupReactions } from "../group-reactions";
import { redactInaccessibleMoves } from "../redact-inaccessible-moves";
import {
  applyThreadOverrides,
  defaultThreadSubscribers,
} from "../thread-subscribers";

/** For each root comment id, whether the viewer follows its thread. */
async function viewerThreadSubscriptions(
  taskId: string,
  viewerId: string,
  comments: (typeof activityTable.$inferSelect)[],
) {
  const roots = comments.filter((x) => x.type === "comment" && !x.parentId);
  if (!roots.length) return new Map<string, boolean>();

  const [[task], overrides] = await Promise.all([
    db
      .select({ assigneeId: taskTable.userId })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .limit(1),
    db
      .select({
        activityId: commentThreadSubscriptionTable.activityId,
        subscribed: commentThreadSubscriptionTable.subscribed,
      })
      .from(commentThreadSubscriptionTable)
      .where(
        and(
          eq(commentThreadSubscriptionTable.userId, viewerId),
          inArray(
            commentThreadSubscriptionTable.activityId,
            roots.map((x) => x.id),
          ),
        ),
      ),
  ]);
  const override = new Map(overrides.map((x) => [x.activityId, x.subscribed]));

  return new Map(
    roots.map((root) => {
      const thread = comments.filter(
        (x) => x.id === root.id || x.parentId === root.id,
      );
      const chosen = override.get(root.id);
      const followed = applyThreadOverrides(
        defaultThreadSubscribers(thread, task?.assigneeId ?? null),
        chosen === undefined ? [] : [{ userId: viewerId, subscribed: chosen }],
      ).has(viewerId);
      return [root.id, followed] as const;
    }),
  );
}

async function getActivitiesFromTaskId(
  taskId: string,
  viewerId: string,
  limit?: number,
) {
  const activities = await db.query.activityTable.findMany({
    where: eq(activityTable.taskId, taskId),
    orderBy: [desc(activityTable.createdAt), desc(activityTable.id)],
    limit,
  });

  activities.forEach((x) => {
    if (x.content && x.type !== "comment") {
      x.content = x.content.replace(/\n+/g, "\n");
    }
  });

  const commentIds = activities
    .filter((x) => x.type === "comment")
    .map((x) => x.id);
  const reactionsFor = groupReactions(
    commentIds.length
      ? await db
          .select({
            activityId: commentReactionTable.activityId,
            userId: commentReactionTable.userId,
            emoji: commentReactionTable.emoji,
          })
          .from(commentReactionTable)
          .where(inArray(commentReactionTable.activityId, commentIds))
          .orderBy(asc(commentReactionTable.createdAt))
      : [],
  );

  const subscribedTo = await viewerThreadSubscriptions(
    taskId,
    viewerId,
    activities,
  );

  return redactInaccessibleMoves(
    viewerId,
    activities.map((x) => ({
      ...x,
      reactions: reactionsFor(x.id),
      subscribedToThread: subscribedTo.get(x.id) ?? null,
    })),
  );
}

export default getActivitiesFromTaskId;
