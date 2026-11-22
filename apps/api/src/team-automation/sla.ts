import { eq } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import { publishEvent, subscribeToEvent } from "../events";

const HOUR_MS = 3_600_000;

/**
 * Linear's default SLA rules: urgent and high issues get a deadline when the
 * priority is set; every other priority removes it. Existing issues are only
 * touched when their priority changes.
 */
export async function applySla(taskId: string, priority: string) {
  const [row] = await db
    .select({
      projectId: taskTable.projectId,
      enabled: projectTable.slaEnabled,
      urgent: projectTable.slaUrgentHours,
      high: projectTable.slaHighHours,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!row?.enabled) return;
  const hours =
    priority === "urgent" ? row.urgent : priority === "high" ? row.high : null;
  await db
    .update(taskTable)
    .set({
      slaDueAt: hours ? new Date(Date.now() + hours * HOUR_MS) : null,
      // A new deadline starts the warning and breach notifications over.
      slaWarningNotifiedAt: null,
      slaBreachedAt: null,
    })
    .where(eq(taskTable.id, taskId));
  await publishEvent("task.updated", { taskId, projectId: row.projectId });
}

subscribeToEvent<{ taskId: string; priority?: string | null }>(
  "task.created",
  ({ taskId, priority }) => applySla(taskId, priority ?? "no-priority"),
);
subscribeToEvent<{ taskId: string; newPriority: string }>(
  "task.priority_changed",
  ({ taskId, newPriority }) => applySla(taskId, newPriority),
);
