import { and, desc, eq, gt, inArray, isNull, ne, or } from "drizzle-orm";
import db from "../database";
import {
  activityTable,
  projectTable,
  taskSubscriberTable,
  taskTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";

const MAX_EVENTS = 80;

/** What others did since `since` on tickets the reader follows and can open. */
export async function gatherFollowedTicketEvents(
  workspaceId: string,
  userId: string,
  since: Date,
) {
  return db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      content: activityTable.content,
      taskId: taskTable.id,
      title: taskTable.title,
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(taskTable.id, activityTable.taskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
        inArray(
          taskTable.id,
          db
            .select({ id: taskSubscriberTable.taskId })
            .from(taskSubscriberTable)
            .where(eq(taskSubscriberTable.userId, userId)),
        ),
        gt(activityTable.createdAt, since),
        or(isNull(activityTable.userId), ne(activityTable.userId, userId)),
      ),
    )
    .orderBy(desc(activityTable.createdAt))
    .limit(MAX_EVENTS);
}
