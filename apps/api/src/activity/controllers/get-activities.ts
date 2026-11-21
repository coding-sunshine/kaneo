import { asc, desc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { activityTable, commentReactionTable } from "../../database/schema";
import { groupReactions } from "../group-reactions";
import { redactInaccessibleMoves } from "../redact-inaccessible-moves";

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

  return redactInaccessibleMoves(
    viewerId,
    activities.map((x) => ({ ...x, reactions: reactionsFor(x.id) })),
  );
}

export default getActivitiesFromTaskId;
