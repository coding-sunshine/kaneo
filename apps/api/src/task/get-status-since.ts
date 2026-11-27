import { and, eq, inArray, max } from "drizzle-orm";
import { activityTable } from "../database/schema";
import type { TaskReadDatabase } from "./bounded-read";

/** When each task last changed status; tasks that never moved are absent. */
export async function getStatusSince(db: TaskReadDatabase, taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, Date>();
  const rows = await db
    .select({
      taskId: activityTable.taskId,
      at: max(activityTable.createdAt),
    })
    .from(activityTable)
    .where(
      and(
        inArray(activityTable.taskId, taskIds),
        eq(activityTable.type, "status_changed"),
      ),
    )
    .groupBy(activityTable.taskId);
  return new Map(
    rows.flatMap((row) => (row.at ? [[row.taskId, row.at] as const] : [])),
  );
}
