import { and, eq, inArray, notInArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../database";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";
import { publishEvent } from "../events";

/**
 * Capture the sub-issues the deletion of `taskIds` will orphan, before the
 * rows cascade away. Call the returned function once the delete has committed.
 */
export async function captureOrphanedSubtasks(taskIds: string[]) {
  const child = alias(taskTable, "child");
  const orphans = await db
    .select({
      taskId: child.id,
      projectId: child.projectId,
      slug: projectTable.slug,
      number: taskTable.number,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(child, eq(taskRelationTable.targetTaskId, child.id))
    .where(
      and(
        inArray(taskRelationTable.sourceTaskId, taskIds),
        notInArray(taskRelationTable.targetTaskId, taskIds),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );

  return async (userId: string) => {
    for (const { slug, number, ...orphan } of orphans)
      await publishEvent("task.parent_changed", {
        ...orphan,
        userId,
        fromParent: `${slug.toUpperCase()}-${number}`,
        toParent: null,
        type: "parent_changed",
      });
  };
}
