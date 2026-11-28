import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { taskIsUnfinished } from "../task-is-unfinished";

export type OpenBlockers = { blockedBy: string[]; hasHiddenBlocker: boolean };

/**
 * Open tasks that block each of `taskIds` ("source blocks target"), keyed by
 * the blocked task. Blockers in a team the reader cannot open are left out of
 * `blockedBy` and reported only as one flag, so neither their keys nor their
 * number reach the reader.
 */
export async function loadOpenBlockers(taskIds: string[], userId: string) {
  const out = new Map<string, OpenBlockers>();
  if (taskIds.length === 0) return out;
  const rows = await db
    .select({
      blockedId: taskRelationTable.targetTaskId,
      number: taskTable.number,
      slug: projectTable.slug,
      visible: projectAccessCondition(userId, taskTable.projectId),
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.sourceTaskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(taskRelationTable.relationType, "blocks"),
        inArray(taskRelationTable.targetTaskId, taskIds),
        ne(taskRelationTable.sourceTaskId, taskRelationTable.targetTaskId),
        isNull(taskTable.archivedAt),
        ne(taskTable.status, "archived"),
        ne(taskTable.status, "canceled"),
        taskIsUnfinished,
      ),
    )
    .orderBy(projectTable.slug, taskTable.number);
  for (const row of rows) {
    const entry = out.get(row.blockedId) ?? {
      blockedBy: [],
      hasHiddenBlocker: false,
    };
    if (!row.visible) entry.hasHiddenBlocker = true;
    else
      entry.blockedBy.push(
        row.number == null ? row.slug : `${row.slug}-${row.number}`,
      );
    out.set(row.blockedId, entry);
  }
  return out;
}
