import { and, eq, isNotNull, not } from "drizzle-orm";
import createActivities from "../activity/controllers/create-activities";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

/**
 * Takes the issues of one team away from assignees who can no longer open it,
 * after the team went private or a person was removed from it. The team-wide
 * twin of unassignInaccessibleTasks, which follows one person across teams.
 */
export async function unassignProjectOutsiders(
  database: DbOrTx,
  change: { projectId: string; actorId: string },
): Promise<{ id: string }[]> {
  const unassigned = await database
    .update(schema.taskTable)
    .set({ userId: null })
    .where(
      and(
        eq(schema.taskTable.projectId, change.projectId),
        isNotNull(schema.taskTable.userId),
        not(
          projectAccessCondition(
            schema.taskTable.userId,
            schema.taskTable.projectId,
          ),
        ),
      ),
    )
    .returning({ id: schema.taskTable.id });

  await createActivities(
    unassigned.map((task) => ({
      taskId: task.id,
      type: "unassigned",
      userId: change.actorId,
      content: null,
      eventData: {},
    })),
    database,
  );

  return unassigned;
}
